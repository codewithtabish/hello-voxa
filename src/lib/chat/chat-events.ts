// src/lib/chat/chat-events.ts

const EVENT_NAME = "voxa:chat:new-message";

export type ChatMessageEvent = {
  conversationId: string;
  senderId: string;
};

type EmitPayload = string | ChatMessageEvent;

export function emitChatMessage(payload: EmitPayload) {
  if (typeof window === "undefined") return;

  const detail: ChatMessageEvent =
    typeof payload === "string"
      ? { conversationId: payload, senderId: "" }
      : payload;

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
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