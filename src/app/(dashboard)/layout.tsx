"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  SidebarStateProvider,
  useSidebarState,
} from "@/contexts/sidebar-state-context";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GridOverlay } from "@/components/layout/grid-overlay";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";

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

  // Post-mount belt-and-suspenders: if the client-side auth becomes null
  // (sign-out from another tab, banned account) bounce to /login. Server
  // middleware already handles the cold-start unauthenticated case.
  useEffect(() => {
    if (!user) {
      router.replace("/login");
    } else if (user.passwordResetRequired) {
      router.replace("/set-password");
    }
  }, [user, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
        <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Can&apos;t connect</h1>
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

  if (!user) return null;

  return (
    <SidebarStateProvider>
      <Shell>{children}</Shell>
    </SidebarStateProvider>
  );
}

/**
 * Shell — 2x2 CSS Grid:
 *   ┌────────────────────────────┐
 *   │ sidebar │     header       │
 *   │         ├──────────────────┤
 *   │         │      main        │
 *   └────────────────────────────┘
 * Sidebar width comes from `--shell-sidebar-w` (260px expanded, 64px
 * collapsed); header height from `--shell-header-h` (56px). Main scrolls
 * independently while sidebar + header remain pinned.
 */
function Shell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarState();
  return (
    <div
      data-shell
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      className="grid h-screen w-screen overflow-hidden bg-background"
      style={{
        // Literal px values here (not var(--shell-sidebar-w) etc) — the
        // variables resolved correctly via getPropertyValue but the grid
        // engine read them as the *expanded* value, suspect Tailwind v4
        // `@theme inline` is shadowing them. Source-of-truth tokens still
        // live in globals.css for any other consumer.
        gridTemplateColumns: collapsed ? "64px 1fr" : "260px 1fr",
        gridTemplateRows: "56px 1fr",
        gridTemplateAreas: '"sidebar header" "sidebar main"',
        transition: "grid-template-columns 200ms ease",
      }}
    >
      <aside
        style={{ gridArea: "sidebar" }}
        className="overflow-hidden border-r bg-sidebar"
      >
        <AppSidebar />
      </aside>
      <header
        style={{ gridArea: "header" }}
        className="border-b bg-background"
      >
        <AppHeader />
      </header>
      <main
        style={{ gridArea: "main" }}
        className="relative overflow-y-auto bg-muted/20"
      >
        {/* LeafyGreen-style content cap (1152px default). Pages that need
            the wider 1400px frame — Master Sheet et al. — render their
            own <PageShell wide> inside this default one; the inner wrapper
            wins because its max-w is higher. See plan §G4. */}
        <PageShell>{children}</PageShell>
        {/* Dev-only column + 4px baseline overlay; appears when the URL
            contains `?grid=1`, otherwise renders nothing. */}
        <GridOverlay />
      </main>
    </div>
  );
}
