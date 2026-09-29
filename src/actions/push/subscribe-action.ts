// src/actions/push/subscribe-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type SubscribeInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
};

type SubscribeResult =
  | { success: true }
  | { success: false; error: string };

// ═══════════════════════════════════════════════════════════
// ACTION
// ═══════════════════════════════════════════════════════════

export async function subscribeAction(
  input: SubscribeInput,
): Promise<SubscribeResult> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) return { success: false, error: "User not found." };

    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
      update: {
        userId: user.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[subscribeAction] 💥 Error:", err?.message);
    return { success: false, error: "Failed to subscribe." };
  }
}