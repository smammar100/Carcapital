import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/contexts/auth-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { getInitialAuth } from "@/lib/auth-initial";
import { AuthBoundary } from "@/components/layout/auth-boundary";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

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
      // <html>/<body> attributes before React hydrates. Suppress only silences
      // attribute mismatches on this element itself — children still warn.
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        figtree.variable,
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
        <Toaster richColors closeButton position="bottom-right" />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
