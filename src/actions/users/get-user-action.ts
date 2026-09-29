// src/actions/users/get-user-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS, revalidateUsers } from "@/lib/cache-key";
import prisma from "@/lib/clients/prisma-client";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type UserLanguageInfo = {
  id: string;
  languageCode: string;
  languageName: string;
  level:
    | "BEGINNER"
    | "ELEMENTARY"
    | "INTERMEDIATE"
    | "UPPER_INTERMEDIATE"
    | "ADVANCED"
    | "NATIVE";
  isNative: boolean;
  type: "KNOWN" | "LEARNING";
};

export type UserInfo = {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;

  // ─── Account status ───
  status: "ACTIVE" | "SUSPENDED" | "DELETED";

  // ─── Presence (durable fallback only) ───
  onlineStatus: "ONLINE" | "OFFLINE";
  availability: "AVAILABLE" | "NOT_AVAILABLE";
  lastSeenAt: Date | null;
  lastActiveAt: Date;

  // ─── Plan (fast-read cache — source of truth is Subscription) ───
  plan: "FREE" | "PRO";
  paymentProvider: "NONE" | "SAFEPAY" | "REVENUECAT";
  subscriptionStatus:
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELLED"
    | "EXPIRED"
    | "INCOMPLETE"
    | null;
  planStartedAt: Date | null;
  planExpiresAt: Date | null;
  nextRenewalAt: Date | null;

  // ─── Stats ───
  totalCalls: number;
  totalRoomsJoined: number;
  totalRoomsHosted: number;
  totalAiSessions: number;

  // ─── Languages ───
  languages: UserLanguageInfo[];

  createdAt: Date;
  updatedAt: Date;
};

type GetUserResult =
  | { success: true; user: UserInfo }
  | { success: false; error: string };

// ═══════════════════════════════════════════════════════════
// SELECT FIELDS
// ═══════════════════════════════════════════════════════════

const USER_SELECT = {
  id: true,
  clerkId: true,
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  imageUrl: true,

  status: true,

  onlineStatus: true,
  availability: true,
  lastSeenAt: true,
  lastActiveAt: true,

  plan: true,
  paymentProvider: true,
  subscriptionStatus: true,
  planStartedAt: true,
  planExpiresAt: true,
  nextRenewalAt: true,

  totalCalls: true,
  totalRoomsJoined: true,
  totalRoomsHosted: true,
  totalAiSessions: true,

  // ─── Languages ───
  languages: {
    select: {
      id: true,
      languageCode: true,
      languageName: true,
      level: true,
      isNative: true,
      type: true,
    },
  },

  createdAt: true,
  updatedAt: true,
} as const;

// ═══════════════════════════════════════════════════════════
// CACHED READ
// ═══════════════════════════════════════════════════════════

async function getCachedUser(clerkId: string): Promise<UserInfo> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.singleUser);

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: USER_SELECT,
  });

  if (!user) {
    throw new Error(`USER_NOT_FOUND:${clerkId}`);
  }

  return user;
}

// ═══════════════════════════════════════════════════════════
// DIRECT READ (fallback — bypasses cache)
// ═══════════════════════════════════════════════════════════

async function getUserDirect(clerkId: string): Promise<UserInfo | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: USER_SELECT,
    });

    return user ?? null;
  } catch (err: any) {
    console.warn("[getUserDirect] DB error:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN ACTION
// ═══════════════════════════════════════════════════════════

export async function getUserAction(): Promise<GetUserResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: "Not authenticated." };
    }

    // ─── Step 1: Try the cached read ───
    try {
      const cached = await getCachedUser(userId);
      return { success: true, user: cached };
    } catch (err: any) {
      if (!err.message?.startsWith("USER_NOT_FOUND:")) {
        // Real error (DB down, connection issue) — bubble up
        throw err;
      }
      // USER_NOT_FOUND — fall through to retry loop.
      // This happens immediately after signup, before the Clerk
      // webhook has finished creating the User row.
    }

    // ─── Step 2: Retry loop (webhook race) ───
    // Delays increase so a slow webhook has time to land.
    const delays = [400, 700, 1000, 1400, 1800, 2200, 2500];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      await new Promise((r) => setTimeout(r, delays[attempt]));

      const direct = await getUserDirect(userId);

      if (direct) {
        // The webhook landed. Purge stale caches so the next
        // render picks up the fresh row.
        try {
          revalidateUsers();
        } catch {}

        return { success: true, user: direct };
      }
    }

    // ─── Step 3: Give up gracefully ───
    return {
      success: false,
      error: "Setting up your account. Please refresh in a moment.",
    };
  } catch (err: any) {
    console.error(`[getUserAction] 💥 Error:`, err.message);
    return { success: false, error: "Failed to load user data." };
  }
}