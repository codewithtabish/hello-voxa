// src/actions/onboarding/set-languages-action.ts
"use server";

import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/clients/prisma-client";
import { revalidateUsers } from "@/lib/cache-key";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type LanguageLevel =
  | "BEGINNER"
  | "ELEMENTARY"
  | "INTERMEDIATE"
  | "UPPER_INTERMEDIATE"
  | "ADVANCED"
  | "NATIVE";

type LanguageInput = {
  code: string;
  name: string;
  level?: LanguageLevel;
  isNative?: boolean;
};

type SetLanguagesInput = {
  known: LanguageInput[];
  learning: LanguageInput[];
};

type SetLanguagesResult =
  | { success: true }
  | { success: false; error: string };

// ═══════════════════════════════════════════════════════════
// ACTION
// ═══════════════════════════════════════════════════════════

export async function setLanguagesAction(
  input: SetLanguagesInput,
): Promise<SetLanguagesResult> {
  try {
    // ─────────────────────────────────────────
    // 1. Auth
    // ─────────────────────────────────────────

    const { userId: clerkId } = await auth();
    if (!clerkId) return { success: false, error: "Not authenticated." };

    // ─────────────────────────────────────────
    // 2. Validate
    // ─────────────────────────────────────────

    if (!Array.isArray(input.known) || input.known.length === 0) {
      return {
        success: false,
        error: "Pick at least one language you know.",
      };
    }

    const learningFiltered = input.learning.filter(
      (l) => !input.known.some((k) => k.code === l.code),
    );

    if (learningFiltered.length === 0) {
      return {
        success: false,
        error: "Pick at least one language you want to learn.",
      };
    }

    // ─────────────────────────────────────────
    // 3. Load internal user
    // ─────────────────────────────────────────

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return {
        success: false,
        error: "Your account is still being set up. Please refresh.",
      };
    }

    // ─────────────────────────────────────────
    // 4. Write languages (replace strategy)
    // ─────────────────────────────────────────

    await prisma.$transaction([
      prisma.userLanguage.deleteMany({
        where: { userId: user.id },
      }),

      prisma.userLanguage.createMany({
        data: [
          ...input.known.map((l) => ({
            userId: user.id,
            languageCode: l.code,
            languageName: l.name,
            level: (l.level ?? "NATIVE") as LanguageLevel,
            isNative: l.isNative ?? true,
            type: "KNOWN" as const,
          })),

          ...learningFiltered.map((l) => ({
            userId: user.id,
            languageCode: l.code,
            languageName: l.name,
            level: (l.level ?? "BEGINNER") as LanguageLevel,
            isNative: false,
            type: "LEARNING" as const,
          })),
        ],
      }),
    ]);

    // ─────────────────────────────────────────
    // 5. Bust cache
    // ─────────────────────────────────────────

    try {
      revalidateUsers();
    } catch (cacheErr: any) {
      console.error(
        "[setLanguagesAction] revalidateUsers failed:",
        cacheErr?.message,
      );
    }

    return { success: true };
  } catch (err: any) {
    console.error("[setLanguagesAction] 💥 Error:", err?.message);
    return {
      success: false,
      error: "Failed to save your languages. Please try again.",
    };
  }
}