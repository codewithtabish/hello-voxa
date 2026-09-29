// src/components/app/screens/onboarding/language-onboarding-form.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { setLanguagesAction } from "@/actions/onboarding/set-languages-action";

// ============================================
// LANGUAGE CATALOG
// ============================================
// V1: hardcoded list. In V2 this can come
// from a /lib/languages.ts or a DB table.
// ============================================

type Lang = { code: string; name: string };

const LANGUAGES: Lang[] = [
  { code: "en", name: "English" },
  { code: "ur", name: "Urdu" },
  { code: "ar", name: "Arabic" },
  { code: "ps", name: "Pashto" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "hi", name: "Hindi" },
  { code: "tr", name: "Turkish" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ru", name: "Russian" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "fa", name: "Persian" },
  { code: "bn", name: "Bengali" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
];

// ============================================
// COMPONENT
// ============================================

export function LanguageOnboardingForm() {
  const router = useRouter();

  const [known, setKnown] = React.useState<string[]>([]);
  const [learning, setLearning] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"known" | "learning">(
    "known",
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filtered list based on search
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter((l) => l.name.toLowerCase().includes(q));
  }, [search]);

  // Currently active list
  const activeList = activeTab === "known" ? known : learning;
  const setActiveList = activeTab === "known" ? setKnown : setLearning;

  function toggle(code: string) {
    // Toggle within the current tab
    if (activeList.includes(code)) {
      setActiveList(activeList.filter((c) => c !== code));
      return;
    }

    setActiveList([...activeList, code]);

    // If adding to one list, remove from the other
    if (activeTab === "known") {
      setLearning(learning.filter((c) => c !== code));
    } else {
      setKnown(known.filter((c) => c !== code));
    }
  }

  async function handleSubmit() {
    setError(null);

    if (known.length === 0) {
      setError("Pick at least one language you know.");
      return;
    }
    if (learning.length === 0) {
      setError("Pick at least one language you want to learn.");
      return;
    }

    setSubmitting(true);

    const knownPayload = known.map((code) => ({
      code,
      name: LANGUAGES.find((l) => l.code === code)!.name,
    }));

    const learningPayload = learning.map((code) => ({
      code,
      name: LANGUAGES.find((l) => l.code === code)!.name,
    }));

    const result = await setLanguagesAction({
      known: knownPayload,
      learning: learningPayload,
    });

    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.replace("/app");
    router.refresh();
  }

  const canContinue = known.length > 0 && learning.length > 0;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      {/* ────────────────────────────────────
          HEADER
          ──────────────────────────────────── */}
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Welcome to VOXA
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the languages you speak, and the ones you want to practice.
        </p>
      </div>

      {/* ────────────────────────────────────
          TABS
          ──────────────────────────────────── */}
      <div className="mt-6 flex rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => setActiveTab("known")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "known"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          I know{" "}
          {known.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({known.length})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("learning")}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "learning"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          I want to learn{" "}
          {learning.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({learning.length})
            </span>
          )}
        </button>
      </div>

      {/* ────────────────────────────────────
          SEARCH
          ──────────────────────────────────── */}
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search languages..."
          className={cn(
            "w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
          )}
        />
      </div>

      {/* ────────────────────────────────────
          LANGUAGE LIST
          ──────────────────────────────────── */}
      <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-border p-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No languages match "{search}"
          </p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((lang) => {
              const active = activeList.includes(lang.code);
              const other =
                activeTab === "known"
                  ? learning.includes(lang.code)
                  : known.includes(lang.code);

              return (
                <li key={lang.code}>
                  <button
                    type="button"
                    onClick={() => toggle(lang.code)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <span>{lang.name}</span>

                    <div className="flex items-center gap-2">
                      {other && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                            active
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-muted-foreground/20 text-muted-foreground",
                          )}
                        >
                          {activeTab === "known" ? "Learning" : "Known"}
                        </span>
                      )}

                      {active && <Check className="size-4" strokeWidth={3} />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ────────────────────────────────────
          SUMMARY
          ──────────────────────────────────── */}
      {(known.length > 0 || learning.length > 0) && (
        <div className="mt-4 space-y-2 text-xs">
          {known.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-muted-foreground">Known:</span>
              {known.map((code) => {
                const lang = LANGUAGES.find((l) => l.code === code);
                return (
                  <span
                    key={code}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-primary"
                  >
                    {lang?.name}
                  </span>
                );
              })}
            </div>
          )}

          {learning.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-muted-foreground">Learning:</span>
              {learning.map((code) => {
                const lang = LANGUAGES.find((l) => l.code === code);
                return (
                  <span
                    key={code}
                    className="rounded-full bg-muted px-2 py-0.5 text-foreground"
                  >
                    {lang?.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────
          ERROR
          ──────────────────────────────────── */}
      {error && (
        <p className="mt-4 text-center text-sm text-destructive">{error}</p>
      )}

      {/* ────────────────────────────────────
          SUBMIT
          ──────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canContinue || submitting}
        className={cn(
          "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3",
          "text-sm font-semibold transition-opacity",
          canContinue && !submitting
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "cursor-not-allowed bg-muted text-muted-foreground",
        )}
      >
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Continue
      </button>
    </div>
  );
}