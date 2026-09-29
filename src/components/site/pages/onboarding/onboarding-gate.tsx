// src/app/onboarding/onboarding-gate.tsx
import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { getUserAction } from "@/actions/users/get-user-action";

// ============================================
// ONBOARDING GATE
// ============================================
//
// Reverse gate: if the user already has
// languages set, bounce them to /app.
//
// Runs inside <Suspense>, so Next.js 16 does
// not attempt to prerender it.
//

export async function OnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

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

  return <>{children}</>;
}