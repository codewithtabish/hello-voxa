// src/components/site/pages/chat/chat-room.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getMessagesAction,
  type ChatMessage,
} from "@/actions/chat/get-messages-action";
import { sendMessageAction } from "@/actions/chat/send-message-action";
import { onChatMessage } from "@/lib/chat/chat-events";

type OtherUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;
};

type ChatRoomProps = {
  conversationId: string | null;
  myClerkId: string;
  otherUser: OtherUser;
};

export function ChatRoom({
  conversationId: initialConversationId,
  myClerkId,
  otherUser,
}: ChatRoomProps) {
  const router = useRouter();

  const [conversationId, setConversationId] = React.useState<string | null>(
    initialConversationId,
  );
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const conversationIdRef = React.useRef<string | null>(initialConversationId);

  React.useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const displayName =
    [otherUser.firstName, otherUser.lastName].filter(Boolean).join(" ") ||
    otherUser.username ||
    "User";

  const fetchMessages = React.useCallback(async (overrideId?: string) => {
    const id = overrideId ?? conversationIdRef.current;
    if (!id) {
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      const result = await getMessagesAction({ conversationId: id });
      if (result.success) {
        setMessages(result.messages);
        setError(null);
        console.log("[ChatRoom] fetched", result.messages.length, "messages");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to load messages.");
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  React.useEffect(() => {
    console.log("[ChatRoom] subscribing to chat events", {
      myConvId: conversationIdRef.current,
      otherUserId: otherUser.id,
    });

    return onChatMessage((evt) => {
      console.log("[ChatRoom] chat event", evt);
      const currentConvId = conversationIdRef.current;

      // Case 1: we already have a conversation id — match it
      if (currentConvId && evt.conversationId === currentConvId) {
        console.log("[ChatRoom] match by conversationId → refetch");
        fetchMessages();
        return;
      }

      // Case 2: no conversation yet, but the sender is our chat partner
      if (!currentConvId && evt.senderId && evt.senderId === otherUser.id) {
        console.log("[ChatRoom] match by senderId → adopt conv + refetch");
        setConversationId(evt.conversationId);
        conversationIdRef.current = evt.conversationId;
        fetchMessages(evt.conversationId);
        return;
      }

      console.log("[ChatRoom] no match — ignoring", {
        currentConvId,
        evtConvId: evt.conversationId,
        evtSenderId: evt.senderId,
        otherUserId: otherUser.id,
      });
    });
  }, [fetchMessages, otherUser.id]);

  // Scroll to bottom
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setError(null);

    const tempId = `temp_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      senderClerkId: myClerkId,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const result = await sendMessageAction({
      receiverId: otherUser.id,
      text,
    });

    if (!result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(result.error);
      setSending(false);
      return;
    }

    if (!conversationIdRef.current && result.conversationId) {
      setConversationId(result.conversationId);
      conversationIdRef.current = result.conversationId;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? result.message : m)),
    );
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-3 py-2.5">
        <button
          type="button"
          onClick={() => router.push("/app/messages")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>

        {otherUser.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={otherUser.imageUrl}
            alt={displayName}
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
            {initial}
          </div>
        )}

        <h1 className="truncate text-sm font-semibold">{displayName}</h1>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto w-full max-w-2xl px-3 py-4">
          {loading ? (
            <MessageSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No messages yet. Say hi to {displayName}!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((m) => {
                const isMine = m.senderClerkId === myClerkId;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex w-full",
                      isMine ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "relative max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                        isMine
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border",
                      )}
                    >
                      <p className="whitespace-pre-wrap wrap-break-word pr-14 leading-relaxed">
                        {m.text}
                      </p>
                      <span
                        className={cn(
                          "absolute right-3 bottom-1 text-[10px]",
                          isMine
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="shrink-0 border-t border-border bg-destructive/5 px-3 py-2 text-center text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="shrink-0 border-t border-border bg-background px-3 py-2.5">
        <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-2xl border border-border bg-card",
              "px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/30",
              "max-h-36",
            )}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
              input.trim() && !sending
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
            aria-label="Send"
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-start">
        <div className="h-10 w-40 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-56 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="flex justify-start">
        <div className="h-10 w-32 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}