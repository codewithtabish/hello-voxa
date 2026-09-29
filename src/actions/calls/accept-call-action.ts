// src/actions/calls/accept-call-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { getLiveKitToken } from "@/lib/livekit/token";

type AcceptCallInput = {
  callId: string;
};

type AcceptCallResult =
  | {
      success: true;
      livekitRoomName: string;
      token: string;
      serverUrl: string;
    }
  | { success: false; error: string };

export async function acceptCallAction(
  input: AcceptCallInput,
): Promise<AcceptCallResult> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    const receiver = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, firstName: true, username: true },
    });
    if (!receiver) return { success: false, error: "User not found." };

    const call = await prisma.call.findUnique({
      where: { id: input.callId },
      select: {
        id: true,
        status: true,
        receiverId: true,
        livekitRoomName: true,
      },
    });

    if (!call) return { success: false, error: "Call not found." };
    if (call.receiverId !== receiver.id) {
      return { success: false, error: "Not your call." };
    }

    // If already connected, just hand back a fresh token
    if (call.status === "CONNECTED") {
      const displayName =
        receiver.firstName ?? receiver.username ?? clerkId;

      const { token, serverUrl } = await getLiveKitToken({
        identity: clerkId,
        name: displayName,
        roomName: call.livekitRoomName,
        role: "receiver",
      });

      return {
        success: true,
        livekitRoomName: call.livekitRoomName,
        token,
        serverUrl,
      };
    }

    if (call.status !== "RINGING") {
      return { success: false, error: "Call is no longer ringing." };
    }

    const now = new Date();

    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: "CONNECTED",
        answeredAt: now,
      },
    });

    const displayName =
      receiver.firstName ?? receiver.username ?? clerkId;

    const { token, serverUrl } = await getLiveKitToken({
      identity: clerkId,
      name: displayName,
      roomName: call.livekitRoomName,
      role: "receiver",
    });

    return {
      success: true,
      livekitRoomName: call.livekitRoomName,
      token,
      serverUrl,
    };
  } catch (err: any) {
    console.error("[acceptCallAction] 💥 Error:", err?.message);
    return { success: false, error: "Failed to accept call." };
  }
}