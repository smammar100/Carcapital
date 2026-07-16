import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Suspense } from "react";
// Nord base (design tokens + Inter webfont + FOUC guard for undefined
// <nord-*> elements) MUST load before globals.css so our token bridge and
// `.dark` overrides win the cascade. Order = cascade order in the prod build.
import "@nordhealth/css";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/contexts/auth-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { NordRegister } from "@/components/nord/nord-register";
import { NordToaster } from "@/components/nord/nord-toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { getInitialAuth } from "@/lib/auth-initial";
import { AuthBoundary } from "@/components/layout/auth-boundary";

// UI font is Geist Sans (self-hosted via the `geist` package, exposing
// --font-geist-sans); globals.css points both --font-sans AND Nord's
// --n-font-family at it so Tailwind text and <nord-*> components match.
// Geist Mono (--font-geist-mono) covers code / monospaced values.

export const metadata: Metadata = {
  title: "Car Capital UK",
  description: "Used-car dealership management platform",
};

// Root layout reads cookies via getInitialAuth() — every route is dynamic.
// Force this explicitly so Next.js doesn't try to prerender child routes
// (which would trip the CSR-bailout error on pages using useSearchParams).
export const dynamic = "force-dynamic";

// Deploy to London first (UK = primary production market), Mumbai as fallback
// for South Asian traffic. Both are dramatically closer than the iad1 default.
export const preferredRegion = ["lhr1", "bom1"];

const SUPABASE_HOSTNAME = (() => {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return u ? new URL(u).hostname : null;
  } catch {
    return null;
  }
})();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Start the auth fetch without blocking — the HTML shell streams immediately
  // while Supabase resolves in the background. AuthBoundary awaits the promise
  // inside a Suspense boundary so fonts/CSS reach the browser ~400 ms sooner.
  const authPromise = getInitialAuth();

  return (
    <html
      lang="en"
      // Browser extensions (e.g. Demoway, focus-visible polyfills) mutate the
      // <html>/<body> attributes before React hydrates. next-themes also writes
      // the theme class here pre-hydration. Suppress silences attribute
      // mismatches on this element itself — children still warn.
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        GeistSans.variable,
        GeistMono.variable,
        "font-sans",
      )}
    >
      <head>
        {SUPABASE_HOSTNAME && (
          <>
            <link
              rel="preconnect"
              href={`https://${SUPABASE_HOSTNAME}`}
              crossOrigin=""
            />
            <link rel="dns-prefetch" href={`https://${SUPABASE_HOSTNAME}`} />
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Registers the <nord-*> custom elements on the client. */}
          <NordRegister />
          <Suspense
            fallback={
              <AuthProvider initialUser={null} initialCompany={null}>
                <NotificationsProvider>
                  <TooltipProvider delay={150}>{children}</TooltipProvider>
                </NotificationsProvider>
              </AuthProvider>
            }
          >
            <AuthBoundary authPromise={authPromise}>{children}</AuthBoundary>
          </Suspense>
          <NordToaster />
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
