import React from "react";
import { notFound } from "next/navigation";

import { getCallAction } from "@/actions/calls/get-call-action";
import { CallRoom } from "@/components/site/pages/callroom/call-room";
// ⚠️ Must be the SAME file as the one above (old callroom/ file → delete it)

export const dynamic = "force-dynamic";

const FINISHED_STATUSES = [
  "ENDED",
  "MISSED",
  "DECLINED",
  "CANCELLED",
  "FAILED",
];

export default async function CallPage({
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

  // Call already finished — friendly end screen
  if (FINISHED_STATUSES.includes(call.status)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center text-foreground">
        <h1 className="text-xl font-semibold">Call ended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {call.durationSeconds
            ? `Lasted ${formatDuration(call.durationSeconds)}`
            : "This call is no longer active."}
        </p>

        <a
          href="/app"
          className="mt-6 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Back to app
        </a>
      </div>
    );
  }

  return <CallRoom key={call.id} call={call} myRole={myRole} />;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}