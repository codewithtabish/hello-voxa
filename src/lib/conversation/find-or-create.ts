// src/lib/conversation/find-or-create.ts
import prisma from "@/lib/clients/prisma-client";
import { canonicalPair } from "./canonical";

export async function findOrCreateConversation(
  userAInternalId: string,
  userBInternalId: string,
) {
  const { userAId, userBId } = canonicalPair(userAInternalId, userBInternalId);

  const existing = await prisma.conversation.findUnique({
    where: {
      userAId_userBId: { userAId, userBId },
    },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      userAId,
      userBId,
      status: "ACTIVE",
    },
  });
}