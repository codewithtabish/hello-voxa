// src/components/app/screens/app/push-subscriber.tsx
"use client";

import * as React from "react";

import { subscribeAction } from "@/actions/push/subscribe-action";

// ============================================
// HELPERS
// ============================================

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ============================================
// PUSH SUBSCRIBER
// ============================================

export function PushSubscriber() {
  React.useEffect(() => {
    let cancelled = false;

    async function register() {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator)) return;
      if (!("PushManager" in window)) return;
      if (!("Notification" in window)) return;

      // 1. Ask permission
      if (Notification.permission === "default") {
        try {
          const p = await Notification.requestPermission();
          if (p !== "granted") return;
        } catch {
          return;
        }
      }
      if (Notification.permission !== "granted") return;

      // 2. Register service worker
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.warn("[PushSubscriber] SW registration failed:", err);
        return;
      }

      await navigator.serviceWorker.ready;

      if (cancelled) return;

      // 3. Subscribe
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn("[PushSubscriber] missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
        return;
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        } catch (err) {
          console.warn("[PushSubscriber] subscribe failed:", err);
          return;
        }
      }

      // 4. Send to server
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      await subscribeAction({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        userAgent: navigator.userAgent,
      });
    }

    register();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}