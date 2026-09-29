"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import * as React from "react";

// next-themes renders an inline <script> to set the theme class before
// hydration. React 19 warns about this, but it is a known false positive.
// We also suppress hydration mismatch warnings caused by browser extensions
// (Dark Reader, etc.) that inject attributes after the server HTML is sent.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;

  console.error = (...args: unknown[]) => {
    const message = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");

    // 1. next-themes script tag false positive
    if (message.includes("Encountered a script tag")) {
      return;
    }

    // 2. Dark Reader / browser extension hydration mismatches
    if (
      message.includes("Hydration") ||
      message.includes("hydration") ||
      message.includes("server rendered HTML") ||
      message.includes("did not match") ||
      message.includes("A tree hydrated but some attributes")
    ) {
      return;
    }

    // Let everything else (including real errors like "Failed to fetch") through
    originalError.apply(console, args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}