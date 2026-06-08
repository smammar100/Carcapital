"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { AddVehicleModal } from "@/components/vehicles/add-vehicle-modal";
import { getPrimaryCta, type PrimaryCta } from "@/lib/role-cta";
import {
  SIDEBAR_GROUPS,
  type SidebarGroup,
  type SidebarItem,
} from "./sidebar-config";
import { SIDEBAR_BADGES } from "./sidebar-badges";

// lucide → Nordicon name, keyed by nav href. Closest available interface-/
// navigation-/generic- icons; refine later as needed.
const NAV_ICON: Record<string, string> = {
  "/dashboard": "navigation-dashboard",
  "/admin/master-sheet": "interface-table",
  "/admin/master-calendar": "interface-calendar",
  "/admin/users-and-permissions": "user-multiple",
  "/admin/vehicle-returns": "arrow-undo",
  "/admin/invoicing": "file-invoice",
  "/admin/vendors": "generic-company",
  "/admin/activity": "interface-history",
  "/vehicles": "navigation-catalog",
  "/admin/locations": "interface-location-on",
  "/maintenance": "interface-setting-slider",
  "/maintenance/calendar": "interface-calendar",
  "/maintenance/inspection": "interface-checked-circle",
  "/maintenance/workshop": "interface-content-book",
  "/advert/work-list": "interface-content-book",
  "/advert/photo-processing": "file-picture",
  "/advert/listings": "interface-globe",
  "/advert/performance": "graph-bars",
  "/sales/leads": "user-add",
  "/sales/appointments": "interface-calendar",
  "/sales/pipeline": "graph-trend-up",
  "/sales/deals": "interface-shopping-cart",
  "/sales/invoice-generation": "file-invoice",
  "/warranties/in-house": "interface-shield",
  "/warranties/external": "interface-new-window",
  "/warranties/claims": "interface-warning",
};
const FALLBACK_ICON = "interface-grid";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { company } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const [addOpen, setAddOpen] = React.useState(false);

  const primaryCta = React.useMemo(
    () => getPrimaryCta({ isSuperUser, can }),
    [isSuperUser, can],
  );

  // Capability gating (unchanged): an item shows for super-users, items with no
  // gate, or items where the user holds ANY required capability. A group renders
  // only if at least one item is visible.
  const visibleGroups: SidebarGroup[] = React.useMemo(() => {
    const itemVisible = (item: SidebarItem) =>
      isSuperUser || !item.requiredAnyOf || item.requiredAnyOf.some(can);
    return SIDEBAR_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(itemVisible),
    })).filter((group) => group.items.length > 0);
  }, [can, isSuperUser]);

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Keep client-side routing: <nord-nav-item href> renders a real <a> (good for
  // a11y / open-in-new-tab), but a plain click would full-reload — so intercept
  // and route via Next, while letting modifier-clicks use the native link.
  function handleNav(e: React.MouseEvent, href: string): void {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    e.preventDefault();
    router.push(href);
  }

  return (
    <nord-navigation slot="nav">
      <Link
        slot="header"
        href="/dashboard"
        className="flex min-w-0 items-center gap-2 px-1 py-1 no-underline"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          CC
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">
            Car Capital UK
          </span>
          <span
            className="truncate text-xs text-muted-foreground"
            suppressHydrationWarning
          >
            {company?.name ?? "—"}
          </span>
        </span>
      </Link>

      {primaryCta && (
        <div className="px-2 pb-2">
          <PrimaryCtaButton
            cta={primaryCta}
            onModal={() => setAddOpen(true)}
            onNav={handleNav}
          />
        </div>
      )}
      <AddVehicleModal open={addOpen} onOpenChange={setAddOpen} />

      {visibleGroups.map((group, gi) => (
        <nord-nav-group key={gi} heading={group.label ?? undefined}>
          {group.items.map((item) => {
            const Badge = SIDEBAR_BADGES[item.href];
            return (
              <nord-nav-item
                key={item.href}
                href={item.href}
                icon={NAV_ICON[item.href] ?? FALLBACK_ICON}
                active={isActive(item.href) || undefined}
                onClick={(e: React.MouseEvent) => handleNav(e, item.href)}
              >
                {item.label}
                {Badge ? <Badge /> : null}
              </nord-nav-item>
            );
          })}
        </nord-nav-group>
      ))}
    </nord-navigation>
  );
}

function PrimaryCtaButton({
  cta,
  onModal,
  onNav,
}: {
  cta: PrimaryCta;
  onModal: () => void;
  onNav: (e: React.MouseEvent, href: string) => void;
}): React.ReactElement {
  if (cta.kind === "modal") {
    return (
      <nord-button variant="primary" expand onClick={onModal}>
        <nord-icon slot="start" name="interface-add-small" />
        {cta.label}
      </nord-button>
    );
  }
  return (
    <nord-button
      variant="primary"
      expand
      href={cta.href}
      onClick={(e: React.MouseEvent) => cta.href && onNav(e, cta.href)}
    >
      {cta.label}
    </nord-button>
  );
}
