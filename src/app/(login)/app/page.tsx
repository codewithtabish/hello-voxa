// src/app/(login)/app/page.tsx
import React, { Suspense } from "react";

import { getUserAction } from "@/actions/users/get-user-action";
import { UsersListSection, UsersListSkeleton } from "@/components/site/pages/mainpage/users-list-section";


export default function AppPage() {
  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <Suspense fallback={<MyAccountSkeleton />}>
          <MyAccountSection />
        </Suspense>

        <Suspense fallback={<UsersListSkeleton />}>
          <UsersListSection />
        </Suspense>
      </div>
    </div>
  );
}

async function MyAccountSection() {
  const result = await getUserAction();

  if (!result.success) {
    return (
      <p className="text-sm text-muted-foreground">{result.error}</p>
    );
  }

  const user = result.user;

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Hello, {user.firstName ?? user.username ?? "there"} 👋
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You are logged in and your VOXA account is loaded.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-muted-foreground">
          Your account
        </h2>

        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="truncate">{user.email}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">Plan</dt>
            <dd>{user.plan}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd>{user.status}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">Availability</dt>
            <dd>{user.availability}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function MyAccountSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="mt-3 h-4 w-64 rounded bg-muted" />
      <div className="mt-6 h-32 rounded-2xl bg-muted" />
    </div>
  );
}