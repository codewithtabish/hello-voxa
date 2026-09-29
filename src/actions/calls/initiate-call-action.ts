// src/actions/calls/initiate-call-action.ts
"use server";

import { randomUUID } from "crypto";
import { after } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { canonicalPair } from "@/lib/conversation/canonical";
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
    // ─────────────────────────────────────────
    // BLOCKING — only what the client needs
    // ─────────────────────────────────────────

    const { userId: callerClerkId } = await auth();
    if (!callerClerkId) return { success: false, error: "Not authenticated." };

    const receiverInternalId = input.receiverId;
    if (!receiverInternalId) {
      return { success: false, error: "receiverId is required." };
    }

    const [caller, receiver] = await Promise.all([
      prisma.user.findUnique({
        where: { clerkId: callerClerkId },
        select: {
          id: true,
          firstName: true,
          username: true,
          imageUrl: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: receiverInternalId },
        select: { id: true, clerkId: true },
      }),
    ]);

    if (!caller) return { success: false, error: "Caller not found." };
    if (!receiver) return { success: false, error: "Receiver not found." };
    if (caller.id === receiver.id) {
      return { success: false, error: "You cannot call yourself." };
    }

    const { userAId, userBId } = canonicalPair(caller.id, receiver.id);

    const conversation = await prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId, status: "ACTIVE" },
      update: {},
      select: { id: true },
    });

    const livekitRoomName = `call_${randomUUID().replace(/-/g, "").slice(0, 24)}`;

    const call = await prisma.call.create({
      data: {
        conversationId: conversation.id,
        callerId: caller.id,
        receiverId: receiver.id,
        status: "RINGING",
        livekitRoomName,
        initiatedAt: new Date(),
      },
      select: { id: true },
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
    // BACKGROUND — runs AFTER response is sent
    // ─────────────────────────────────────────
    //
    // `after()` tells Next.js: "don't cut this off
    // when the response returns". The user never
    // waits for these.

    after(async () => {
      try {
        await Promise.allSettled([
          publishToInbox(receiver.id, {
            type: "CALL_INCOMING",
            callId: call.id,
            callerName: displayName,
            callerImageUrl: caller.imageUrl ?? null,
          }),
          sendPushToUser(receiver.id, {
            title: "Incoming VOXA call",
            body: `${displayName} is calling...`,
            callId: call.id,
            callerImageUrl: caller.imageUrl ?? null,
            url: `/app/call/${call.id}`,
          }),
        ]);
      } catch (err) {
        console.warn("[initiateCallAction.after] notify failed:", err);
      }
    });

    // ─────────────────────────────────────────
    // RETURN — user gets this in ~250ms
    // ─────────────────────────────────────────

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