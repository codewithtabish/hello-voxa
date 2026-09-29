import React, { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";

import { getCallAction } from "@/actions/calls/get-call-action";
import { CallRoom } from "@/components/site/pages/callroom/call-room";

// ============================================
// CALL PAGE (Next.js 16 + Cache Components)
// ============================================
// - No `export const dynamic` (not allowed with cacheComponents)
// - Request-time data (params, auth) is read inside <Suspense>

const FINISHED_STATUSES = [
  "ENDED",
  "MISSED",
  "DECLINED",
  "CANCELLED",
  "FAILED",
];

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

  // Call already finished, show a friendly end screen
  if (FINISHED_STATUSES.includes(call.status)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center text-foreground">
        <h1 className="text-xl font-semibold">Call ended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {call.durationSeconds
            ? `Lasted ${formatDuration(call.durationSeconds)}`
            : "This call is no longer active."}
        </p>

        <Link
          href="/app"
          className="mt-6 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Back to app
        </Link>
      </div>
    );
  }

  return <CallRoom key={call.id} call={call} myRole={myRole} />;
}

function CallLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}