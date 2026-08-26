"use client";

import { Suspense, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GridOverlay } from "@/components/layout/grid-overlay";
import { PageShell } from "@/components/layout/page-shell";
import { RouteGuard } from "@/components/layout/route-guard";
import { CommandPalette } from "@/components/layout/command-palette";
import { Button } from "@/components/ui/button";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, error, revalidate } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Tab focus / route change → refresh the JWT in case it silently expired.
  useEffect(() => {
    void revalidate();
  }, [pathname, revalidate]);

  // Force users with a temp password through /set-password before any dashboard
  // route. Middleware can't see passwordResetRequired (public.users column, not
  // in the session JWT), so this stays client-side.
  const mustResetPassword = Boolean(user?.passwordResetRequired);
  useEffect(() => {
    if (mustResetPassword) {
      router.replace("/set-password");
    }
  }, [mustResetPassword, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
        <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h1 className="text-base font-semibold">Can&apos;t connect</h1>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <p className="mb-4 text-xs text-muted-foreground">
            If you&apos;re a deployer: check that{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            are set in the Vercel project environment, then redeploy.
          </p>
          <Button type="button" onClick={() => location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Block rendering of protected children while the forced-reset redirect is
  // pending. Guarding render (not just firing an effect) means a user with
  // password_reset_required can never briefly interact with the app between the
  // effect scheduling and the navigation completing.
  if (mustResetPassword) {
    return null;
  }

  // Nord layout owns the sidebar/header chrome + responsive nav toggle, peek,
  // and collapse persistence (persist-nav-state) — replacing the old custom
  // 2×2 grid shell + sidebar-state-context. PageShell keeps content padding, so
  // the layout's own padding is disabled.
  return (
    <OnboardingTour>
      <nord-layout padding="none" persistNavState>
        <AppSidebar />
        <AppHeader />
        <PageShell>
          <RouteGuard>{children}</RouteGuard>
        </PageShell>
        <CommandPalette />
        <Suspense fallback={null}>
          <GridOverlay />
        </Suspense>
      </nord-layout>
    </OnboardingTour>
  );
}
