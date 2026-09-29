// src/actions/livekit/get-inbox-token-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { getLiveKitToken } from "@/lib/livekit/token";

type GetInboxTokenResult =
  | {
      success: true;
      token: string;
      serverUrl: string;
      roomName: string;
    }
  | { success: false; error: string };

export async function getInboxTokenAction(): Promise<GetInboxTokenResult> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, firstName: true, username: true },
    });
    if (!user) return { success: false, error: "User not found." };

    const roomName = `inbox_${user.id}`;

    const displayName =
      user.firstName ?? user.username ?? clerkId;

    const { token, serverUrl } = await getLiveKitToken({
      identity: `inbox_${clerkId}`,
      name: `${displayName} (inbox)`,
      roomName,
      role: "listener",
    });

    return {
      success: true,
      token,
      serverUrl,
      roomName,
    };
  } catch (err: any) {
    console.error("[getInboxTokenAction] 💥 Error:", err?.message);
    return { success: false, error: "Failed to get inbox token." };
  }
}