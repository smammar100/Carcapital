import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/contexts/auth-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ClientProvider } from "./provider";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve preferred locale from the Accept-Language header. Falls back to
  // en-US so the React Spectrum S2 Provider always gets a valid BCP-47 tag.
  const acceptLanguage = (await headers()).get("accept-language");
  const lang = acceptLanguage?.split(/[,;]/)[0] ?? "en-US";

  return (
    <ClientProvider
      lang={lang}
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
      </body>
    </ClientProvider>
  );
}
