// src/app/onboarding/page.tsx
import React, { Suspense } from "react";

import { LanguageOnboardingForm } from "@/components/site/pages/onboarding/language-onboarding-form";
import { OnboardingGate } from "@/components/site/pages/onboarding/onboarding-gate";

// ============================================
// ONBOARDING PAGE
// ============================================
//
// Static shell + streamed gate.
//
// The shell renders instantly. The auth check
// and reverse-gate redirect happen inside
// <Suspense>, which tells Next.js 16 not to
// try to prerender the dynamic part.
//

export default function OnboardingPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-lg">
        <Suspense fallback={<OnboardingSkeleton />}>
          <OnboardingGate>
            <LanguageOnboardingForm />
          </OnboardingGate>
        </Suspense>
      </div>
    </div>
  );
}

// ============================================
// SKELETON
// ============================================

function OnboardingSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-border bg-card p-6">
      <div className="mx-auto h-6 w-40 rounded bg-muted" />
      <div className="mt-2 mx-auto h-4 w-64 rounded bg-muted" />
      <div className="mt-6 h-10 rounded-xl bg-muted" />
      <div className="mt-4 h-48 rounded-xl bg-muted" />
      <div className="mt-4 h-12 rounded-2xl bg-muted" />
    </div>
  );
}