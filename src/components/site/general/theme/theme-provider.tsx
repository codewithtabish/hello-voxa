// src/components/site/general/theme/theme-provider.tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// ============================================
// NOISE FILTER
// ============================================
//
// LiveKit fires these during normal call teardown.
// They are NOT real errors — just WebRTC closing
// the peer connection. Filter them out so they
// don't trigger Next.js dev overlay or App Router
// error boundaries.
//

const IGNORED_LOG_PATTERNS = [
  "DataChannel error on lossy",
  "publisher data channel",
  "could not createOffer with closed peer connection",
  "could not createAnswer with closed peer connection",
  "RTCPeerConnection is closed",
  "ICE connection state is closed",
  "The play() request was interrupted",
  "AbortError: The play() request was interrupted",
];

function isIgnoredLog(args: unknown[]): boolean {
  if (args.length === 0) return false;

  const first = args[0];
  if (typeof first !== "string") return false;

  return IGNORED_LOG_PATTERNS.some((pattern) =>
    first.toLowerCase().includes(pattern.toLowerCase()),
  );
}

// ============================================
// PATCH CONSOLE.ERROR (dev only)
// ============================================
//
// In development, intercept console.error and
// suppress known-harmless teardown messages so
// they don't look like application errors.
//

let patched = false;

function patchConsoleError() {
  if (patched) return;
  patched = true;

  const originalError = console.error;

  console.error = function (...args: unknown[]) {
    if (isIgnoredLog(args)) {
      // Still log so we can debug if needed — but use console.debug
      // so it doesn't count as a real error in Next.js
      console.debug("[filtered]", ...args);
      return;
    }
    originalError.apply(console, args);
  };
}

// ============================================
// THEME PROVIDER
// ============================================

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      patchConsoleError();
    }
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}