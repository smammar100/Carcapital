"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { AddVehicleModal } from "@/components/vehicles/add-vehicle-modal";
import { getPrimaryCta, type PrimaryCta } from "@/lib/role-cta";
import { cn } from "@/lib/utils";
import {
  SIDEBAR_GROUPS,
  type SidebarGroup,
  type SidebarItem,
} from "./sidebar-config";
import { SIDEBAR_BADGES } from "./sidebar-badges";

// Active = neutral pill + left accent tick (prototype "Variation E"). Crucially
// NOT a solid-blue fill, so it never reads like the primary "Add Vehicle" CTA.
const ITEM_BASE =
  "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm no-underline transition-colors";
const ITEM_ACTIVE =
  "bg-muted font-semibold text-foreground before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-primary";
const ITEM_INACTIVE =
  "text-foreground/75 hover:bg-muted hover:text-foreground";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { company } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const [addOpen, setAddOpen] = React.useState(false);
  // Collapsed group labels (in-memory; persists across SPA navigation since the
  // sidebar stays mounted in the dashboard layout). Default: all expanded.
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

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

  function toggleGroup(label: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Client-side routing comes free from <Link>; modifier-clicks open a new tab.
  function handleCtaNav(e: React.MouseEvent, href: string): void {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    e.preventDefault();
    router.push(href);
  }

  const renderItems = (items: SidebarItem[]) => (
    <ul className="mt-0.5 flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        const on = isActive(item.href);
        const Badge = SIDEBAR_BADGES[item.href];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cn(ITEM_BASE, on ? ITEM_ACTIVE : ITEM_INACTIVE)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {Badge ? <Badge /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nord-navigation slot="nav">
      <Link
        slot="header"
        href="/dashboard"
        // Nord's header slot has no inset (unlike the body), so add left padding
        // to align the brand with the nav items / CTA below it.
        className="flex min-w-0 items-center gap-2 py-1 pl-5 pr-3 no-underline"
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
            onNav={handleCtaNav}
          />
        </div>
      )}
      <AddVehicleModal open={addOpen} onOpenChange={setAddOpen} />

      <div className="flex flex-col gap-1.5 px-1 pb-2">
        {visibleGroups.map((group) => {
          if (group.label === null) {
            return (
              <div key="__top">{renderItems(group.items)}</div>
            );
          }
          const isOpen = !collapsed.has(group.label);
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => toggleGroup(group.label as string)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform",
                    !isOpen && "-rotate-90",
                  )}
                />
              </button>
              {isOpen && renderItems(group.items)}
            </div>
          );
        })}
      </div>
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
