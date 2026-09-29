// src/app/(login)/app/messages/page.tsx
import React, { Suspense } from "react";
import Link from "next/link";

import { listConversationsAction } from "@/actions/chat/list-conversations-action";

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ConversationsList />
    </Suspense>
  );
}

async function ConversationsList() {
  const result = await listConversationsAction();

  if (!result.success) {
    return (
      <div className="px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error}
      </div>
    );
  }

  if (result.conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">No messages yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a conversation from someone's profile.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-6">
      <h1 className="mb-4 px-3 text-lg font-semibold">Messages</h1>

      <ul className="flex flex-col">
        {result.conversations.map((c) => {
          const name =
            [c.otherUser.firstName, c.otherUser.lastName]
              .filter(Boolean)
              .join(" ") ||
            c.otherUser.username ||
            "User";

          const initial = name.charAt(0).toUpperCase();
          const preview = c.lastMessageFromMe
            ? `You: ${c.lastMessage}`
            : c.lastMessage;

          return (
            <li key={c.conversationId}>
              <Link
                href={`/app/messages/${c.conversationId}`}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-muted/60"
              >
                {c.otherUser.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.otherUser.imageUrl}
                    alt={name}
                    className="size-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
                    {initial}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold">{name}</h3>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelative(c.lastMessageAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {preview}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-6">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <div className="size-12 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}