"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SurfaceProvider } from "@/lib/surface-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, error } = useAuth();
  const router = useRouter();

  // Belt-and-suspenders redirect once auth resolves. Sits at the top of
  // the component so it runs in the same order on every render (rules
  // of hooks — never call useEffect after a conditional `return`).
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Hard failure path — auth context couldn't even initialise (typically
  // missing NEXT_PUBLIC_SUPABASE_* env vars at build time). Show a visible
  // error instead of leaving the user staring at an infinite skeleton.
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
            are set in the Netlify site environment, then redeploy.
          </p>
          <Button type="button" onClick={() => location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  return (
    <SurfaceProvider value={0}>
      <SidebarStateProvider>
        <Shell>{children}</Shell>
      </SidebarStateProvider>
    </SurfaceProvider>
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
