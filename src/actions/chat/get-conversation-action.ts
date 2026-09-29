// src/actions/chat/get-conversation-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { canonicalPair } from "@/lib/conversation/canonical";

type GetConversationInput = {
  otherUserId: string;
};

type GetConversationResult =
  | {
      success: true;
      conversationId: string;
      otherUser: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        username: string | null;
        imageUrl: string | null;
      };
    }
  | { success: false; error: string };

export async function getConversationAction(
  input: GetConversationInput,
): Promise<GetConversationResult> {
  try {
    const { userId: myClerkId } = await auth();
    if (!myClerkId) return { success: false, error: "Not authenticated." };

    const [me, other] = await Promise.all([
      prisma.user.findUnique({
        where: { clerkId: myClerkId },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: input.otherUserId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          imageUrl: true,
        },
      }),
    ]);

    if (!me) return { success: false, error: "User not found." };
    if (!other) return { success: false, error: "Other user not found." };
    if (me.id === other.id) {
      return { success: false, error: "Cannot message yourself." };
    }

    const { userAId, userBId } = canonicalPair(me.id, other.id);

    const conversation = await prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId, status: "ACTIVE" },
      update: {},
      select: { id: true },
    });

    return {
      success: true,
      conversationId: conversation.id,
      otherUser: {
        id: other.id,
        firstName: other.firstName,
        lastName: other.lastName,
        username: other.username,
        imageUrl: other.imageUrl,
      },
    };
  } catch (err: any) {
    console.error("[getConversationAction]", err?.message);
    return { success: false, error: "Failed to open chat." };
  }
}