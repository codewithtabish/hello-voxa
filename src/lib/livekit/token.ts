// src/lib/livekit/token.ts
import { AccessToken } from "livekit-server-sdk";

function getLiveKitEnv() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error(
      "Missing LiveKit env vars: LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET",
    );
  }

  return { url, apiKey, apiSecret };
}

export type LiveKitRole =
  | "caller"
  | "receiver"
  | "host"
  | "speaker"
  | "listener";

export type LiveKitTokenOptions = {
  identity: string;
  name?: string;
  roomName: string;
  role: LiveKitRole;
  metadata?: string;
};

export type LiveKitTokenResult = {
  token: string;
  serverUrl: string;
};

function permissionsForRole(role: LiveKitRole) {
  switch (role) {
    case "caller":
    case "receiver":
    case "host":
    case "speaker":
      return { canPublish: true, canSubscribe: true, canPublishData: true };
    case "listener":
      return { canPublish: false, canSubscribe: true, canPublishData: true };
  }
}

export async function getLiveKitToken(
  options: LiveKitTokenOptions,
): Promise<LiveKitTokenResult> {
  const { url, apiKey, apiSecret } = getLiveKitEnv();

  const at = new AccessToken(apiKey, apiSecret, {
    identity: options.identity,
    name: options.name,
    metadata: options.metadata,
    ttl: "2h",
  });

  at.addGrant({
    room: options.roomName,
    roomJoin: true,
    ...permissionsForRole(options.role),
  });

  return {
    token: await at.toJwt(),
    serverUrl: url,
  };
}