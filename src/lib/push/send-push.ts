// src/lib/push/send-push.ts
import webpush from "web-push";

import prisma from "@/lib/clients/prisma-client";

// ============================================
// CONFIG
// ============================================

let configured = false;

function configure() {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@voxa.app";

  if (!publicKey || !privateKey) {
    throw new Error(
      "Missing VAPID keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY",
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// ============================================
// SEND TO ONE SUBSCRIPTION
// ============================================

async function sendToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: sub.endpoint },
      });
      console.warn("[sendPush] pruned dead subscription");
    } else {
      console.warn("[sendPush] failed:", err?.message);
    }
    return false;
  }
}

// ============================================
// SEND TO ALL USER'S DEVICES
// ============================================

export async function sendPushToUser(
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    configure();

    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, p256dh: true, auth: true },
    });

    if (subs.length === 0) return;

    await Promise.all(subs.map((s) => sendToSubscription(s, payload)));
  } catch (err: any) {
    console.warn("[sendPushToUser] failed:", err?.message);
  }
}