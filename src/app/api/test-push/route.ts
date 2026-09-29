// src/app/api/test-push/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { sendPushToUser } from "@/lib/push/send-push";

// ============================================
// TEST PUSH ROUTE
// ============================================
//
// Sends a real push to the current logged-in user.
// Use this to verify the whole pipeline:
//   server → web-push → FCM → service worker → notification
//
// Visit: /api/test-push
//

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated. Sign in first." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "User not found in DB." },
        { status: 404 },
      );
    }

    // Check how many subscriptions this user has
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: user.id },
      select: { id: true, endpoint: true, userAgent: true },
    });

    if (subs.length === 0) {
      return NextResponse.json({
        ok: false,
        error:
          "No push subscriptions found for your account. " +
          "Open /app once so PushSubscriber can register, then retry.",
        userId: user.id,
        email: user.email,
      });
    }

    // Send the push
    await sendPushToUser(user.id, {
      title: "Test push from VOXA",
      body: "If you see this, Web Push works end-to-end!",
      callId: "test_" + Date.now(),
      url: "/app",
    });

    return NextResponse.json({
      ok: true,
      message: "Push sent to " + subs.length + " device(s)",
      userId: user.id,
      email: user.email,
      subscriptions: subs.map((s) => ({
        endpointPrefix: s.endpoint.slice(0, 60) + "...",
        userAgent: s.userAgent,
      })),
    });
  } catch (err: any) {
    console.error("[test-push] 💥 Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}