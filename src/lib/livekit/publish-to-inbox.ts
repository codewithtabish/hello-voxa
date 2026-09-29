// src/lib/livekit/publish-to-inbox.ts
import { RoomServiceClient, DataPacket_Kind } from "livekit-server-sdk";

// ============================================
// ROOM SERVICE CLIENT
// ============================================

let cachedClient: RoomServiceClient | null = null;

function getRoomService(): RoomServiceClient {
  if (cachedClient) return cachedClient;

  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error(
      "Missing LiveKit env: LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET",
    );
  }

  const httpUrl = url
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://");

  cachedClient = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  return cachedClient;
}

// ============================================
// TYPES
// ============================================

export type InboxMessage =
  | {
      type: "CALL_INCOMING";
      callId: string;
      callerName: string;
      callerImageUrl: string | null;
    }
  | { type: "CALL_ENDED"; callId: string }
  | { type: "CALL_CANCELLED"; callId: string }
  | {
      type: "MESSAGE_NEW";
      conversationId: string;
      preview: string;
      senderId: string;
    };

// ============================================
// PUBLISH TO INBOX
// ============================================
//
// Sends a JSON message to the user's personal
// inbox room.
//
// Signature:
//   sendData(room, data, kind, options?)
//
// kind = RELIABLE  → guaranteed delivery, ordered
// kind = LOSSY     → may drop, faster (not needed here)
//
// If the user isn't connected, LiveKit throws
// and we silently swallow it.
//

export async function publishToInbox(
  userId: string,
  message: InboxMessage,
): Promise<void> {
  const roomName = `inbox_${userId}`;
  const payload = new TextEncoder().encode(JSON.stringify(message));

  try {
    const svc = getRoomService();
    await svc.sendData(roomName, payload, DataPacket_Kind.RELIABLE);
  } catch (err: any) {
    // The room likely doesn't exist because the user isn't connected.
    // That's OK — no live delivery needed.
    console.warn(
      `[publishToInbox] Failed to deliver ${message.type} to ${userId}:`,
      err?.message,
    );
  }
}