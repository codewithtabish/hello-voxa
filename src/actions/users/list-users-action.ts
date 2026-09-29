// src/actions/users/list-users-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-key";
import prisma from "@/lib/clients/prisma-client";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type UserListItem = {
  id: string;
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;

  // Presence
  onlineStatus: "ONLINE" | "OFFLINE";
  availability: "AVAILABLE" | "NOT_AVAILABLE";
  lastSeenAt: Date | null;
  lastActiveAt: Date;

  // Languages
  languages: {
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
  }[];

  // Interests
  interests: {
    id: string;
    name: string;
  }[];

  // Profile
  profile: {
    bio: string | null;
    country: string | null;
    timezone: string | null;
    conversationGoal:
      | "LANGUAGE_EXCHANGE"
      | "CASUAL_CONVERSATION"
      | "FRIENDSHIP"
      | "TRAVEL"
      | "WORK"
      | "INTERVIEW"
      | "CONFIDENCE"
      | "OTHER"
      | null;
  } | null;
};

export type ListUsersFilters = {
  // Only users marked AVAILABLE right now
  availableOnly?: boolean;

  // Users who speak this language (KNOWN)
  speaksLanguage?: string;

  // Users learning this language (LEARNING)
  learningLanguage?: string;

  // Users from this country (via Profile)
  country?: string;

  // Only users with at least one interest in this list
  interests?: string[];

  // Free-text search on firstName / lastName / username
  search?: string;

  // Pagination
  cursor?: string;
  limit?: number;
};

type ListUsersResult =
  | { success: true; users: UserListItem[]; nextCursor: string | null }
  | { success: false; error: string };

// ═══════════════════════════════════════════════════════════
// SELECT — everything a Discover card needs
// ═══════════════════════════════════════════════════════════

const USER_LIST_SELECT = {
  id: true,
  clerkId: true,
  firstName: true,
  lastName: true,
  username: true,
  imageUrl: true,

  onlineStatus: true,
  availability: true,
  lastSeenAt: true,
  lastActiveAt: true,

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

  interests: {
    select: {
      id: true,
      name: true,
    },
  },

  profile: {
    select: {
      bio: true,
      country: true,
      timezone: true,
      conversationGoal: true,
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════
// CACHED LIST (uses `users` ta
// ═══════════════════════════════════════════════════════════

async function getCachedUsers(
  filters: ListUsersFilters,
): Promise<{ users: UserListItem[]; nextCursor: string | null }> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.users);

  const limit = Math.min(filters.limit ?? 30, 50);

  // ─────────────────────────────────────────
  // Build the where clause — neutral, no implicit exclusions
  // ─────────────────────────────────────────

  const where: any = {};

  if (filters.availableOnly) {
    where.availability = "AVAILABLE";
  }

  if (filters.speaksLanguage) {
    where.languages = {
      some: {
        languageCode: filters.speaksLanguage,
        type: "KNOWN",
      },
    };
  }

  if (filters.learningLanguage) {
    where.languages = {
      ...(where.languages ?? {}),
      some: {
        ...(where.languages?.some ?? {}),
        languageCode: filters.learningLanguage,
        type: "LEARNING",
      },
    };
  }

  if (filters.country) {
    where.profile = {
      is: {
        country: filters.country,
      },
    };
  }

  if (filters.interests && filters.interests.length > 0) {
    where.interests = {
      some: {
        name: { in: filters.interests },
      },
    };
  }

  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
    ];
  }

  // ─────────────────────────────────────────
  // Query with cursor pagination
  // ─────────────────────────────────────────

  const users = await prisma.user.findMany({
    where,
    select: USER_LIST_SELECT,
    orderBy: [
      // Available users first
      { availability: "desc" },
      // Then most recently active
      { lastActiveAt: "desc" },
      // Stable tiebreaker
      { id: "desc" },
    ],
    take: limit + 1, // fetch one extra to detect next page
    ...(filters.cursor
      ? {
          cursor: { id: filters.cursor },
          skip: 1, // skip the cursor row itself
        }
      : {}),
  });

  const hasMore = users.length > limit;
  const sliced = hasMore ? users.slice(0, limit) : users;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  return { users: sliced, nextCursor };
}

// ═══════════════════════════════════════════════════════════
// PUBLIC ACTION
// ═══════════════════════════════════════════════════════════

export async function listUsersAction(
  filters: ListUsersFilters = {},
): Promise<ListUsersResult> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    const { users, nextCursor } = await getCachedUsers(filters);

    return { success: true, users, nextCursor };
  } catch (err: any) {
    console.error("[listUsersAction] 💥 Error:", err?.message);
    return { success: false, error: "Failed to load users." };
  }
}