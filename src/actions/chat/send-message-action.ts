// src/actions/chat/send-message-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { canonicalPair } from "@/lib/conversation/canonical";
import { publishToInbox } from "@/lib/livekit/publish-to-inbox";
import { sendPushToUser } from "@/lib/push/send-push";

type SendMessageInput = {
  receiverId: string;
  text: string;
};

type SendMessageResult =
  | {
      success: true;
      conversationId: string;
      message: {
        id: string;
        senderClerkId: string;
        text: string;
        createdAt: string;
      };
    }
  | { success: false; error: string };

export async function sendMessageAction(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  try {
    const { userId: senderClerkId } = await auth();
    if (!senderClerkId) return { success: false, error: "Not authenticated." };

    const text = input.text?.trim();
    if (!text) return { success: false, error: "Empty message." };
    if (text.length > 4000) return { success: false, error: "Too long." };

    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({
        where: { clerkId: senderClerkId },
        select: { id: true, firstName: true, username: true },
      }),
      prisma.user.findUnique({
        where: { id: input.receiverId },
        select: { id: true },
      }),
    ]);

    if (!sender) return { success: false, error: "Sender not found." };
    if (!receiver) return { success: false, error: "Receiver not found." };
    if (sender.id === receiver.id) {
      return { success: false, error: "Cannot message yourself." };
    }

    const { userAId, userBId } = canonicalPair(sender.id, receiver.id);

    const conversation = await prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId, status: "ACTIVE" },
      update: {},
      select: { id: true },
    });

    const now = new Date();

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: sender.id,
        type: "TEXT",
        text,
      },
      select: {
        id: true,
        text: true,
        createdAt: true,
      },
    });

    // Update lastMessageAt — fire and forget
    prisma.conversation
      .update({
        where: { id: conversation.id },
        data: { lastMessageAt: now },
      })
      .catch(() => {});

    // Notifications — fire and forget
    const senderName = sender.firstName ?? sender.username ?? "Someone";

    void Promise.allSettled([
      publishToInbox(receiver.id, {
        type: "MESSAGE_NEW",
        conversationId: conversation.id,
        senderId: sender.id,
        preview: text.length > 80 ? text.slice(0, 80) + "…" : text,
      }),
      sendPushToUser(receiver.id, {
        title: senderName,
        body: text.length > 100 ? text.slice(0, 100) + "…" : text,
        url: `/app/messages/${conversation.id}`,
        conversationId: conversation.id,
      }),
    ]).catch(() => {});

    return {
      success: true,
      conversationId: conversation.id,
      message: {
        id: message.id,
        senderClerkId,
        text: message.text ?? "",
        createdAt: message.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    console.error("[sendMessageAction]", err?.message);
    return { success: false, error: "Failed to send." };
  }
}