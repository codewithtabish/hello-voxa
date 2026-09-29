// src/actions/calls/get-call-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";

type GetCallInput = {
  callId: string;
};

export type CallDetail = {
  id: string;
  status: "RINGING" | "CONNECTED" | "ENDED" | "MISSED" | "DECLINED" | "CANCELLED" | "FAILED";
  livekitRoomName: string;
  callerId: string;
  receiverId: string;
  callerClerkId: string;
  receiverClerkId: string;
  callerName: string | null;
  receiverName: string | null;
  callerImageUrl: string | null;
  receiverImageUrl: string | null;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  initiatedAt: Date;
};

type GetCallResult =
  | { success: true; call: CallDetail; myRole: "caller" | "receiver" }
  | { success: false; error: string };

export async function getCallAction(
  input: GetCallInput,
): Promise<GetCallResult> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    const call = await prisma.call.findUnique({
      where: { id: input.callId },
      select: {
        id: true,
        status: true,
        livekitRoomName: true,
        callerId: true,
        receiverId: true,
        answeredAt: true,
        endedAt: true,
        durationSeconds: true,
        initiatedAt: true,
        caller: {
          select: {
            clerkId: true,
            firstName: true,
            lastName: true,
            username: true,
            imageUrl: true,
          },
        },
        receiver: {
          select: {
            clerkId: true,
            firstName: true,
            lastName: true,
            username: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!call) return { success: false, error: "Call not found." };

    if (call.caller.clerkId !== clerkId && call.receiver.clerkId !== clerkId) {
      return { success: false, error: "Not a participant in this call." };
    }

    const myRole: "caller" | "receiver" =
      call.caller.clerkId === clerkId ? "caller" : "receiver";

    const callerName =
      [call.caller.firstName, call.caller.lastName].filter(Boolean).join(" ") ||
      call.caller.username ||
      "Unknown";

    const receiverName =
      [call.receiver.firstName, call.receiver.lastName]
        .filter(Boolean)
        .join(" ") ||
      call.receiver.username ||
      "Unknown";

    return {
      success: true,
      myRole,
      call: {
        id: call.id,
        status: call.status as CallDetail["status"],
        livekitRoomName: call.livekitRoomName,
        callerId: call.callerId,
        receiverId: call.receiverId,
        callerClerkId: call.caller.clerkId,
        receiverClerkId: call.receiver.clerkId,
        callerName,
        receiverName,
        callerImageUrl: call.caller.imageUrl,
        receiverImageUrl: call.receiver.imageUrl,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        durationSeconds: call.durationSeconds,
        initiatedAt: call.initiatedAt,
      },
    };
  } catch (err: any) {
    console.error("[getCallAction] 💥 Error:", err?.message);
    return { success: false, error: "Failed to load call." };
  }
}