"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Room,
  RoomEvent,
  Track,
  RemoteAudioTrack,
  ConnectionState,
  type AudioCaptureOptions,
  type TrackPublishOptions,
} from "livekit-client";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { CallDetail } from "@/actions/calls/get-call-action";
import { getCallAction } from "@/actions/calls/get-call-action";
import { acceptCallAction } from "@/actions/calls/accept-call-action";
import { endCallAction } from "@/actions/calls/end-call-action";
import { refreshCallTokenAction } from "@/actions/calls/refresh-call-token-action";
import { declineCallAction } from "@/actions/calls/decline-call-action";

// ============================================
// TYPES
// ============================================

type CallRoomProps = {
  call: CallDetail;
  myRole: "caller" | "receiver";
};

type CallState =
  | "incoming"
  | "connecting"
  | "ringing"
  | "connected"
  | "reconnecting"
  | "ended";

const TERMINAL_STATUSES = new Set([
  "ENDED",
  "MISSED",
  "DECLINED",
  "CANCELLED",
  "FAILED",
]);

const HANGUP_MESSAGE = "voxa:hangup";
const POLL_INTERVAL_MS = 2500;
const RING_TIMEOUT_MS = 60_000;

// ============================================
// AUDIO CONFIG (voice-call tuned)
// ============================================
//  - Capture constraints are set once (no applyConstraints later).
//  - No forced sampleRate: browser picks the best rate for its AEC.
//  - Remote audio plays through a plain <audio> element
//    (webAudioMix off) so it stays the AEC reference.
//  - No extra gain/processing on top of the browser's.
//  - DTX off: avoids clipped word starts. RED on: survives packet loss.

const AUDIO_CAPTURE_OPTIONS: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

const AUDIO_PUBLISH_OPTIONS: TrackPublishOptions = {
  audioPreset: { maxBitrate: 48_000 }, // mono Opus, clear voice
  dtx: false,
  red: true,
  forceStereo: false,
  stopMicTrackOnMute: false, // instant unmute, no permission re-prompt
};

// ============================================
// CALL ROOM COMPONENT
// ============================================

