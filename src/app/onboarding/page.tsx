// src/app/onboarding/page.tsx
import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { getUserAction } from "@/actions/users/get-user-action";
import { LanguageOnboardingForm } from "@/components/site/pages/onboarding/language-onboarding-form";

// ============================================
// ONBOARDING PAGE
// ============================================
//
// Reverse gate: if user already has languages,
// bounce them straight into /app.
//
// Blocking route:
//   In Next.js 16 with `cacheComponents`, a page that
//   reads request data (cookies / headers / auth) must
//   either stream via <Suspense> or opt out of prerender.
//   We opt out here — onboarding is a per-user page.
//

export const instant = false;

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Reverse gate — same logic as the /app layout gate
  const result = await getUserAction();

  if (result.success) {
    const hasKnown = result.user.languages.some((l) => l.type === "KNOWN");
    const hasLearning = result.user.languages.some(
      (l) => l.type === "LEARNING",
    );

    if (hasKnown && hasLearning) {
      redirect("/app");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-lg">
        <LanguageOnboardingForm />
      </div>
    </div>
  );
}