import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
// Adobe Spectrum 2 global page styles (v4.5 migration §25 — commit 1).
// This loads Spectrum's CSS reset / page-level tokens. Component-level styles
// load on demand as components are imported elsewhere in the tree.
import "@react-spectrum/s2/page.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/contexts/auth-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SpectrumProvider } from "@/lib/spectrum-provider";

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
        <SpectrumProvider>
          <AuthProvider>
            <NotificationsProvider>
              <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
            </NotificationsProvider>
          </AuthProvider>
          <Toaster richColors closeButton position="bottom-right" />
        </SpectrumProvider>
      </body>
    </html>
  );
}
