// src/lib/cache-key.ts
// ============================================
// CENTRAL CACHE TAGS
// Used with `use cache` + `revalidateTag`
// ============================================

export const CACHE_TAGS = {
  singleUser: "singleUser",
  users: "users",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

// ============================================
// REVALIDATE HELPERS
// ============================================

import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Revalidate ONE user's data + the bulk users list.
 * Call after a user's own row changes:
 * profile, languages, interests, availability, image, name, plan cache.
 */
export function revalidateSingleUser() {
  revalidateTag(CACHE_TAGS.singleUser, { expire: 0 });
  revalidateTag(CACHE_TAGS.users, { expire: 0 });
  revalidatePath("/app", "layout");
}

/**
 * Revalidate ALL user data + refresh the /app pages.
 * Call after a write that affects many users at once,
 * or when a new user is created (so lists pick them up).
 */
export function revalidateUsers() {
  revalidateTag(CACHE_TAGS.users, { expire: 0 });
  revalidatePath("/app");
  revalidatePath("/app", "layout");
}