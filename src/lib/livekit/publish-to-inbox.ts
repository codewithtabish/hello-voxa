// src/lib/livekit/publish-to-inbox.ts
import { RoomServiceClient, DataPacket_Kind } from "livekit-server-sdk";

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

export type InboxMessage =
  | {
      type: "CALL_INCOMING";
      callId: string;
      callerName: string;
      callerImageUrl: string | null;
    }
  | { type: "CALL_ACCEPTED"; callId: string }
  | { type: "CALL_ENDED"; callId: string }
  | { type: "CALL_CANCELLED"; callId: string }
  | {
      type: "MESSAGE_NEW";
      conversationId: string;
      preview: string;
      senderId: string;
    };

export async function publishToInbox(
  userId: string,
  message: InboxMessage,
): Promise<void> {
  const roomName = `inbox_${userId}`;
  const payload = new TextEncoder().encode(JSON.stringify(message));

  console.log(`[publishToInbox] → ${message.type} to ${roomName}`);

  try {
    const svc = getRoomService();
    await svc.sendData(roomName, payload, DataPacket_Kind.RELIABLE);
    console.log(`[publishToInbox] ✅ sent ${message.type} to ${roomName}`);
  } catch (err: any) {
    console.error(
      `[publishToInbox] ❌ FAILED for ${roomName}:`,
      err?.message,
      err?.stack,
    );
  }
}