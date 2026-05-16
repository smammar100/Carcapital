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

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Car Capital UK",
  description: "Used-car dealership management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <NotificationsProvider>
            <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
          </NotificationsProvider>
        </AuthProvider>
        <Toaster richColors closeButton position="bottom-right" />
        {/* Vercel Speed Insights + Analytics — Core Web Vitals and
            page/audience analytics. NOTE: both only report when
            deployed on Vercel; the scripts are no-ops on Netlify (our
            current host), so they're harmless but inert until/unless
            the app is hosted on Vercel. */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
