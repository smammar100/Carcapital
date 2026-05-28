import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/contexts/auth-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { getInitialAuth } from "@/lib/auth-initial";

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
  const { user, company } = await getInitialAuth();

  return (
    <html
      lang="en"
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
      <body className="min-h-full flex flex-col">
        <AuthProvider initialUser={user} initialCompany={company}>
          <NotificationsProvider>
            <TooltipProvider delay={150}>{children}</TooltipProvider>
          </NotificationsProvider>
        </AuthProvider>
        <Toaster richColors closeButton position="bottom-right" />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
