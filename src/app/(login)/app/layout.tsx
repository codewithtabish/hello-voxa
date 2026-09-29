// src/app/(login)/app/layout.tsx
import React from "react";
import { redirect } from "next/navigation";

import { getUserAction } from "@/actions/users/get-user-action";
import { InboxListener } from "@/components/site/pages/callroom/inbox-listener";
import { PushSubscriber } from "@/components/site/pages/callroom/push-subscriber";

export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getUserAction();

  if (!result.success) {
    redirect("/");
  }

  const user = result.user;

  const hasKnown = user.languages.some((l) => l.type === "KNOWN");
  const hasLearning = user.languages.some((l) => l.type === "LEARNING");

  if (!hasKnown || !hasLearning) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <InboxListener />
      <PushSubscriber />
      <main className="flex-1">{children}</main>
    </div>
  );
}