// src/app/(login)/app/call/[callId]/page.tsx
import React, { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PhoneOff, PhoneMissed, Clock } from "lucide-react";

import { getCallAction } from "@/actions/calls/get-call-action";
import { CallRoom } from "@/components/site/pages/callroom/call-room";

// ============================================
// CALL PAGE (Next.js 16 + Cache Components)
// ============================================
//
// - No `export const dynamic` (not allowed with cacheComponents)
// - Request-time data is read inside <Suspense>
// - Static shell prerenders, dynamic content streams in
//

const FINISHED_STATUSES = [
  "ENDED",
  "MISSED",
  "DECLINED",
  "CANCELLED",
  "FAILED",
] as const;

// ============================================
// PAGE
// ============================================

export default function CallPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  return (
    <Suspense fallback={<CallLoading />}>
      <CallContent params={params} />
    </Suspense>
  );
}

// ============================================
// CONTENT
// ============================================

async function CallContent({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;

  const result = await getCallAction({ callId });

  if (!result.success) {
    notFound();
  }

  const { call, myRole } = result;

  // ─────────────────────────────────────────
  // Finished call → show summary screen
  // ─────────────────────────────────────────

  if (FINISHED_STATUSES.includes(call.status as any)) {
    return <CallEndedScreen call={call} myRole={myRole} />;
  }

  // ─────────────────────────────────────────
  // Active call → render the room
  // ─────────────────────────────────────────

  return <CallRoom key={call.id} call={call} myRole={myRole} />;
}

// ============================================
// CALL ENDED SCREEN
// ============================================

function CallEndedScreen({
  call,
  myRole,
}: {
  call: {
    status: string;
    durationSeconds: number | null;
    callerName: string | null;
    receiverName: string | null;
    callerImageUrl: string | null;
    receiverImageUrl: string | null;
  };
  myRole: "caller" | "receiver";
}) {
  const otherName =
    myRole === "caller" ? call.receiverName : call.callerName;
  const otherImage =
    myRole === "caller" ? call.receiverImageUrl : call.callerImageUrl;

  const initial = otherName?.charAt(0).toUpperCase() ?? "?";

  // ─────────────────────────────────────────
  // Status messaging
  // ─────────────────────────────────────────

  const statusInfo = getStatusInfo(call.status, myRole, call.durationSeconds);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Top bar — back to app */}
      <div className="flex items-center px-4 py-4 sm:px-6">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        {/* Avatar */}
        <div className="relative">
          {otherImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={otherImage}
              alt={otherName ?? "User"}
              className="size-32 rounded-full object-cover ring-4 ring-background"
            />
          ) : (
            <div className="flex size-32 items-center justify-center rounded-full bg-muted text-5xl font-semibold text-muted-foreground ring-4 ring-background">
              {initial}
            </div>
          )}

          {/* Status icon badge */}
          <span
            className={`absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full border-2 border-background ${statusInfo.badgeBg}`}
          >
            {statusInfo.icon}
          </span>
        </div>

        {/* Name */}
        <h1 className="mt-6 text-2xl font-semibold">
          {otherName ?? "Unknown"}
        </h1>

        {/* Status text */}
        <p className="mt-2 text-base text-muted-foreground">
          {statusInfo.message}
        </p>

        {/* Duration chip */}
        {call.durationSeconds && call.durationSeconds > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-foreground">
            <Clock className="size-3.5" />
            {formatDuration(call.durationSeconds)}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-center gap-3 px-6 pb-12">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-opacity hover:opacity-90"
        >
          Back to app
        </Link>
      </div>
    </div>
  );
}

// ============================================
// STATUS INFO HELPER
// ============================================

function getStatusInfo(
  status: string,
  myRole: "caller" | "receiver",
  durationSeconds: number | null,
) {
  switch (status) {
    case "ENDED":
      return {
        message: durationSeconds
          ? "Call ended"
          : "Call ended before anyone spoke",
        badgeBg: "bg-muted",
        icon: <PhoneOff className="size-4 text-muted-foreground" />,
      };

    case "MISSED":
      return {
        message: myRole === "caller" ? "No answer" : "Missed call",
        badgeBg: "bg-destructive/10",
        icon: <PhoneMissed className="size-4 text-destructive" />,
      };

    case "DECLINED":
      return {
        message: myRole === "caller" ? "Call declined" : "You declined",
        badgeBg: "bg-destructive/10",
        icon: <PhoneOff className="size-4 text-destructive" />,
      };

    case "CANCELLED":
      return {
        message:
          myRole === "caller" ? "You cancelled" : "Call was cancelled",
        badgeBg: "bg-muted",
        icon: <PhoneOff className="size-4 text-muted-foreground" />,
      };

    case "FAILED":
      return {
        message: "Call failed",
        badgeBg: "bg-destructive/10",
        icon: <PhoneMissed className="size-4 text-destructive" />,
      };

    default:
      return {
        message: "Call ended",
        badgeBg: "bg-muted",
        icon: <PhoneOff className="size-4 text-muted-foreground" />,
      };
  }
}

// ============================================
// LOADING SKELETON
// ============================================

function CallLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        {/* Avatar skeleton */}
        <div className="relative">
          <div className="size-32 animate-pulse rounded-full bg-muted" />
        </div>

        {/* Name skeleton */}
        <div className="mt-6 h-7 w-40 animate-pulse rounded bg-muted" />

        {/* Status skeleton */}
        <div className="mt-3 h-5 w-32 animate-pulse rounded bg-muted" />
      </div>

      {/* Controls skeleton */}
      <div className="flex items-center justify-center gap-6 pb-12">
        <div className="size-14 animate-pulse rounded-full bg-muted" />
        <div className="size-16 animate-pulse rounded-full bg-muted" />
        <div className="size-14 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}