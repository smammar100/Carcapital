"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/contexts/auth-context";
import { useSidebarState } from "@/contexts/sidebar-state-context";
import { SIDEBAR_GROUPS, type SidebarItem } from "./sidebar-config";
import { SIDEBAR_BADGES } from "./sidebar-badges";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "cc:sidebar:collapsed";

function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveCollapsed(s: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...s]));
}

export function AppSidebar() {
  const pathname = usePathname();
  const { company } = useAuth();
  const { collapsed: railCollapsed, toggle: toggleRail } = useSidebarState();
  const [groupCollapsed, setGroupCollapsed] = React.useState<Set<string>>(
    () => new Set(),
  );

  React.useEffect(() => {
    setGroupCollapsed(loadCollapsed());
  }, []);

  function toggleGroup(label: string) {
    setGroupCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      saveCollapsed(next);
      return next;
    });
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div
      data-collapsed={railCollapsed ? "true" : "false"}
      className="group/sidebar flex h-full flex-col"
      style={{
        // Token-driven internal spacing so the layout follows the design rhythm.
        paddingTop: "var(--space-6)",
        paddingBottom: "var(--space-6)",
      }}
    >
      {/* Brand row — logo + name on the left; collapse toggle inline on the
          right when expanded, on a separate row beneath when railed. */}
      <div
        className={cn(
          "flex items-center",
          railCollapsed ? "justify-center" : "justify-between",
        )}
        style={{
          paddingLeft: "var(--space-4)",
          paddingRight: "var(--space-4)",
          gap: "var(--space-3)",
        }}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center"
          style={{ gap: "var(--space-3)" }}
        >
          <div
            className="grid place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
            style={{ height: 32, width: 32 }}
          >
            CC
          </div>
          {!railCollapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">Car Capital UK</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {company?.name ?? "—"}
              </span>
            </div>
          )}
        </Link>
        {!railCollapsed && (
          <button
            type="button"
            onClick={toggleRail}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Rail-mode expand button — placed directly beneath the logo so the
          user always has a way back to the expanded state. */}
      {railCollapsed && (
        <div
          className="flex justify-center"
          style={{ marginTop: "var(--space-3)" }}
        >
          <button
            type="button"
            onClick={toggleRail}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Primary CTA — "Add Vehicle" lives at the top of the sidebar so the
          most frequent inventory-creation action is one click from anywhere
          in the app. Mirrors the rail/expanded affordance of the rest of
          the nav (icon-only with hover popover in rail mode). */}
      <div
        style={{
          marginTop: "var(--space-5)",
          paddingLeft: railCollapsed ? 0 : "var(--space-4)",
          paddingRight: railCollapsed ? 0 : "var(--space-4)",
        }}
        className={cn(railCollapsed && "flex justify-center")}
      >
        <AddVehicleCta collapsed={railCollapsed} active={isActive("/inventory/add-vehicle")} />
      </div>

      {/* CTA → first nav-item gap (slightly tighter than the original
          brand→nav gap because the CTA already provides visual breathing room). */}
      <div style={{ height: "var(--space-6)" }} />

      {/* Scrollable nav region */}
      <nav
        className="min-h-0 flex-1 overflow-y-auto"
        style={{
          paddingLeft: "var(--space-3)",
          paddingRight: "var(--space-3)",
        }}
      >
        {SIDEBAR_GROUPS.map((group, gi) => {
          const items = group.items;

          // Single-item groups (Dashboard) render as a flat row.
          if (!group.label) {
            return (
              <div
                key={gi}
                style={{ marginBottom: "var(--space-4)" }}
                className="flex flex-col"
              >
                {items.map((item) => (
                  <NavRow
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    collapsed={railCollapsed}
                  />
                ))}
              </div>
            );
          }

          // Labeled groups: header + collapsible item list.
          const hasActive = items.some((i) => isActive(i.href));
          const isOpen = !groupCollapsed.has(group.label) || hasActive;

          if (railCollapsed) {
            // In rail mode each group becomes a hover-popover stack of icons.
            return (
              <div
                key={gi}
                style={{ marginBottom: "var(--space-4)" }}
                className="flex flex-col"
              >
                {items.map((item) => (
                  <NavRow
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    collapsed
                  />
                ))}
              </div>
            );
          }

          return (
            <div
              key={gi}
              style={{ marginBottom: "var(--space-4)" }}
              className="flex flex-col"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.label!)}
                className="flex w-full items-center justify-between rounded-md text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                style={{
                  paddingLeft: "var(--space-3)",
                  paddingRight: "var(--space-3)",
                  paddingTop: "var(--space-2)",
                  paddingBottom: "var(--space-2)",
                }}
                aria-label={`Toggle ${group.label} group`}
                aria-expanded={isOpen}
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    !isOpen && "-rotate-90",
                  )}
                />
              </button>
              {isOpen && (
                <div
                  className="flex flex-col"
                  style={{ marginTop: "var(--space-1)" }}
                >
                  {items.map((item) => (
                    <NavRow
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      collapsed={false}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

    </div>
  );
}

interface NavRowProps {
  item: SidebarItem;
  active: boolean;
  collapsed: boolean;
}

function NavRow({ item, active, collapsed }: NavRowProps) {
  const Icon = item.icon;
  const className = cn(
    "group/row relative flex items-center rounded-md text-sm transition-colors",
    active
      ? "bg-accent font-medium text-foreground"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
    collapsed ? "justify-center" : "",
  );
  const style: React.CSSProperties = {
    paddingLeft: "var(--space-3)",
    paddingRight: "var(--space-3)",
    paddingTop: "var(--space-2)",
    paddingBottom: "var(--space-2)",
    gap: "var(--space-3)",
  };

  const BadgeComponent = SIDEBAR_BADGES[item.href];
  const inner = (
    <Link href={item.href} className={className} style={style}>
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-primary"
        />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && BadgeComponent && <BadgeComponent />}
    </Link>
  );

  if (!collapsed) return inner;

  // Rail mode — wrap in popover so hovering reveals the label.
  return (
    <Popover>
      <PopoverTrigger asChild>{inner}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="center"
        className="w-auto p-2 text-xs"
      >
        {item.label}
      </PopoverContent>
    </Popover>
  );
}

/**
 * AddVehicleCta — sidebar-top primary action.
 *
 * Expanded: full-width solid primary button with Plus icon + label.
 * Railed: square icon button (32×32) styled as primary; popover reveals
 * the label on hover, matching every other rail-mode nav row.
 */
function AddVehicleCta({
  collapsed,
  active,
}: {
  collapsed: boolean;
  active: boolean;
}) {
  const expandedClass = cn(
    "group/cta flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active && "ring-2 ring-primary/40",
  );
  const railClass = cn(
    "grid place-items-center rounded-md bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active && "ring-2 ring-primary/40",
  );

  if (!collapsed) {
    return (
      <Link
        href="/inventory/add-vehicle"
        className={expandedClass}
        style={{ gap: "var(--space-2)" }}
        aria-label="Add Vehicle"
      >
        <Plus className="h-4 w-4" />
        <span>Add Vehicle</span>
      </Link>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Link
          href="/inventory/add-vehicle"
          className={railClass}
          style={{ height: 32, width: 32 }}
          aria-label="Add Vehicle"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="center"
        className="w-auto p-2 text-xs"
      >
        Add Vehicle
      </PopoverContent>
    </Popover>
  );
}

