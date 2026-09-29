import { cn } from "@/lib/utils";
import * as React from "react";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Container({ children, className, ...props }: ContainerProps) {
  return (
    <div
      className={cn(
        // ============================================
        // LAYOUT
        // ============================================
        "relative isolate mx-auto flex min-h-screen w-full flex-col",

        // Max width scales with screen
        "max-w-[480px] sm:max-w-[640px] md:max-w-3xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1440px] 3xl:max-w-[1680px] 4xl:max-w-[1920px]",

        // ============================================
        // RESPONSIVE HORIZONTAL PADDING
        // ============================================
        "px-3",
        "xs:px-4",
        "sm:px-5",
        "md:px-6",
        "lg:px-8",
        "xl:px-10",
        "2xl:px-12",
        "3xl:px-16",
        "4xl:px-20",

        // ============================================
        // BACKGROUND
        // ============================================
        "bg-background text-foreground",
        "overflow-hidden",

        // Light mode — warm layered radial gradients
        "bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_60%),radial-gradient(ellipse_60%_40%_at_15%_20%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_55%),radial-gradient(ellipse_60%_40%_at_85%_15%,color-mix(in_oklab,var(--primary)_6%,transparent),transparent_50%)]",

        // Dark mode — rich warm aurora gradients
        "dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_60%),radial-gradient(ellipse_60%_40%_at_15%_20%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_55%),radial-gradient(ellipse_60%_40%_at_85%_15%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_50%)]",

        // Smooth theme transition
        "transition-colors duration-500 ease-out",

        className,
      )}
      {...props}
    >
      {/* ============================================
          ANIMATED TOP GRADIENT ORB
          ============================================ */}
      <div
        aria-hidden
        className="lyxa-gradient-orb top-[-20%] left-1/2 -translate-x-1/2 h-[600px] w-[600px] sm:h-[700px] sm:w-[700px] lg:h-[900px] lg:w-[900px] bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_50%,transparent),transparent_70%)] dark:bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_65%,transparent),transparent_70%)]"
        style={{
          ["--gradient-opacity" as any]: 0.55,
          animationDuration: "14s",
        }}
      />

      {/* Secondary ambient glow — bottom right */}
      <div
        aria-hidden
        className="lyxa-gradient-orb bottom-[-20%] right-[-10%] h-[500px] w-[500px] sm:h-[600px] sm:w-[600px] lg:h-[800px] lg:w-[800px] bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_35%,transparent),transparent_70%)] dark:bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_45%,transparent),transparent_70%)]"
        style={{
          ["--gradient-opacity" as any]: 0.4,
          animationDuration: "18s",
          animationDelay: "-6s",
        }}
      />

      {/* ============================================
          FLOATING BUBBLES
          ============================================ */}

      <span
        aria-hidden
        className="lyxa-bubble bottom-[-100px] left-[8%] h-24 w-24 border border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10"
        style={{
          ["--bubble-opacity" as any]: 0.5,
          animationDuration: "22s",
          animationDelay: "0s",
        }}
      />

      <span
        aria-hidden
        className="lyxa-bubble bottom-[-100px] left-[28%] h-16 w-16 border border-primary/25 bg-primary/8 dark:border-primary/40 dark:bg-primary/15"
        style={{
          ["--bubble-opacity" as any]: 0.6,
          animationDuration: "18s",
          animationDelay: "-3s",
        }}
      />

      <span
        aria-hidden
        className="lyxa-bubble bottom-[-100px] left-[55%] h-10 w-10 border border-primary/30 bg-primary/10 dark:border-primary/40 dark:bg-primary/20"
        style={{
          ["--bubble-opacity" as any]: 0.7,
          animationDuration: "14s",
          animationDelay: "-6s",
        }}
      />

      <span
        aria-hidden
        className="lyxa-bubble bottom-[-100px] left-[72%] h-20 w-20 border border-primary/20 bg-primary/6 dark:border-primary/30 dark:bg-primary/12"
        style={{
          ["--bubble-opacity" as any]: 0.4,
          animationDuration: "26s",
          animationDelay: "-9s",
        }}
      />

      <span
        aria-hidden
        className="lyxa-bubble bottom-[-100px] left-[88%] h-6 w-6 border border-primary/35 bg-primary/12 dark:border-primary/45 dark:bg-primary/25"
        style={{
          ["--bubble-opacity" as any]: 0.8,
          animationDuration: "12s",
          animationDelay: "-2s",
        }}
      />

      <span
        aria-hidden
        className="lyxa-bubble bottom-[-100px] left-[42%] h-14 w-14 border border-primary/20 bg-primary/7 dark:border-primary/30 dark:bg-primary/14"
        style={{
          ["--bubble-opacity" as any]: 0.5,
          animationDuration: "20s",
          animationDelay: "-12s",
        }}
      />

      <span
        aria-hidden
        className="lyxa-bubble bottom-[-100px] left-[15%] h-28 w-28 border border-primary/15 bg-primary/4 dark:border-primary/25 dark:bg-primary/8"
        style={{
          ["--bubble-opacity" as any]: 0.35,
          animationDuration: "28s",
          animationDelay: "-15s",
        }}
      />

      <span
        aria-hidden
        className="lyxa-bubble bottom-[-100px] left-[65%] h-8 w-8 border border-primary/30 bg-primary/10 dark:border-primary/40 dark:bg-primary/18"
        style={{
          ["--bubble-opacity" as any]: 0.65,
          animationDuration: "16s",
          animationDelay: "-8s",
        }}
      />

      {/* ============================================
          PULSING CENTER GLOW
          ============================================ */}
      <div
        aria-hidden
        className="lyxa-pulse pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-[300px] w-[300px] sm:h-[400px] sm:w-[400px] lg:h-[500px] lg:w-[500px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_70%)] dark:bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_70%)] blur-3xl"
        style={{ animationDuration: "8s" }}
      />

      {/* ============================================
          CONTENT
          ============================================ */}
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}