// src/components/app/screens/call/call-room.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Room,
  RoomEvent,
  Track,
  LocalAudioTrack,
  RemoteAudioTrack,
  createLocalAudioTrack,
  AudioPresets,
  ConnectionState,
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
  | "incoming"       // receiver waiting for Accept
  | "connecting"     // connecting to LiveKit
  | "ringing"        // caller waiting for receiver to join
  | "connected"      // both parties in the call
  | "reconnecting"   // network dropped, LiveKit is retrying
  | "ended";         // call finished

// ============================================
// AUDIO CONFIG — voice-optimized
// ============================================

const AUDIO_CAPTURE_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

const REMOTE_AUDIO_VOLUME = 0.8; // 80% — reduces feedback loops

// ============================================
// CALL ROOM
// ============================================

export function CallRoom({ call, myRole }: CallRoomProps) {
  const router = useRouter();

  // ─────────────────────────────────────────
  // State
  // ─────────────────────────────────────────

  const [state, setState] = React.useState<CallState>(() => {
    if (myRole === "receiver" && call.status === "RINGING") return "incoming";
    return "connecting";
  });

  const [muted, setMuted] = React.useState(false);
  const [speakerMuted, setSpeakerMuted] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [micAvailable, setMicAvailable] = React.useState(true);

  // Refs
  const roomRef = React.useRef<Room | null>(null);
  const audioTrackRef = React.useRef<LocalAudioTrack | null>(null);
  const audioElRef = React.useRef<HTMLAudioElement | null>(null);
  const remoteTracksRef = React.useRef<Map<string, RemoteAudioTrack>>(new Map());

  const otherName =
    myRole === "caller" ? call.receiverName : call.callerName;
  const otherImage =
    myRole === "caller" ? call.receiverImageUrl : call.callerImageUrl;

  // ─────────────────────────────────────────
  // Duration timer
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (state !== "connected") return;

    const start = call.answeredAt
      ? new Date(call.answeredAt).getTime()
      : Date.now();

    setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));

    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);

    return () => clearInterval(id);
  }, [state, call.answeredAt]);

  // ─────────────────────────────────────────
  // Set remote audio volume once on mount
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (audioElRef.current) {
      audioElRef.current.volume = speakerMuted ? 0 : REMOTE_AUDIO_VOLUME;
    }
  }, [speakerMuted]);

  // ─────────────────────────────────────────
  // Connect to LiveKit
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (state !== "connecting") return;

    let cancelled = false;

    async function connect() {
      try {
        // ── Get token ──
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

        if (cancelled) return;

        // ── Create room with audio-optimized settings ──
        const room = new Room({
          adaptiveStream: false,     // no video, no need
          dynacast: false,           // no video, no need
          audioCaptureDefaults: AUDIO_CAPTURE_OPTIONS,
          // Voice-optimized publishing
          publishDefaults: {
            audioPreset: AudioPresets.speech, // 24 kbps voice
            dtx: true,                        // silence suppression
            red: true,                        // packet-loss resilience
            stopMicTrackOnMute: false,        // keep mic warm on mute
          },
        });

        roomRef.current = room;

        // ── Participant joined ──
        room.on(RoomEvent.ParticipantConnected, () => {
          setState("connected");
        });

        // ── Participant left ──
        room.on(RoomEvent.ParticipantDisconnected, async () => {
          try {
            await endCallAction({ callId: call.id });
          } catch {
            // ignore — likely already ended
          }
          setState("ended");
          setTimeout(() => router.replace("/app"), 1500);
        });

        // ── Remote audio arrived ──
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const remoteTrack = track as RemoteAudioTrack;
            remoteTracksRef.current.set(track.sid ?? "", remoteTrack);

            if (audioElRef.current) {
              remoteTrack.attach(audioElRef.current);
              audioElRef.current.volume = speakerMuted
                ? 0
                : REMOTE_AUDIO_VOLUME;
            }
          }
        });

        // ── Remote audio removed ──
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            remoteTracksRef.current.delete(track.sid ?? "");
            track.detach();
          }
        });

        // ── Connection state changes ──
        room.on(RoomEvent.ConnectionStateChanged, (connectionState) => {
          if (connectionState === ConnectionState.Reconnecting) {
            setState("reconnecting");
          } else if (connectionState === ConnectionState.Connected) {
            setState((prev) => (prev === "reconnecting" ? "connected" : prev));
          }
        });

        room.on(RoomEvent.Reconnecting, () => {
          setState("reconnecting");
        });

        room.on(RoomEvent.Reconnected, () => {
          setState("connected");
        });

        // ── Room disconnected ──
        room.on(RoomEvent.Disconnected, () => {
          setState("ended");
        });

        // ── Join ──
        await room.connect(serverUrl, token);

        if (cancelled) {
          room.disconnect();
          return;
        }

        // ── Publish mic ──
        try {
          const track = await createLocalAudioTrack(AUDIO_CAPTURE_OPTIONS);

          // Post-tune underlying MediaStreamTrack (best-effort)
          try {
            await track.mediaStreamTrack.applyConstraints({
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true },
            });
          } catch {
            // Non-fatal — browser may not support all constraints
          }

          audioTrackRef.current = track;

          await room.localParticipant.publishTrack(track, {
            audioPreset: AudioPresets.speech,
            dtx: true,
            red: true,
            stopMicTrackOnMute: false,
          });

          setMicAvailable(true);
        } catch (micErr: any) {
          console.warn("[CallRoom] mic unavailable:", micErr?.message);
          setMicAvailable(false);
          // Continue without mic — user can still hear the other side
        }

        // ── Decide state ──
        const remoteCount = Array.from(room.remoteParticipants.values()).length;

        if (remoteCount > 0) {
          setState("connected");
        } else {
          setState("ringing");
        }
      } catch (err: any) {
        console.error("[CallRoom] connect error:", err);
        setError(err?.message ?? "Failed to connect.");
      }
    }

    connect();

    return () => {
      cancelled = true;
    };
  }, [state, call.id, call.status, myRole, router, speakerMuted]);

  // ─────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────

  React.useEffect(() => {
    return () => {
      try {
        audioTrackRef.current?.stop();
        audioTrackRef.current = null;
      } catch {}

      try {
        remoteTracksRef.current.forEach((t) => t.detach());
        remoteTracksRef.current.clear();
      } catch {}

      try {
        roomRef.current?.disconnect();
        roomRef.current = null;
      } catch {}
    };
  }, []);

  // ─────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────

  async function handleAccept() {
    setError(null);
    setState("connecting");
  }

  async function handleDecline() {
    try {
      await declineCallAction({ callId: call.id });
    } catch (err) {
      console.error("[CallRoom] decline error:", err);
    }
    setState("ended");
    router.replace("/app");
  }

  async function toggleMute() {
    const track = audioTrackRef.current;
    if (!track) return;

    try {
      if (muted) {
        await track.unmute();
        setMuted(false);
      } else {
        await track.mute();
        setMuted(true);
      }
    } catch (err) {
      console.error("[CallRoom] toggleMute error:", err);
    }
  }

  function toggleSpeaker() {
    setSpeakerMuted((prev) => {
      const next = !prev;
      if (audioElRef.current) {
        audioElRef.current.volume = next ? 0 : REMOTE_AUDIO_VOLUME;
      }
      return next;
    });
  }

  async function hangUp() {
    try {
      await endCallAction({ callId: call.id });
    } catch (err) {
      console.error("[CallRoom] endCall error:", err);
    }

    try {
      audioTrackRef.current?.stop();
      audioTrackRef.current = null;
    } catch {}

    try {
      roomRef.current?.disconnect();
      roomRef.current = null;
    } catch {}

    setState("ended");
    router.replace("/app");
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

        <h1 className="mt-8 text-3xl font-semibold">
          {otherName ?? "Unknown"}
        </h1>
        <p className="mt-2 animate-pulse text-base text-muted-foreground">
          Incoming VOXA call...
        </p>

        <div className="mt-12 flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleDecline}
              className={cn(
                "flex size-16 items-center justify-center rounded-full",
                "bg-destructive text-white shadow-lg shadow-destructive/30",
                "transition-transform hover:scale-105 active:scale-95",
              )}
              aria-label="Decline"
            >
              <PhoneOff className="size-6" strokeWidth={2.5} />
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              Decline
            </span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleAccept}
              className={cn(
                "flex size-16 items-center justify-center rounded-full",
                "bg-green-500 text-white shadow-lg shadow-green-500/30",
                "transition-transform hover:scale-105 active:scale-95",
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
      {/* Remote audio element — volume set programmatically */}
      <audio
        ref={(el) => {
          audioElRef.current = el;
          if (el) el.volume = speakerMuted ? 0 : REMOTE_AUDIO_VOLUME;
        }}
        autoPlay
        playsInline
      />

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {/* Avatar with animations */}
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

        <h1 className="mt-6 text-2xl font-semibold">
          {otherName ?? "Unknown"}
        </h1>

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

        {!micAvailable && state === "connected" && (
          <p className="mt-2 max-w-xs text-center text-xs text-yellow-600">
            Mic unavailable — you can hear them but they can't hear you.
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 pb-12">
        {/* Mic */}
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

        {/* Speaker */}
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

        {/* Hang up */}
        <button
          type="button"
          onClick={hangUp}
          className="flex size-16 items-center justify-center rounded-full bg-destructive text-white transition-opacity hover:opacity-90"
          aria-label="Hang up"
        >
          {state === "connecting" ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <PhoneOff className="size-6" />
          )}
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