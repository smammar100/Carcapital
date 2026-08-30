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
import { useIsWelcomeScreen } from "@/hooks/use-has-vehicles";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, error, revalidate } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // The first-run screen owns the whole window: no rail beside it, because
  // there is nothing in the system yet for any of those links to lead to.
  const isWelcome = useIsWelcomeScreen(pathname);

  // Tab focus / route change → refresh the JWT in case it silently expired.
  useEffect(() => {
    void revalidate();
  }, [pathname, revalidate]);

  // A dead session used to render the whole dashboard shell with nobody in it:
  // the rail collapsed to Dashboard alone and every gated page reported "Access
  // restricted", which reads as "my permissions were taken away" rather than
  // "you are signed out". Middleware only redirects on a navigation, so a token
  // that expires while the tab sits open never triggers it — the user just
  // watches the app quietly stop working.
  //
  // `loading` matters: during boot `user` is legitimately null, and redirecting
  // then would bounce everyone to the login page on every refresh.
  const signedOut = !loading && !user;
  useEffect(() => {
    if (!signedOut) return;
    // Keep where they were so signing back in returns them to it.
    const next =
      pathname && pathname !== "/dashboard"
        ? `?next=${encodeURIComponent(pathname)}`
        : "";
    router.replace(`/login${next}`);
  }, [signedOut, pathname, router]);

  // Force users with a temp password through /set-password before any dashboard
  // route. Middleware can't see passwordResetRequired (public.users column, not
  // in the session JWT), so this stays client-side.
  const mustResetPassword = Boolean(user?.passwordResetRequired);
  useEffect(() => {
    if (mustResetPassword) {
      router.replace("/set-password");
    }
  }, [mustResetPassword, router]);

  // Guard the render, not just the effect: without this the shell paints once
  // with no user before the navigation lands, which is the "Access restricted"
  // flash itself.
  if (signedOut) return null;

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
      <nord-layout
        padding="none"
        persistNavState
        className={isWelcome ? "layout-on-navy" : undefined}
      >
        {!isWelcome && <AppSidebar />}
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
