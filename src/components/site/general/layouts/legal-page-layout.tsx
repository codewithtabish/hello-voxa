"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  FileText,
  Sparkles,
  ArrowRight,
  Calendar,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

interface LegalPageLayoutProps {
  badge: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  readingTime: string;
  sections: LegalSection[];
  accentIcon?: React.ElementType;
}

// ============================================
// ANIMATION VARIANTS
// ============================================

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function LegalPageLayout({
  badge,
  title,
  subtitle,
  lastUpdated,
  readingTime,
  sections,
  accentIcon: AccentIcon = FileText,
}: LegalPageLayoutProps) {
  const [activeId, setActiveId] = React.useState<string>(
    sections[0]?.id ?? "",
  );

  // ============================================
  // 1. STRIP ANY EXISTING HASH FROM URL ON MOUNT
  //    (fixes the browser retaining #data-security from a previous visit)
  // ============================================
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // If the URL has a hash, remove it without adding a new history entry
    if (window.location.hash) {
      const cleanUrl =
        window.location.pathname + window.location.search;
      window.history.replaceState(null, "", cleanUrl);
    }

    // Also scroll to top on first mount (clean start)
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // ============================================
  // 2. TRACK WHICH SECTION IS IN VIEW
  // ============================================
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 },
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  // ============================================
  // 3. SMOOTH SCROLL WITHOUT TOUCHING THE URL
  // ============================================
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    const offset = 100; // offset for fixed navbar
    const top =
      el.getBoundingClientRect().top + window.scrollY - offset;

    // ✅ window.scrollTo does NOT modify the URL — no hash is appended
    window.scrollTo({ top, behavior: "smooth" });
    setActiveId(id);
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* ============================================
          HERO
          ============================================ */}
      <section className="relative w-full py-12 sm:py-14 lg:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px] dark:bg-primary/15" />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <motion.div variants={itemVariants} className="mb-5">
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 rounded-full border-primary/30 bg-primary/10",
                "px-3.5 py-1.5",
                "text-[11px] font-bold uppercase tracking-[0.15em] text-primary",
              )}
            >
              <AccentIcon className="size-3" strokeWidth={2.5} />
              {badge}
            </Badge>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className={cn(
              "text-3xl font-extrabold leading-[1.1] tracking-[-0.032em] text-foreground",
              "sm:text-4xl md:text-5xl lg:text-[3.5rem]",
            )}
          >
            {title}
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-5 max-w-xl text-sm leading-[1.7] text-muted-foreground sm:text-base"
          >
            {subtitle}
          </motion.p>

          {/* Meta row */}
          <motion.div
            variants={itemVariants}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
          >
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
              <Calendar className="size-3.5 text-primary" strokeWidth={2.5} />
              Last updated:{" "}
              <span className="font-semibold text-foreground">
                {lastUpdated}
              </span>
            </span>
            <span className="hidden size-1 rounded-full bg-border sm:block" />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
              <Clock className="size-3.5 text-primary" strokeWidth={2.5} />
              {readingTime} read
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* ============================================
          CONTENT — 2 COLUMN (TOC + BODY)
          ============================================ */}
      <section className="relative w-full pb-12 sm:pb-14 lg:pb-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          {/* ============================================
              SIDEBAR — TABLE OF CONTENTS
              ============================================ */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-4"
          >
            <div className="lg:sticky lg:top-24">
              <div
                className={cn(
                  "rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm",
                  "p-5",
                )}
              >
                <div className="mb-4 flex items-center gap-2">
                  <FileText
                    className="size-4 text-primary"
                    strokeWidth={2.5}
                  />
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">
                    On This Page
                  </h3>
                </div>

                <nav className="flex flex-col gap-1">
                  {sections.map((section, i) => {
                    const isActive = activeId === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className={cn(
                          "group flex w-full items-center gap-2.5 rounded-lg",
                          "px-3 py-2 text-left",
                          "text-[13px] font-medium",
                          "transition-all duration-200",
                          "cursor-pointer",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full",
                            "text-[10px] font-bold",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="truncate">{section.title}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* Contact hint */}
                <div className="mt-5 border-t border-border/50 pt-4">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      strokeWidth={2.5}
                    />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[12px] font-semibold text-foreground">
                        Questions?
                      </p>
                      <a
                        href="mailto:tabish@codewithtabish.com"
                        className="text-[11px] text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        tabish@codewithtabish.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>

          {/* ============================================
              MAIN CONTENT
              ============================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-8"
          >
            <div
              className={cn(
                "rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm",
                "p-5 sm:p-7 lg:p-8",
              )}
            >
              <div className="flex flex-col gap-10">
                {sections.map((section, i) => (
                  <motion.section
                    key={section.id}
                    id={section.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{
                      duration: 0.5,
                      delay: i * 0.03,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="scroll-mt-24"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-xl",
                          "bg-linear-to-br from-primary to-primary/70",
                          "text-sm font-extrabold text-primary-foreground",
                          "shadow-md shadow-primary/25",
                        )}
                      >
                        {i + 1}
                      </span>
                      <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-foreground sm:text-xl">
                        {section.title}
                      </h2>
                    </div>

                    <div className="flex flex-col gap-3.5 text-[13px] leading-[1.75] text-muted-foreground sm:text-sm">
                      {section.body}
                    </div>
                  </motion.section>
                ))}
              </div>
            </div>

            {/* ============================================
                BOTTOM CTA
                ============================================ */}
            <div
              className={cn(
                "mt-5 overflow-hidden rounded-2xl",
                "border border-primary/25 bg-linear-to-br from-primary/10 via-card/40 to-card/20",
                "p-6 sm:p-7",
              )}
            >
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5">
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                      "bg-linear-to-br from-primary to-primary/70",
                      "shadow-md shadow-primary/25",
                    )}
                  >
                    <Sparkles
                      className="size-5 text-primary-foreground"
                      strokeWidth={2.5}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-bold text-foreground sm:text-[15px]">
                      Have questions about this policy?
                    </h3>
                    <p className="text-[12px] text-muted-foreground sm:text-[13px]">
                      Our team is happy to help — reach out anytime.
                    </p>
                  </div>
                </div>

                <Button
                  asChild
                  size="lg"
                  className={cn(
                    "group/btn h-10 shrink-0 rounded-full px-5",
                    "bg-linear-to-r from-primary to-primary/80",
                    "text-sm font-semibold text-primary-foreground",
                    "shadow-md shadow-primary/25",
                    "transition-all duration-300",
                    "hover:shadow-lg hover:shadow-primary/35",
                  )}
                >
                  <Link href="/contact">
                    Contact Us
                    <ArrowRight
                      className="ml-2 size-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5"
                      strokeWidth={2.5}
                    />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}