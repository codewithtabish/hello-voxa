// src/lib/livekit/webhook.ts
import { WebhookReceiver } from "livekit-server-sdk";

function getWebhookEnv() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Missing LiveKit env vars: LIVEKIT_API_KEY / LIVEKIT_API_SECRET",
    );
  }

  return { apiKey, apiSecret };
}

let cachedReceiver: WebhookReceiver | null = null;

function getReceiver(): WebhookReceiver {
  if (cachedReceiver) return cachedReceiver;

  const { apiKey, apiSecret } = getWebhookEnv();
  cachedReceiver = new WebhookReceiver(apiKey, apiSecret);
  return cachedReceiver;
}

export async function verifyLiveKitWebhook(
  body: string,
  authHeader: string | null,
) {
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const receiver = getReceiver();
  return receiver.receive(body, authHeader);
}