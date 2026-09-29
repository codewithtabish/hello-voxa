// src/lib/chat/chat-events.ts

const EVENT_NAME = "voxa:chat:new-message";

export type ChatMessageEvent = {
  conversationId: string;
  senderId: string;
};

export function emitChatMessage(event: ChatMessageEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: event }));
}

export function onChatMessage(
  cb: (event: ChatMessageEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) =>
    cb((e as CustomEvent<ChatMessageEvent>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}