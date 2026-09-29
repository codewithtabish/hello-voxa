// src/proxy.ts

import { clerkClient, clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes — anyone can access (non-logged-in users)
const PUBLIC_ROUTES = [
  "/about",
  "/features",
  "/pricing",
  "/faq",
  "/contact",
  "/careers",
  "/privacy",
  "/terms",
  "/refund",
  "/cookies",
  "/gallery",
  "/how-it-works",
  "/blog",
];

// User app routes — only for logged-in users
const APP_PREFIXES = ["/app"];

// Admin-only routes
const ADMIN_PREFIXES = ["/dashboard", "/agent"];

// Webhook / API routes — bypass auth entirely
const WEBHOOK_PREFIXES = [
  "/api/webhooks",
  "/api/trpc",
  "/api/safepay", // Safepay webhook
  "/api/payment-confirm", // payment confirmation API
];

// ============================================
// HELPERS
// ============================================

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

// ============================================
// MIDDLEWARE
// ============================================

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // 0. WEBHOOKS & APIS — bypass entirely
  if (matchesPrefix(pathname, WEBHOOK_PREFIXES)) {
    return NextResponse.next();
  }

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  const isLoggedIn = !!userId;
  const isLandingPage = pathname === "/";
  const isAppRoute = matchesPrefix(pathname, APP_PREFIXES);
  const isAdminRoute = matchesPrefix(pathname, ADMIN_PREFIXES);

  // 1. Logged-in users on landing page → force redirect to /app
  //    (logged-in users can NEVER stay on "/")
  if (isLandingPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  // 2. Not logged in + trying to access /app → sign in
  if (isAppRoute && !isLoggedIn) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // 3. Not logged in + admin route → sign in
  if (isAdminRoute && !isLoggedIn) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // 4. Admin role check (only for logged-in users on admin routes)
  if (isAdminRoute && isLoggedIn) {
    let role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;

    if (!role && userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      role = (user.publicMetadata as { role?: string } | undefined)?.role;
    }

    if (role !== "ADMIN") {
      // Non-admin users get sent to the normal app
      return NextResponse.redirect(new URL("/app", req.url));
    }
  }

  // Everything else continues normally
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};