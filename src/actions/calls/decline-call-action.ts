// src/actions/calls/decline-call-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { publishToInbox } from "@/lib/livekit/publish-to-inbox";

type DeclineCallInput = { callId: string };

type DeclineCallResult =
  | { success: true }
  | { success: false; error: string };

export async function declineCallAction(
  input: DeclineCallInput,
): Promise<DeclineCallResult> {
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
        receiverId: true,
        status: true,
        callerId: true,
      },
    });

    if (!call) return { success: false, error: "Call not found." };
    if (call.receiverId !== me.id) {
      return { success: false, error: "Not your call." };
    }
    if (call.status !== "RINGING") {
      return { success: true };
    }

    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: "DECLINED",
        endedAt: new Date(),
        durationSeconds: 0,
      },
    });

    // ⚠️ Internal id, not clerkId
    await publishToInbox(call.callerId, {
      type: "CALL_CANCELLED",
      callId: call.id,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[declineCallAction] 💥 Error:", err?.message);
    return { success: false, error: "Failed to decline call." };
  }
}