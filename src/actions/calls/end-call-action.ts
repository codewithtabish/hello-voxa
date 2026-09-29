// src/actions/calls/end-call-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { publishToInbox } from "@/lib/livekit/publish-to-inbox";

type EndCallInput = { callId: string };

type EndCallResult = { success: true } | { success: false; error: string };

export async function endCallAction(
  input: EndCallInput,
): Promise<EndCallResult> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    const me = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!me) return { success: false, error: "User not found." };

    const call = await prisma.call.findUnique({
      where: { id: input.callId },
      select: {
        id: true,
        callerId: true,
        receiverId: true,
        status: true,
        answeredAt: true,
      },
    });

    if (!call) return { success: false, error: "Call not found." };
    if (call.callerId !== me.id && call.receiverId !== me.id) {
      return { success: false, error: "Not a participant in this call." };
    }

    if (
      call.status === "ENDED" ||
      call.status === "MISSED" ||
      call.status === "DECLINED" ||
      call.status === "CANCELLED"
    ) {
      return { success: true };
    }

    const now = new Date();
    const durationSeconds = call.answeredAt
      ? Math.max(
          0,
          Math.floor((now.getTime() - call.answeredAt.getTime()) / 1000),
        )
      : 0;

    await prisma.call.update({
      where: { id: call.id },
      data: { status: "ENDED", endedAt: now, durationSeconds },
    });

    await prisma.user.updateMany({
      where: { id: { in: [call.callerId, call.receiverId] } },
      data: { totalCalls: { increment: 1 } },
    });

    // ⚠️ Internal ids, not clerkIds
    await publishToInbox(call.callerId, {
      type: "CALL_ENDED",
      callId: call.id,
    });
    await publishToInbox(call.receiverId, {
      type: "CALL_ENDED",
      callId: call.id,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[endCallAction] 💥 Error:", err?.message);
    return { success: false, error: "Failed to end call." };
  }
}