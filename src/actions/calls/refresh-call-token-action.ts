// src/actions/calls/refresh-call-token-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { getLiveKitToken } from "@/lib/livekit/token";

type RefreshCallTokenInput = {
  callId: string;
};

type RefreshCallTokenResult =
  | {
      success: true;
      livekitRoomName: string;
      token: string;
      serverUrl: string;
      role: "caller" | "receiver";
    }
  | { success: false; error: string };

export async function refreshCallTokenAction(
  input: RefreshCallTokenInput,
): Promise<RefreshCallTokenResult> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, firstName: true, username: true },
    });
    if (!user) return { success: false, error: "User not found." };

    const call = await prisma.call.findUnique({
      where: { id: input.callId },
      select: {
        id: true,
        status: true,
        callerId: true,
        receiverId: true,
        livekitRoomName: true,
      },
    });

    if (!call) return { success: false, error: "Call not found." };

    const isCaller = call.callerId === user.id;
    const isReceiver = call.receiverId === user.id;

    if (!isCaller && !isReceiver) {
      return { success: false, error: "Not a participant in this call." };
    }

    const role: "caller" | "receiver" = isCaller ? "caller" : "receiver";

    if (call.status !== "RINGING" && call.status !== "CONNECTED") {
      return { success: false, error: "Call is no longer active." };
    }

    const displayName = user.firstName ?? user.username ?? clerkId;

    const { token, serverUrl } = await getLiveKitToken({
      identity: clerkId,
      name: displayName,
      roomName: call.livekitRoomName,
      role,
    });

    return {
      success: true,
      livekitRoomName: call.livekitRoomName,
      token,
      serverUrl,
      role,
    };
  } catch (err: any) {
    console.error("[refreshCallTokenAction] 💥 Error:", err?.message);
    return { success: false, error: "Failed to refresh token." };
  }
}