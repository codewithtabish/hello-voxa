// src/components/app/screens/app/user-card.tsx
"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Phone, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserListItem } from "@/actions/users/list-users-action";
import { initiateCallAction } from "@/actions/calls/initiate-call-action";

export function UserCard({ user }: { user: UserListItem }) {
  const router = useRouter();
  const pathname = usePathname();

  const [calling, setCalling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ─────────────────────────────────────────
  // Reset button state whenever we navigate
  // back to this page (e.g., after a call ends)
  // ─────────────────────────────────────────

  React.useEffect(() => {
    setCalling(false);
    setError(null);
  }, [pathname]);

  // ─────────────────────────────────────────
  // Reset when the tab regains focus too
  // ─────────────────────────────────────────

  React.useEffect(() => {
    function reset() {
      setCalling(false);
      setError(null);
    }

    window.addEventListener("focus", reset);
    return () => {
      window.removeEventListener("focus", reset);
    };
  }, []);

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    "Unknown";

  const isAvailable = user.availability === "AVAILABLE";
  const known = user.languages.filter((l) => l.type === "KNOWN");
  const learning = user.languages.filter((l) => l.type === "LEARNING");

  async function handleConnect() {
    if (calling) return;
    setError(null);
    setCalling(true);

    const result = await initiateCallAction({ receiverId: user.id });

    if (!result.success) {
      setError(result.error);
      setCalling(false);
      return;
    }

    router.push(`/app/call/${result.callId}`);
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative shrink-0">
          {user.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt={name}
              className="size-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground">
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-card",
              isAvailable ? "bg-green-500" : "bg-muted-foreground/40",
            )}
            aria-label={isAvailable ? "Available" : "Not available"}
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{name}</h3>
            {isAvailable && (
              <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-green-600">
                Available
              </span>
            )}
          </div>

          {user.username && (
            <p className="truncate text-xs text-muted-foreground">
              @{user.username}
            </p>
          )}

          {known.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Speaks
              </span>
              {known.map((l) => (
                <span
                  key={l.id}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                >
                  {l.languageName}
                </span>
              ))}
            </div>
          )}

          {learning.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Learning
              </span>
              {learning.map((l) => (
                <span
                  key={l.id}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground"
                >
                  {l.languageName}
                </span>
              ))}
            </div>
          )}

          {user.profile?.country && (
            <p className="mt-2 text-xs text-muted-foreground">
              {user.profile.country}
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          )}

          {/* Connect button */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleConnect}
              disabled={calling}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5",
                "text-xs font-semibold transition-opacity",
                calling
                  ? "cursor-wait bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90",
              )}
            >
              {calling ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Phone className="size-3.5" />
                  Connect
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function UserCardSkeleton() {
  return (
    <li className="animate-pulse rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-4">
        <div className="size-12 shrink-0 rounded-full bg-muted" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="mt-2 h-3 w-20 rounded bg-muted" />
          <div className="mt-3 flex gap-1">
            <div className="h-5 w-14 rounded-full bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
          <div className="mt-3 h-7 w-24 rounded-xl bg-muted" />
        </div>
      </div>
    </li>
  );
}