// src/actions/calls/initiate-call-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { findOrCreateConversation } from "@/lib/conversation/find-or-create";
import { getLiveKitToken } from "@/lib/livekit/token";
import { publishToInbox } from "@/lib/livekit/publish-to-inbox";
import { sendPushToUser } from "@/lib/push/send-push";

type InitiateCallInput = {
  receiverId: string;
};

type InitiateCallResult =
  | {
      success: true;
      callId: string;
      conversationId: string;
      livekitRoomName: string;
      token: string;
      serverUrl: string;
    }
  | { success: false; error: string };

export async function initiateCallAction(
  input: InitiateCallInput,
): Promise<InitiateCallResult> {
  try {
    const { userId: callerClerkId } = await auth();
    if (!callerClerkId) return { success: false, error: "Not authenticated." };

    const receiverInternalId = input.receiverId;
    if (!receiverInternalId) {
      return { success: false, error: "receiverId is required." };
    }

    const [caller, receiver] = await Promise.all([
      prisma.user.findUnique({
        where: { clerkId: callerClerkId },
        select: { id: true, firstName: true, username: true, imageUrl: true },
      }),
      prisma.user.findUnique({
        where: { id: receiverInternalId },
        select: { id: true, clerkId: true, firstName: true, username: true },
      }),
    ]);

    if (!caller) return { success: false, error: "Caller not found." };
    if (!receiver) return { success: false, error: "Receiver not found." };
    if (caller.id === receiver.id) {
      return { success: false, error: "You cannot call yourself." };
    }

    const conversation = await findOrCreateConversation(
      caller.id,
      receiver.id,
    );

    const call = await prisma.call.create({
      data: {
        conversationId: conversation.id,
        callerId: caller.id,
        receiverId: receiver.id,
        status: "RINGING",
        livekitRoomName: "",
        initiatedAt: new Date(),
      },
    });

    const livekitRoomName = `call_${call.id}`;

    await prisma.call.update({
      where: { id: call.id },
      data: { livekitRoomName },
    });

    const displayName =
      caller.firstName ?? caller.username ?? callerClerkId;

    const { token, serverUrl } = await getLiveKitToken({
      identity: callerClerkId,
      name: displayName,
      roomName: livekitRoomName,
      role: "caller",
    });

    // ─────────────────────────────────────────
    // 1. LiveKit data channel (instant, tab open)
    // ─────────────────────────────────────────

    await publishToInbox(receiver.id, {
      type: "CALL_INCOMING",
      callId: call.id,
      callerName: displayName,
      callerImageUrl: caller.imageUrl ?? null,
    });

    // ─────────────────────────────────────────
    // 2. Web Push (works even if browser is closed)
    // ─────────────────────────────────────────

    await sendPushToUser(receiver.id, {
      title: "Incoming VOXA call",
      body: `${displayName} is calling...`,
      callId: call.id,
      callerImageUrl: caller.imageUrl ?? null,
      url: `/app/call/${call.id}`,
    });

    return {
      success: true,
      callId: call.id,
      conversationId: conversation.id,
      livekitRoomName,
      token,
      serverUrl,
    };
  } catch (err: any) {
    console.error("[initiateCallAction] 💥 Error:", err?.message);
    return { success: false, error: "Failed to initiate call." };
  }
}