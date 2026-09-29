import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/site/general/theme/theme-provider";
import { MarketingNavbar } from "@/components/site/general/navbars/marketing-navbar";
import { Container } from "@/components/site/general/layouts/container";

// ============================================
// FONTS — Premium Configuration
// ============================================

const fontSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  style: ["normal"],
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: true,
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["monospace"],
  adjustFontFallback: true,
});

// ============================================
// VIEWPORT
// ============================================

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#2B2B28" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// ============================================
// SEO METADATA
// ============================================

export const metadata: Metadata = {
  title: {
    default: "LYXA AI — AI Hair, Beard & Style Try-On",
    template: "%s | LYXA AI",
  },
  description:
    "Transform your look with AI. Try new hairstyles, beard styles, outfits, hair colors, and age transformations in seconds. Free AI image generation included.",
  applicationName: "LYXA AI",
 
};

// ============================================
// PREMIUM TYPOGRAPHY — Airbnb / Stripe / Apple level
// ============================================

const premiumTypography = {
  fontFamily:
    "var(--font-plus-jakarta), 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  textRendering: "optimizeLegibility",
  textSizeAdjust: "100%",

  fontFeatureSettings:
    '"ss01" on, "ss02" on, "cv01" on, "cv02" on, "cv03" on, "liga" on, "calt" on, "kern" on, "cpsp" on, "case" on, "salt" on',
  fontVariantLigatures: "common-ligatures contextual",
  fontVariantNumeric: "proportional-nums",
  fontKerning: "normal",
  fontOpticalSizing: "auto",
  fontSynthesis: "none",

  letterSpacing: "-0.008em",
  wordSpacing: "-0.008em",

  lineHeight: 1.6,
} as const;

// ============================================
// ROOT LAYOUT
// ============================================

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
      style={premiumTypography}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
      </head>

      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkProvider>
            {/* ============================================
                NAVBAR — Fixed, positioned outside the Container
                so it doesn't inherit Container's max-width or padding.
                ============================================ */}
            <MarketingNavbar />

            {/* ============================================
                MAIN — pt-16 offsets the fixed navbar height (64px).
                The Container provides background, gradients, bubbles,
                and horizontal padding for the page content.
                ============================================ */}
            <main className="flex-1 ">
              <Container>{children}</Container>
              {/* <Footer/> */}
            </main>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}