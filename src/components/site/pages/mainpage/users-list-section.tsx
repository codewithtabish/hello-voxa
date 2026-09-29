// src/components/app/screens/app/users-list-section.tsx
import React from "react";

import { getUserAction } from "@/actions/users/get-user-action";
import { listUsersAction } from "@/actions/users/list-users-action";
import { UserCard, UserCardSkeleton } from "./user-card";

export async function UsersListSection() {
  const meResult = await getUserAction();
  const myClerkId = meResult.success ? meResult.user.clerkId : null;

  const result = await listUsersAction({ limit: 30 });

  if (!result.success) {
    return (
      <p className="text-sm text-muted-foreground">{result.error}</p>
    );
  }

  const users = result.users.filter((u) => u.clerkId !== myClerkId);

  if (users.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold">People</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No other users yet. Invite someone to try VOXA.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">People</h2>
        <span className="text-xs text-muted-foreground">
          {users.length} user{users.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {users.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </ul>
    </div>
  );
}

export function UsersListSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>

      <ul className="mt-4 space-y-3">
        <UserCardSkeleton />
        <UserCardSkeleton />
        <UserCardSkeleton />
      </ul>
    </div>
  );
}