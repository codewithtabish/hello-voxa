// src/actions/chat/list-conversations-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";

export type ConversationListItem = {
  conversationId: string;
  otherUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    imageUrl: string | null;
  };
  lastMessage: string;
  lastMessageAt: string;
  lastMessageFromMe: boolean;
};

type ListConversationsResult =
  | { success: true; conversations: ConversationListItem[] }
  | { success: false; error: string };

export async function listConversationsAction(): Promise<ListConversationsResult> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    const me = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!me) return { success: false, error: "User not found." };

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ userAId: me.id }, { userBId: me.id }],
        status: { not: "BLOCKED" },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      select: {
        id: true,
        lastMessageAt: true,
        userAId: true,
        userA: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            imageUrl: true,
          },
        },
        userB: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            imageUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { text: true, senderId: true },
        },
      },
    });

    const items: ConversationListItem[] = conversations
      .filter((c) => c.lastMessageAt !== null && c.messages.length > 0)
      .map((c) => {
        const otherUser = c.userAId === me.id ? c.userB : c.userA;
        const last = c.messages[0];

        return {
          conversationId: c.id,
          otherUser,
          lastMessage: last.text ?? "",
          lastMessageAt: (c.lastMessageAt as Date).toISOString(),
          lastMessageFromMe: last.senderId === me.id,
        };
      });

    return { success: true, conversations: items };
  } catch (err: any) {
    console.error("[listConversationsAction]", err?.message);
    return { success: false, error: "Failed to load conversations." };
  }
}