import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
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

// UI font comes from Nord (Inter / "Nordhealth Sans") via @nordhealth/css and
// the --font-sans → --n-font-family mapping in globals.css. Geist Mono stays
// for code / monospaced values.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

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
        geistMono.variable,
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
