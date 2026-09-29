// src/actions/chat/get-messages-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";

export type ChatMessage = {
  id: string;
  senderClerkId: string;
  text: string;
  createdAt: string;
};

type GetMessagesInput = {
  conversationId: string;
  limit?: number;
};

type GetMessagesResult =
  | { success: true; messages: ChatMessage[] }
  | { success: false; error: string };

export async function getMessagesAction(
  input: GetMessagesInput,
): Promise<GetMessagesResult> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    const me = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!me) return { success: false, error: "User not found." };

    const convo = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { userAId: true, userBId: true },
    });

    if (!convo) return { success: false, error: "Not found." };
    if (convo.userAId !== me.id && convo.userBId !== me.id) {
      return { success: false, error: "Not a participant." };
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: "asc" },
      take: Math.min(input.limit ?? 200, 300),
      select: {
        id: true,
        text: true,
        createdAt: true,
        sender: { select: { clerkId: true } },
      },
    });

    return {
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        senderClerkId: m.sender.clerkId,
        text: m.text ?? "",
        createdAt: m.createdAt.toISOString(),
      })),
    };
  } catch (err: any) {
    console.error("[getMessagesAction]", err?.message);
    return { success: false, error: "Failed to load." };
  }
}