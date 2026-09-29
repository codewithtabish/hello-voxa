// src/lib/chat/chat-events.ts

const EVENT_NAME = "voxa:chat:new-message";

export function emitChatMessage(conversationId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { conversationId } }),
  );
}

export function onChatMessage(
  cb: (conversationId: string) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) =>
    cb((e as CustomEvent<{ conversationId: string }>).detail.conversationId);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}