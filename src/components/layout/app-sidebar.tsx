"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import {
  SIDEBAR_GROUPS,
  activeHrefForPath,
  type SidebarGroup,
  type SidebarItem,
} from "./sidebar-config";
import { SIDEBAR_BADGES } from "./sidebar-badges";

// localStorage key for the user's persisted expand/collapse choices (GEN-29).
const COLLAPSED_STORAGE_KEY = "cc.sidebar.collapsed-groups";
// Every collapsible group label — the default "all collapsed" state.
const ALL_GROUP_LABELS: string[] = SIDEBAR_GROUPS.map((g) => g.label).filter(
  (label): label is string => label !== null,
);

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
  const { user, company } = useAuth();
  const { can, isSuperUser } = usePermissions();
  // Collapsed group labels. Default: every group collapsed (GEN-29) so the
  // sidebar loads compact; the group holding the active route is force-expanded
  // at render time. Deterministic on server + first client paint (no persisted
  // read here) so there's no hydration mismatch or active-group expand flicker.
  const [collapsed, setCollapsed] = React.useState<Set<string>>(
    () => new Set(ALL_GROUP_LABELS),
  );

  // Hydrate the user's persisted choices after mount. localStorage is
  // unavailable during SSR, so reading it in the initializer above would risk a
  // hydration mismatch; applying it in an effect keeps the first paint stable.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      // Deliberate post-mount setState: reading localStorage in the initializer
      // would diverge from the server render and cause a hydration mismatch, so
      // we hydrate the persisted state here instead. Runs once.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // Corrupt/blocked storage → keep the all-collapsed default.
    }
  }, []);

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

  // Exactly one nav item is active: the single longest href matching the current
  // path. This stops a parent route (/maintenance) from also highlighting when a
  // child route (/maintenance/calendar) is open (GEN-36).
  const activeHref = React.useMemo(() => activeHrefForPath(pathname), [pathname]);
  function isActive(href: string): boolean {
    return href === activeHref;
  }

  // The group containing the current route — always rendered expanded so the
  // active page stays visible even when the user's default is collapsed.
  const activeGroupLabel: string | null = React.useMemo(() => {
    const group = visibleGroups.find(
      (g) => g.label !== null && g.items.some((item) => isActive(item.href)),
    );
    return group?.label ?? null;
    // isActive is a pure function of pathname, so pathname is the real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleGroups, pathname]);

  function toggleGroup(label: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      // Persist the manual choice so it survives reloads/navigation (GEN-29).
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Ignore storage failures — in-memory state still updates.
      }
      return next;
    });
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
        // to align the brand with the nav items below it.
        className="flex min-w-0 items-center gap-2 py-1 pl-5 pr-3 no-underline"
      >
        {company?.logoMarkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoMarkUrl}
            alt={`${company.name} logo`}
            className="h-8 w-8 shrink-0 rounded-md object-contain"
          />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            CC
          </span>
        )}
        <span className="flex min-w-0 flex-col leading-tight">
          <span
            className="truncate text-sm font-semibold text-foreground"
            suppressHydrationWarning
          >
            {company?.name ?? "Car Capital UK"}
          </span>
          {/* The signed-in user's email, not a second copy of the company name
              (GEN-34). Falls back to a dash before hydration / when unknown. */}
          <span
            className="truncate text-xs text-muted-foreground"
            suppressHydrationWarning
          >
            {user?.email ?? "—"}
          </span>
        </span>
      </Link>

      <div className="flex flex-col gap-1.5 px-1 pb-2 pt-1">
        {visibleGroups.map((group) => {
          if (group.label === null) {
            return (
              <div key="__top">{renderItems(group.items)}</div>
            );
          }
          // Active group is always open so the current page stays visible;
          // otherwise honour the collapsed set (defaults to collapsed).
          const isOpen =
            group.label === activeGroupLabel || !collapsed.has(group.label);
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
