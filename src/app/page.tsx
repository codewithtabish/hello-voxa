// src/app/(marketing)/page.tsx
// (or wherever your homepage lives)

"use client";

import React from "react";
import Link from "next/link";
import { SignUpButton, SignInButton, useUser } from "@clerk/nextjs";
import {
  Mic,
  ArrowRight,
  Users,
  Sparkles,
  Radio,
  MessagesSquare,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ============================================
// CLERK MODAL APPEARANCE
// ============================================

const clerkAppearance = {
  variables: {
    colorPrimary: "hsl(var(--primary))",
    colorBackground: "hsl(var(--background))",
    colorText: "hsl(var(--foreground))",
    colorTextSecondary: "hsl(var(--muted-foreground))",
    colorInputBackground: "hsl(var(--background))",
    colorInputText: "hsl(var(--foreground))",
    borderRadius: "0.9rem",
  },
  elements: {
    modalBackdrop: "bg-background/70 backdrop-blur-md",
    modalContent: "bg-background border border-border shadow-2xl",
    card: "bg-transparent shadow-none",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted-foreground",
    formButtonPrimary:
      "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90",
    formFieldInput:
      "bg-muted/40 border-border/60 focus:border-primary/40 focus:ring-primary/20",
    footerActionLink: "text-primary hover:text-primary/80",
    formFieldLabel: "text-foreground",
    dividerLine: "bg-border/60",
    dividerText: "text-muted-foreground",
  },
};

// ============================================
// HOMEPAGE
// ============================================

export default function HomePage() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] flex-col">
      {/* ────────────────────────────────────
          HERO
         ──────────────────────────────────── */}
      <section className="relative flex flex-1 items-center justify-center px-4 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-3xl text-center">
          {/* Icon badge */}
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <Mic className="size-8 text-primary-foreground" strokeWidth={2.5} />
          </div>

          {/* Heading */}
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Talk. Connect.{" "}
            <span className="text-primary">Belong.</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            VOXA is where real conversations happen. Voice calls with people
            around the world, live group rooms, and AI partners — all in one
            place.
          </p>

          {/* ────────────────────────────────────
              CTAs
             ──────────────────────────────────── */}
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {!isLoaded ? (
              <>
                <div className="h-12 w-48 animate-pulse rounded-2xl bg-muted" />
                <div className="h-12 w-32 animate-pulse rounded-2xl bg-muted" />
              </>
            ) : isSignedIn ? (
              <Link
                href="/app"
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-6 py-3.5",
                  "bg-primary text-sm font-semibold text-primary-foreground",
                  "shadow-lg shadow-primary/25",
                  "transition-opacity hover:opacity-90",
                )}
              >
                Go to app
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
            ) : (
              <>
                <SignUpButton mode="modal" appearance={clerkAppearance}>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl px-6 py-3.5",
                      "bg-primary text-sm font-semibold text-primary-foreground",
                      "shadow-lg shadow-primary/25",
                      "transition-opacity hover:opacity-90",
                    )}
                  >
                    Get started free
                    <ArrowRight className="size-4" strokeWidth={2.5} />
                  </button>
                </SignUpButton>

                <SignInButton mode="modal" appearance={clerkAppearance}>
                  <button
                    type="button"
                    className={cn(
                      "rounded-2xl border border-border bg-background px-6 py-3.5",
                      "text-sm font-medium text-foreground",
                      "transition-colors hover:bg-muted/60",
                    )}
                  >
                    Sign in
                  </button>
                </SignInButton>
              </>
            )}
          </div>

          {/* Small print */}
          <p className="mt-6 text-xs text-muted-foreground">
            Free to start. No credit card required.
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────
          FEATURES
         ──────────────────────────────────── */}
      <section className="border-t border-border/60 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<MessagesSquare className="size-5" strokeWidth={2.5} />}
              title="1-to-1 calls"
              description="Instant voice calls with anyone. No scheduling, no friction."
            />
            <FeatureCard
              icon={<Radio className="size-5" strokeWidth={2.5} />}
              title="Live rooms"
              description="Join group conversations on topics that matter to you."
            />
            <FeatureCard
              icon={<Sparkles className="size-5" strokeWidth={2.5} />}
              title="AI partners"
              description="Practice languages or rehearse scenarios with AI that talks back."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================
// FEATURE CARD
// ============================================

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}