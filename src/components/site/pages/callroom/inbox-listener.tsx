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
import { emitChatMessage } from "@/lib/chat/chat-events";

type InboxEvent =
  | {
      type: "CALL_INCOMING";
      callId: string;
      callerName: string;
      callerImageUrl: string | null;
    }
  | { type: "CALL_ACCEPTED"; callId: string }
  | { type: "CALL_ENDED"; callId: string }
  | { type: "CALL_CANCELLED"; callId: string }
  | {
      type: "MESSAGE_NEW";
      conversationId: string;
      senderId: string;
      preview: string;
    };

type IncomingCall = {
  callId: string;
  callerName: string;
  callerImageUrl: string | null;
};

type PendingAction = "accept" | "decline" | null;

export function InboxListener() {
  const router = useRouter();
  const pathname = usePathname();

  const [incoming, setIncoming] = React.useState<IncomingCall | null>(null);
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null);
  const [tabVisible, setTabVisible] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const roomRef = React.useRef<Room | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const vibrateIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const notificationRef = React.useRef<Notification | null>(null);

  const onCallPage = pathname?.startsWith("/app/call");

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

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    function update() {
      setTabVisible(document.visibilityState === "visible");
    }

    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

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
              setPendingAction(null);

              if (document.visibilityState === "hidden") {
                showSystemNotification(call);
              }
            } else if (
              event.type === "CALL_ACCEPTED" ||
              event.type === "CALL_CANCELLED" ||
              event.type === "CALL_ENDED"
            ) {
              setIncoming((prev) =>
                prev && prev.callId === event.callId ? null : prev,
              );
              setPendingAction(null);
            } else if (event.type === "MESSAGE_NEW") {
              console.log("[InboxListener] MESSAGE_NEW received", {
                conversationId: event.conversationId,
                senderId: event.senderId,
              });
              emitChatMessage({
                conversationId: event.conversationId,
                senderId: event.senderId,
              });
            }
          } catch (err) {
            console.error("[InboxListener] parse error:", err);
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          console.warn("[InboxListener] disconnected");
        });

        await room.connect(result.serverUrl, result.token);
        console.log("[InboxListener] connected to inbox");
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

  React.useEffect(() => {
    if (incoming) {
      startRinging();
    } else {
      stopRinging();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.callId]);

  function haptic(pattern: number | number[]) {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {}
  }

  async function handleAccept() {
    if (!incoming || pendingAction) return;

    haptic(50);
    setPendingAction("accept");
    setError(null);
    stopRinging();

    const result = await acceptCallAction({ callId: incoming.callId });

    if (!result.success) {
      setError(result.error);
      setPendingAction(null);
      return;
    }

    router.push(`/app/call/${incoming.callId}`);
  }

  function handleDecline() {
    if (!incoming || pendingAction) return;

    haptic(50);
    stopRinging();

    declineCallAction({ callId: incoming.callId }).catch(() => {});

    setIncoming(null);
    setPendingAction(null);
  }

  if (!incoming || onCallPage || !tabVisible) return null;

  const initial = incoming.callerName.charAt(0).toUpperCase();
  const accepting = pendingAction === "accept";

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background px-6 text-center">
      <div className="w-full max-w-sm">
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

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-12 flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleDecline}
              disabled={accepting}
              className={cn(
                "flex size-16 items-center justify-center rounded-full",
                "bg-destructive text-white shadow-lg shadow-destructive/30",
                "transition-transform active:scale-95",
                "hover:scale-105",
                accepting && "cursor-not-allowed opacity-40",
              )}
              aria-label="Decline call"
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
              disabled={accepting}
              className={cn(
                "flex size-16 items-center justify-center rounded-full",
                "bg-green-500 text-white shadow-lg shadow-green-500/30",
                "transition-transform active:scale-95",
                "hover:scale-105",
                accepting && "cursor-wait",
              )}
              aria-label="Accept call"
            >
              {accepting ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Phone className="size-6" strokeWidth={2.5} />
              )}
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              {accepting ? "Connecting..." : "Accept"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}