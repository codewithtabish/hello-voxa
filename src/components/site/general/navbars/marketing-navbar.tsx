// src/components/marketing/marketing-navbar.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { Mic, ArrowRight, Menu, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "../theme/mode-toggle";

// ============================================
// NAV LINKS
// ============================================

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
];

// ============================================
// CLERK APPEARANCE — theme tokens only
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
// MARKETING NAVBAR
// ============================================

export function MarketingNavbar() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();

  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    document.body.style.overflow = isMobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  return (
    <>
      <header
        className={cn(
          // Layout
          "sticky top-0 z-50 w-full",
          // Match Container's surface so it blends with the warm gradients
          "bg-background/80 backdrop-blur-md",
          // Hairline like Container's warm border
          "border-b border-border/60",
          // Smooth theme transition (matches Container)
          "transition-colors duration-500 ease-out",
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* ============================================
              LOGO
              ============================================ */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90"
          >
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-xl",
                // Same primary treatment Container uses
                "bg-primary shadow-md shadow-primary/25",
              )}
            >
              <Mic
                className="size-4 text-primary-foreground"
                strokeWidth={2.5}
              />
            </div>
            <span className="text-lg font-extrabold tracking-[0.14em] text-foreground">
              VOXA
            </span>
          </Link>

          {/* ============================================
              DESKTOP NAV LINKS
              ============================================ */}
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive =
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* ============================================
              DESKTOP ACTIONS
              ============================================ */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <ModeToggle />

            {!isLoaded ? (
              <div className="size-9 animate-pulse rounded-full bg-muted" />
            ) : isSignedIn ? (
              <UserButton
                appearance={{ elements: { avatarBox: "w-9 h-9" } }}
              />
            ) : (
              <SignUpButton mode="modal" appearance={clerkAppearance}>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-4 py-2",
                    "bg-primary text-sm font-semibold text-primary-foreground",
                    "shadow-md shadow-primary/25",
                    "transition-opacity duration-200 hover:opacity-90",
                  )}
                >
                  Get Started Free
                  <ArrowRight className="size-3.5" strokeWidth={2.5} />
                </button>
              </SignUpButton>
            )}
          </div>

          {/* ============================================
              MOBILE ACTIONS
              ============================================ */}
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <ModeToggle />

            {isSignedIn && (
              <UserButton
                appearance={{ elements: { avatarBox: "w-9 h-9" } }}
              />
            )}

            <button
              type="button"
              onClick={() => setIsMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                "bg-primary/5",
                "transition-colors duration-200",
                "hover:bg-primary/10",
              )}
            >
              {isMobileOpen ? (
                <X className="size-5 text-foreground" strokeWidth={2.5} />
              ) : (
                <Menu className="size-5 text-foreground" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ============================================
          MOBILE MENU
          ============================================ */}
      {isMobileOpen && (
        <>
          <div
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
          />

          <div
            className={cn(
              "fixed inset-x-4 top-20 z-50 md:hidden",
              "rounded-3xl border border-border/50",
              "bg-background p-5 shadow-2xl",
            )}
          >
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const isActive =
                  pathname === link.href ||
                  pathname.startsWith(`${link.href}/`);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "flex items-center justify-between rounded-2xl px-4 py-3.5",
                      "text-base font-medium transition-colors duration-200",
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground hover:bg-primary/5",
                    )}
                  >
                    {link.label}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </nav>

            {!isSignedIn && isLoaded && (
              <>
                <div className="my-4 h-px bg-border/60" />

                <SignUpButton mode="modal" appearance={clerkAppearance}>
                  <button
                    type="button"
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-2xl py-3.5",
                      "bg-primary text-base font-semibold text-primary-foreground",
                      "shadow-md shadow-primary/25",
                      "transition-opacity duration-200 hover:opacity-90",
                    )}
                  >
                    Get Started Free
                    <ArrowRight className="size-4" strokeWidth={2.5} />
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}