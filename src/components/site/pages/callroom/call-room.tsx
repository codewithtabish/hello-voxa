// src/components/app/screens/call/call-room.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Room,
  RoomEvent,
  Track,
  LocalAudioTrack,
  createLocalAudioTrack,
} from "livekit-client";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  Volume2,
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
  | "incoming"    // receiver waiting for Accept
  | "connecting"  // connecting to LiveKit
  | "ringing"     // caller waiting for receiver to join
  | "connected"   // both parties in the call
  | "ended";

// ============================================
// CALL ROOM
// ============================================

export function CallRoom({ call, myRole }: CallRoomProps) {
  const router = useRouter();

  // Initial state:
  //   receiver + RINGING → incoming screen
  //   caller + RINGING   → connecting → will become "ringing"
  //   anything else      → connecting
  const [state, setState] = React.useState<CallState>(() => {
    if (myRole === "receiver" && call.status === "RINGING") return "incoming";
    return "connecting";
  });

  const [muted, setMuted] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const roomRef = React.useRef<Room | null>(null);
  const audioTrackRef = React.useRef<LocalAudioTrack | null>(null);
  const audioElRef = React.useRef<HTMLAudioElement | null>(null);

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
  // Connect to LiveKit
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (state !== "connecting") return;

    let cancelled = false;

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

        if (cancelled) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        roomRef.current = room;

        // ── When the other participant joins the room ──
        room.on(RoomEvent.ParticipantConnected, () => {
          console.log("[CallRoom] ParticipantConnected");
          setState("connected");
        });

        // ── Remote audio ──
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio && audioElRef.current) {
            track.attach(audioElRef.current);
          }
        });

        // ── Other party left ──
        room.on(RoomEvent.ParticipantDisconnected, async () => {
          try {
            await endCallAction({ callId: call.id });
          } catch {
            // ignore
          }
          setState("ended");
          setTimeout(() => router.replace("/app"), 1500);
        });

        room.on(RoomEvent.Disconnected, () => {
          setState("ended");
        });

        // ── Join the room ──
        await room.connect(serverUrl, token);

        if (cancelled) {
          room.disconnect();
          return;
        }

        // ── Publish mic ──
        const track = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        audioTrackRef.current = track;
        await room.localParticipant.publishTrack(track);

        // ── Decide what to show after connecting ──
        // If the other participant is already here (receiver accepted
        // before we finished connecting, or we're the receiver),
        // → connected
        // Otherwise → ringing (wait for them)
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
  }, [state, call.id, call.status, myRole, router]);

  // ─────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────

  React.useEffect(() => {
    return () => {
      audioTrackRef.current?.stop();
      audioTrackRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
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

    if (muted) {
      await track.unmute();
      setMuted(false);
    } else {
      await track.mute();
      setMuted(true);
    }
  }

  async function hangUp() {
    try {
      await endCallAction({ callId: call.id });
    } catch (err) {
      console.error("[CallRoom] endCall error:", err);
    }

    audioTrackRef.current?.stop();
    audioTrackRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;

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
  // RENDER — CONNECTING / RINGING / CONNECTED / ENDED
  // ─────────────────────────────────────────

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <audio ref={audioElRef} autoPlay playsInline />

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative">
          {/* Caller side shows pulse animation while ringing */}
          {state === "ringing" && (
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
          {state === "ended" && "Call ended"}
        </p>

        {error && (
          <p className="mt-4 max-w-xs text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 pb-12">
        <button
          type="button"
          onClick={toggleMute}
          disabled={state !== "connected"}
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            "transition-colors duration-200",
            state !== "connected"
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