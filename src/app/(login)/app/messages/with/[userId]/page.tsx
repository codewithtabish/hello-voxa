// src/app/(login)/app/messages/with/[userId]/page.tsx
import React, { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { canonicalPair } from "@/lib/conversation/canonical";
import { ChatRoom } from "@/components/site/pages/chat/chat-room";

export default function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <Resolve params={params} />
    </Suspense>
  );
}

async function Resolve({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: otherUserId } = await params;
  const { userId: myClerkId } = await auth();
  if (!myClerkId) redirect("/");

  const [me, other] = await Promise.all([
    prisma.user.findUnique({
      where: { clerkId: myClerkId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: otherUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        imageUrl: true,
      },
    }),
  ]);

  if (!me) redirect("/");
  if (!other) notFound();
  if (me.id === other.id) notFound();

  const { userAId, userBId } = canonicalPair(me.id, other.id);

  // READ-ONLY lookup — no write on page open
  const existing = await prisma.conversation.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    select: { id: true },
  });

  return (
    <ChatRoom
      conversationId={existing?.id ?? null}
      myClerkId={myClerkId}
      otherUser={other}
    />
  );
}

function ChatSkeleton() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}