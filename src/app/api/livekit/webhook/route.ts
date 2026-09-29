// src/app/api/livekit/webhook/route.ts
import { NextResponse } from "next/server";

import prisma from "@/lib/clients/prisma-client";
import { verifyLiveKitWebhook } from "@/lib/livekit/webhook";

// ============================================
// POST /api/livekit/webhook
// ============================================
//
// LiveKit posts room lifecycle events here.
//
// This is a SAFETY NET — the client also calls
// endCallAction directly. Both write to the same
// Call row. The second one is a no-op.
//

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const authHeader = req.headers.get("authorization");

    const event = await verifyLiveKitWebhook(body, authHeader);

    const roomName = event.room?.name ?? "";

    if (roomName.startsWith("call_")) {
      const callId = roomName.slice("call_".length);
      await finalizeCall(callId);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[LiveKit webhook] 💥 Error:", err?.message);
    return NextResponse.json(
      { ok: false, error: "Webhook rejected" },
      { status: 401 },
    );
  }
}

// ============================================
// FINALIZE CALL
// ============================================

async function finalizeCall(callId: string) {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      id: true,
      status: true,
      answeredAt: true,
      callerId: true,
      receiverId: true,
    },
  });

  if (!call) return;

  if (
    call.status === "ENDED" ||
    call.status === "MISSED" ||
    call.status === "DECLINED" ||
    call.status === "CANCELLED"
  ) {
    return;
  }

  const now = new Date();

  if (!call.answeredAt) {
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: "MISSED",
        endedAt: now,
      },
    });
    return;
  }

  const durationSeconds = Math.max(
    0,
    Math.floor((now.getTime() - call.answeredAt.getTime()) / 1000),
  );

  await prisma.call.update({
    where: { id: call.id },
    data: {
      status: "ENDED",
      endedAt: now,
      durationSeconds,
    },
  });

  await prisma.user.updateMany({
    where: { id: { in: [call.callerId, call.receiverId] } },
    data: { totalCalls: { increment: 1 } },
  });
}