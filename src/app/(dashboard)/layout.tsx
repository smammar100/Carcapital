"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  SidebarStateProvider,
  useSidebarState,
} from "@/contexts/sidebar-state-context";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

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
        gridTemplateColumns: collapsed
          ? "var(--shell-sidebar-collapsed-w) 1fr"
          : "var(--shell-sidebar-w) 1fr",
        gridTemplateRows: "var(--shell-header-h) 1fr",
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
        className="overflow-y-auto bg-muted/20"
      >
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
