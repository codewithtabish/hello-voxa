// src/components/app/screens/app/inbox-listener.tsx
"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Room, RoomEvent } from "livekit-client";
import { Phone, PhoneOff, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { getInboxTokenAction } from "@/actions/livekit/get-inbox-token-action";
import { acceptCallAction } from "@/actions/calls/accept-call-action";
import { declineCallAction } from "@/actions/calls/decline-call-action";

// ============================================
// TYPES
// ============================================

type InboxEvent =
  | {
      type: "CALL_INCOMING";
      callId: string;
      callerName: string;
      callerImageUrl: string | null;
    }
  | { type: "CALL_ENDED"; callId: string }
  | { type: "CALL_CANCELLED"; callId: string };

type IncomingCall = {
  callId: string;
  callerName: string;
  callerImageUrl: string | null;
};

// ============================================
// INBOX LISTENER
// ============================================

export function InboxListener() {
  const router = useRouter();
  const pathname = usePathname();

  const [incoming, setIncoming] = React.useState<IncomingCall | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [tabVisible, setTabVisible] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const roomRef = React.useRef<Room | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const vibrateIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const notificationRef = React.useRef<Notification | null>(null);

  const onCallPage = pathname?.startsWith("/app/call");

  // ─────────────────────────────────────────
  // Request notification permission (once)
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []);

  // ─────────────────────────────────────────
  // Track tab visibility
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    function update() {
      setTabVisible(document.visibilityState === "visible");
    }

    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // ─────────────────────────────────────────
  // Ringtone + vibration
  // ─────────────────────────────────────────

  function startRinging() {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/ringtone.mp3");
        audioRef.current.loop = true;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}

    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        const pattern = [400, 200, 400, 800];
        navigator.vibrate(pattern);
        vibrateIntervalRef.current = setInterval(() => {
          navigator.vibrate(pattern);
        }, 2000);
      }
    } catch {}
  }

  function stopRinging() {
    try {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    } catch {}

    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(0);
      }
    } catch {}

    if (vibrateIntervalRef.current) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }

    try {
      notificationRef.current?.close();
      notificationRef.current = null;
    } catch {}
  }

  // ─────────────────────────────────────────
  // OS notification
  // ─────────────────────────────────────────

  function showSystemNotification(call: IncomingCall) {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      const n = new Notification("Incoming VOXA call", {
        body: `${call.callerName} is calling...`,
        icon: call.callerImageUrl ?? "/icon.png",
        badge: "/icon.png",
        tag: `call_${call.callId}`,
        requireInteraction: true,
        silent: false,
      });

      notificationRef.current = n;

      n.onclick = () => {
        window.focus();
        router.push(`/app/call/${call.callId}`);
        n.close();
      };

      setTimeout(() => {
        try {
          n.close();
        } catch {}
      }, 30_000);
    } catch (err) {
      console.warn("[InboxListener] notification error:", err);
    }
  }

  // ─────────────────────────────────────────
  // Connect to inbox
  // ─────────────────────────────────────────

  React.useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const result = await getInboxTokenAction();
        if (!result.success) {
          console.error("[InboxListener]", result.error);
          return;
        }
        if (cancelled) return;

        const room = new Room({ adaptiveStream: false, dynacast: false });
        roomRef.current = room;

        room.on(RoomEvent.DataReceived, (payload) => {
          try {
            const text = new TextDecoder().decode(payload);
            const event = JSON.parse(text) as InboxEvent;

            if (event.type === "CALL_INCOMING") {
              const call = {
                callId: event.callId,
                callerName: event.callerName,
                callerImageUrl: event.callerImageUrl,
              };

              setIncoming(call);
              setError(null);

              if (document.visibilityState === "hidden") {
                showSystemNotification(call);
              }
            } else if (
              event.type === "CALL_CANCELLED" ||
              event.type === "CALL_ENDED"
            ) {
              setIncoming((prev) =>
                prev && prev.callId === event.callId ? null : prev,
              );
            }
          } catch (err) {
            console.error("[InboxListener] parse error:", err);
          }
        });

        await room.connect(result.serverUrl, result.token);
      } catch (err: any) {
        console.error("[InboxListener] connect error:", err?.message);
      }
    }

    connect();

    return () => {
      cancelled = true;
      stopRinging();
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  // ─────────────────────────────────────────
  // React to incoming changes
  // ─────────────────────────────────────────

  React.useEffect(() => {
    if (incoming) {
      startRinging();
    } else {
      stopRinging();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.callId]);

  // ─────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────

  async function handleAccept() {
    if (!incoming || processing) return;
    setProcessing(true);
    setError(null);
    stopRinging();

    // Accept the call FIRST — sets status to CONNECTED in the DB
    const result = await acceptCallAction({ callId: incoming.callId });

    if (!result.success) {
      setError(result.error);
      setProcessing(false);
      return;
    }

    // Then navigate — CallRoom will see status = CONNECTED and skip "incoming"
    router.push(`/app/call/${incoming.callId}`);
  }

  async function handleDecline() {
    if (!incoming || processing) return;
    setProcessing(true);
    setError(null);
    stopRinging();

    await declineCallAction({ callId: incoming.callId });

    setIncoming(null);
    setProcessing(false);
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  if (!incoming || onCallPage || !tabVisible) return null;

  const initial = incoming.callerName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background px-6 text-center">
      <div className="w-full max-w-sm">
        {/* Pulsing avatar */}
        <div className="relative mx-auto flex size-40 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span
            className="absolute inset-4 animate-ping rounded-full bg-primary/15"
            style={{ animationDelay: "0.3s" }}
          />

          <div className="relative z-10">
            {incoming.callerImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={incoming.callerImageUrl}
                alt={incoming.callerName}
                className="size-32 rounded-full object-cover shadow-2xl ring-4 ring-background"
              />
            ) : (
              <div className="flex size-32 items-center justify-center rounded-full bg-muted text-5xl font-semibold text-muted-foreground shadow-2xl ring-4 ring-background">
                {initial}
              </div>
            )}
          </div>
        </div>

        <h2 className="mt-8 text-3xl font-semibold text-foreground">
          {incoming.callerName}
        </h2>
        <p className="mt-2 animate-pulse text-base text-muted-foreground">
          Incoming VOXA call...
        </p>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        <div className="mt-12 flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleDecline}
              disabled={processing}
              className={cn(
                "flex size-16 items-center justify-center rounded-full",
                "bg-destructive text-white shadow-lg shadow-destructive/30",
                "transition-transform hover:scale-105 active:scale-95",
                processing && "cursor-not-allowed opacity-60",
              )}
              aria-label="Decline call"
            >
              {processing ? (
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
              disabled={processing}
              className={cn(
                "flex size-16 items-center justify-center rounded-full",
                "bg-green-500 text-white shadow-lg shadow-green-500/30",
                "transition-transform hover:scale-105 active:scale-95",
                processing && "cursor-not-allowed opacity-60",
              )}
              aria-label="Accept call"
            >
              {processing ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Phone className="size-6" strokeWidth={2.5} />
              )}
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              Accept
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}