export function CallRoom({ call, myRole }: CallRoomProps) {
  const router = useRouter();

  const [state, setState] = React.useState<CallState>(() =>
    myRole === "receiver" && call.status === "RINGING"
      ? "incoming"
      : "connecting",
  );
  const [muted, setMuted] = React.useState(false);
  const [speakerMuted, setSpeakerMuted] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [micAvailable, setMicAvailable] = React.useState(true);
  const [audioBlocked, setAudioBlocked] = React.useState(false);
  const [declining, setDeclining] = React.useState(false);

  const roomRef = React.useRef<Room | null>(null);
  const audioElRef = React.useRef<HTMLAudioElement | null>(null);
  const remoteTracksRef = React.useRef<Map<string, RemoteAudioTrack>>(
    new Map(),
  );
  const startedRef = React.useRef(false); // connect only once
  const mountedRef = React.useRef(false); // Strict-Mode safe
  const finishedRef = React.useRef(false); // leave screen only once
  const endedServerRef = React.useRef(false); // call endCallAction only once
  const speakerMutedRef = React.useRef(speakerMuted);

  React.useEffect(() => {
    speakerMutedRef.current = speakerMuted;
  }, [speakerMuted]);

  const otherName = myRole === "caller" ? call.receiverName : call.callerName;
  const otherImage =
    myRole === "caller" ? call.receiverImageUrl : call.callerImageUrl;

  // ─────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────

  const leaveRoom = React.useCallback(() => {
    try {
      remoteTracksRef.current.forEach((t) => t.detach());
      remoteTracksRef.current.clear();
    } catch {}
    try {
      // Also stops and releases the local mic track
      roomRef.current?.disconnect();
    } catch {}
    roomRef.current = null;
  }, []);

  const finish = React.useCallback(
    (delayMs = 0) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setState("ended");
      leaveRoom();
      if (delayMs > 0) {
        setTimeout(() => router.replace("/app"), delayMs);
      } else {
        router.replace("/app");
      }
    },
    [router, leaveRoom],
  );

  const endOnServer = React.useCallback(async () => {
    if (endedServerRef.current) return;
    endedServerRef.current = true;
    try {
      await endCallAction({ callId: call.id });
    } catch (err) {
      console.error("[CallRoom] endCall error:", err);
    }
  }, [call.id]);

  // ─────────────────────────────────────────
  // Mount / unmount + full cleanup
  // ─────────────────────────────────────────

  React.useEffect(() => {
    mountedRef.current = true;

    const onPageHide = () => {
      try {
        roomRef.current?.disconnect();
      } catch {}
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", onPageHide);
      leaveRoom();
    };
  }, [leaveRoom]);

  // ─────────────────────────────────────────
  // Duration timer
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (state !== "connected") return;

    const start = call.answeredAt
      ? new Date(call.answeredAt).getTime()
      : Date.now();
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state, call.answeredAt]);

  // ─────────────────────────────────────────
  // Keep screen awake during the call
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (state !== "connected" && state !== "ringing") return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    try {
      (navigator as any).wakeLock
        ?.request("screen")
        .then((l: any) => {
          if (cancelled) l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    } catch {}

    return () => {
      cancelled = true;
      lock?.release().catch(() => {});
    };
  }, [state]);

  // ─────────────────────────────────────────
  // Server status watcher — if the other side declined / cancelled /
  // ended, close this screen too (works even before anyone joined LiveKit)
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (state === "ended") return;
    let cancelled = false;

    const id = setInterval(async () => {
      try {
        const res = await getCallAction({ callId: call.id });
        if (cancelled || finishedRef.current || !res.success) return;
        if (TERMINAL_STATUSES.has(res.call.status)) {
          endedServerRef.current = true; // already ended server-side
          finish(state === "incoming" ? 0 : 800);
        }
      } catch {}
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [state, call.id, finish]);

  // ─────────────────────────────────────────
  // Ring timeout (caller waiting, nobody picks up)
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (state !== "ringing" || myRole !== "caller") return;
    const id = setTimeout(async () => {
      await endOnServer();
      finish(0);
    }, RING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [state, myRole, endOnServer, finish]);

  // ─────────────────────────────────────────
  // Speaker mute (uses .muted — `.volume` is read-only on iOS Safari)
  // Also (re)attaches any remote track that arrived before <audio> mounted.
  // ─────────────────────────────────────────

  React.useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    el.muted = speakerMuted;
    remoteTracksRef.current.forEach((t) => t.attach(el));
  }, [speakerMuted, state]);

  // ─────────────────────────────────────────
  // Connect to LiveKit
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (state !== "connecting" || startedRef.current) return;
    startedRef.current = true;

    async function connect() {
      try {
        let token: string;
        let serverUrl: string;

        if (myRole === "receiver" && call.status === "RINGING") {
          const accept = await acceptCallAction({ callId: call.id });
          if (!accept.success) {
            setError(accept.error);
            return;
          }
          token = accept.token;
          serverUrl = accept.serverUrl;
        } else {
          const refresh = await refreshCallTokenAction({ callId: call.id });
          if (!refresh.success) {
            setError(refresh.error);
            return;
          }
          token = refresh.token;
          serverUrl = refresh.serverUrl;
        }

        if (!mountedRef.current || finishedRef.current) return;

        const room = new Room({
          webAudioMix: false, // keep AEC reference intact
          audioCaptureDefaults: AUDIO_CAPTURE_OPTIONS,
          publishDefaults: AUDIO_PUBLISH_OPTIONS,
        });
        roomRef.current = room;

        // ── Participants ──
        room.on(RoomEvent.ParticipantConnected, () => setState("connected"));

        room.on(RoomEvent.ParticipantDisconnected, async () => {
          // Only end when nobody is left (tolerates brief drops)
          if (room.remoteParticipants.size > 0) return;
          await endOnServer();
          finish(800);
        });

        // ── Explicit hang-up message from the other side ──
        room.on(RoomEvent.DataReceived, async (payload) => {
          try {
            if (new TextDecoder().decode(payload) === HANGUP_MESSAGE) {
              await endOnServer();
              finish(800);
            }
          } catch {}
        });

        // ── Remote audio ──
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio) return;
          const remote = track as RemoteAudioTrack;
          remoteTracksRef.current.set(track.sid ?? "", remote);

          const el = audioElRef.current;
          if (el) {
            remote.attach(el);
            el.muted = speakerMutedRef.current;
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio) return;
          remoteTracksRef.current.delete(track.sid ?? "");
          track.detach();
        });

        // ── Autoplay blocked (Safari / iOS) ──
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setAudioBlocked(!room.canPlaybackAudio);
        });

        // ── Connection health ──
        room.on(RoomEvent.ConnectionStateChanged, (cs) => {
          if (cs === ConnectionState.Reconnecting) {
            setState("reconnecting");
          } else if (cs === ConnectionState.Connected) {
            setState((prev) =>
              prev === "reconnecting"
                ? room.remoteParticipants.size > 0
                  ? "connected"
                  : "ringing"
                : prev,
            );
          }
        });
        room.on(RoomEvent.Disconnected, () => finish(0));

        // ── Join ──
        await room.connect(serverUrl, token);

        if (!mountedRef.current || finishedRef.current) {
          room.disconnect();
          return;
        }

        // Unlock audio playback
        try {
          await room.startAudio();
        } catch {}
        setAudioBlocked(!room.canPlaybackAudio);

        // ── Publish mic (single, consistent pipeline) ──
        try {
          await room.localParticipant.setMicrophoneEnabled(
            true,
            AUDIO_CAPTURE_OPTIONS,
            AUDIO_PUBLISH_OPTIONS,
          );
          setMicAvailable(true);
        } catch (micErr: any) {
          console.warn("[CallRoom] mic unavailable:", micErr?.message);
          setMicAvailable(false);
        }

        if (finishedRef.current) {
          room.disconnect();
          return;
        }

        setState(room.remoteParticipants.size > 0 ? "connected" : "ringing");
      } catch (err: any) {
        console.error("[CallRoom] connect error:", err);
        setError(err?.message ?? "Failed to connect.");
      }
    }

    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, call.id, call.status, myRole, finish, endOnServer]);

  // ─────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────

  function handleAccept() {
    if (declining) return;
    setError(null);
    setState("connecting");
  }

  async function handleDecline() {
    if (declining) return;
    setDeclining(true);
    try {
      await declineCallAction({ callId: call.id });
    } catch (err) {
      console.error("[CallRoom] decline error:", err);
    }
    endedServerRef.current = true;
    finish(0);
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    try {
      const nextMuted = !muted;
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setMuted(nextMuted);
    } catch (err) {
      console.error("[CallRoom] toggleMute error:", err);
    }
  }

  function toggleSpeaker() {
    setSpeakerMuted((prev) => !prev);
  }

  async function enableAudio() {
    try {
      await roomRef.current?.startAudio();
      setAudioBlocked(!(roomRef.current?.canPlaybackAudio ?? true));
    } catch {}
  }

  async function hangUp() {
    // Tell the other side instantly, then end on the server
    try {
      await roomRef.current?.localParticipant.publishData(
        new TextEncoder().encode(HANGUP_MESSAGE),
        { reliable: true },
      );
    } catch {}
    await endOnServer();
    finish(0);
  }

  const initial = otherName?.charAt(0).toUpperCase() ?? "?";

  // ─────────────────────────────────────────
  // RENDER — INCOMING (receiver)
  // ─────────────────────────────────────────

  if (state === "incoming") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="relative flex size-40 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span
            className="absolute inset-4 animate-ping rounded-full bg-primary/15"
            style={{ animationDelay: "0.3s" }}
          />

          <div className="relative z-10">
            {otherImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={otherImage}
                alt={otherName ?? "User"}
                className="size-32 rounded-full object-cover shadow-2xl ring-4 ring-background"
              />
            ) : (
              <div className="flex size-32 items-center justify-center rounded-full bg-muted text-5xl font-semibold text-muted-foreground shadow-2xl ring-4 ring-background">
                {initial}
              </div>
            )}
          </div>
        </div>

        <h1 className="mt-8 text-3xl font-semibold">{otherName ?? "Unknown"}</h1>
        <p className="mt-2 animate-pulse text-base text-muted-foreground">
          Incoming VOXA call...
        </p>

        <div className="mt-12 flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleDecline}
              disabled={declining}
              className={cn(
                "flex size-16 items-center justify-center rounded-full",
                "bg-destructive text-white shadow-lg shadow-destructive/30",
                "transition-transform hover:scale-105 active:scale-95",
                "disabled:opacity-70 disabled:hover:scale-100",
              )}
              aria-label="Decline"
            >
              {declining ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <PhoneOff className="size-6" strokeWidth={2.5} />
              )}
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              Decline
            </span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={declining}
              className={cn(
                "flex size-16 items-center justify-center rounded-full",
                "bg-green-500 text-white shadow-lg shadow-green-500/30",
                "transition-transform hover:scale-105 active:scale-95",
                "disabled:opacity-50 disabled:hover:scale-100",
              )}
              aria-label="Accept"
            >
              <Phone className="size-6" strokeWidth={2.5} />
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              Accept
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // RENDER — CONNECTING / RINGING / CONNECTED
  // ─────────────────────────────────────────

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Stable ref (no inline callback) so the element never re-mounts */}
      <audio ref={audioElRef} autoPlay playsInline />

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative">
          {(state === "ringing" ||
            state === "connecting" ||
            state === "reconnecting") && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <span
                className="absolute inset-4 animate-ping rounded-full bg-primary/15"
                style={{ animationDelay: "0.3s" }}
              />
            </>
          )}

          {otherImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={otherImage}
              alt={otherName ?? "User"}
              className="relative z-10 size-32 rounded-full object-cover ring-4 ring-background"
            />
          ) : (
            <div className="relative z-10 flex size-32 items-center justify-center rounded-full bg-muted text-4xl font-semibold text-muted-foreground ring-4 ring-background">
              {initial}
            </div>
          )}

          {state === "connected" && (
            <span className="absolute -right-1 -bottom-1 z-20 flex size-6 items-center justify-center rounded-full border-2 border-background bg-green-500">
              <Volume2 className="size-3 text-white" />
            </span>
          )}
        </div>

        <h1 className="mt-6 text-2xl font-semibold">{otherName ?? "Unknown"}</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {state === "connecting" && "Connecting..."}
          {state === "ringing" && "Ringing..."}
          {state === "connected" && formatTime(elapsed)}
          {state === "reconnecting" && "Reconnecting..."}
          {state === "ended" && "Call ended"}
        </p>

        {error && (
          <p className="mt-4 max-w-xs text-center text-xs text-destructive">
            {error}
          </p>
        )}

        {audioBlocked && (
          <button
            type="button"
            onClick={enableAudio}
            className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            Tap to enable audio
          </button>
        )}

        {!micAvailable && state === "connected" && (
          <p className="mt-2 max-w-xs text-center text-xs text-yellow-600">
            Mic unavailable — you can hear them but they can&apos;t hear you.
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 pb-12">
        <button
          type="button"
          onClick={toggleMute}
          disabled={state !== "connected" || !micAvailable}
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            "transition-colors duration-200",
            state !== "connected" || !micAvailable
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : muted
                ? "bg-foreground text-background"
                : "bg-muted text-foreground hover:bg-muted/70",
          )}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>

        <button
          type="button"
          onClick={toggleSpeaker}
          disabled={state !== "connected"}
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            "transition-colors duration-200",
            state !== "connected"
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : speakerMuted
                ? "bg-foreground text-background"
                : "bg-muted text-foreground hover:bg-muted/70",
          )}
          aria-label={speakerMuted ? "Unmute speaker" : "Mute speaker"}
        >
          {speakerMuted ? (
            <VolumeX className="size-5" />
          ) : (
            <Volume2 className="size-5" />
          )}
        </button>

        <button
          type="button"
          onClick={hangUp}
          className="flex size-16 items-center justify-center rounded-full bg-destructive text-white transition-opacity hover:opacity-90"
          aria-label="Hang up"
        >
          <PhoneOff className="size-6" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}