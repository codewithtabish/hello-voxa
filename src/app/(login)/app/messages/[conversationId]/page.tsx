// src/app/(login)/app/messages/[conversationId]/page.tsx
import React, { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { ChatRoom } from "@/components/site/pages/chat/chat-room";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ConversationContent params={params} />
    </Suspense>
  );
}

async function ConversationContent({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  const me = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!me) notFound();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      userAId: true,
      userBId: true,
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
    },
  });

  if (!conversation) notFound();
  if (conversation.userAId !== me.id && conversation.userBId !== me.id) {
    notFound();
  }

  const otherUser =
    conversation.userAId === me.id ? conversation.userB : conversation.userA;

  return (
    <ChatRoom
      conversationId={conversation.id}
      myClerkId={clerkId}
      otherUser={otherUser}
    />
  );
}

function ChatSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <div className="size-9 animate-pulse rounded-full bg-muted" />
        <div className="size-10 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>

      {/* Message bubbles skeleton */}
      <div className="flex-1 space-y-3 px-3 py-4">
        <div className="flex justify-start">
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="flex justify-end">
          <div className="h-10 w-56 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="flex justify-start">
          <div className="h-10 w-32 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="flex justify-end">
          <div className="h-10 w-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>

      {/* Input skeleton */}
      <div className="border-t border-border px-3 py-2.5">
        <div className="h-11 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}