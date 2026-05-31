"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useSidebarState } from "@/contexts/sidebar-state-context";
import { AddVehicleModal } from "@/components/vehicles/add-vehicle-modal";
import { getPrimaryCta, type PrimaryCta } from "@/lib/role-cta";
import {
  SIDEBAR_GROUPS,
  type SidebarGroup,
  type SidebarItem,
} from "./sidebar-config";
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
  const { can, isSuperUser } = usePermissions();
  const primaryCta = React.useMemo(
    () => getPrimaryCta({ isSuperUser, can }),
    [isSuperUser, can],
  );
  const { collapsed: railCollapsed, toggle: toggleRail } = useSidebarState();
  const [groupCollapsed, setGroupCollapsed] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [addOpen, setAddOpen] = React.useState(false);

  // Capability gating: an item shows if the user is a super-user, has no
  // gate, or holds ANY of its required capabilities. A group renders only
  // when at least one of its items is visible.
  const visibleGroups: SidebarGroup[] = React.useMemo(() => {
    const itemVisible = (item: SidebarItem) =>
      isSuperUser || !item.requiredAnyOf || item.requiredAnyOf.some(can);
    return SIDEBAR_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(itemVisible),
    })).filter((group) => group.items.length > 0);
  }, [can, isSuperUser]);

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
      className="group/sidebar flex h-full flex-col py-6"
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4",
          railCollapsed ? "justify-center" : "justify-between",
        )}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-3"
        >
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            CC
          </div>
          {!railCollapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">Car Capital UK</span>
              <span
                className="truncate text-xs text-muted-foreground"
                suppressHydrationWarning
              >
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

      {railCollapsed && (
        <div className="mt-3 flex justify-center">
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

      {primaryCta && (
        <div
          className={cn(
            "mt-5",
            railCollapsed ? "flex justify-center px-0" : "px-4",
          )}
        >
          <PrimaryCtaButton
            cta={primaryCta}
            collapsed={railCollapsed}
            active={isActive(primaryCta.activeMatch)}
            onModal={() => setAddOpen(true)}
          />
        </div>
      )}
      <AddVehicleModal open={addOpen} onOpenChange={setAddOpen} />

      <div className="h-6" />

      <nav className="min-h-0 flex-1 overflow-y-auto px-3">
        {visibleGroups.map((group, gi) => {
          const items = group.items;

          if (!group.label) {
            return (
              <div key={gi} className="mb-4 flex flex-col">
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

          const hasActive = items.some((i) => isActive(i.href));
          const isOpen = !groupCollapsed.has(group.label) || hasActive;

          if (railCollapsed) {
            return (
              <div key={gi} className="mb-4 flex flex-col">
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
            <div key={gi} className="mb-4 flex flex-col">
              <button
                type="button"
                onClick={() => toggleGroup(group.label!)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
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
                <div className="mt-1 flex flex-col">
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
  const linkClass = cn(
    "group/row relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
    active
      ? "bg-accent font-medium text-foreground"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
    collapsed && "justify-center",
  );

  const BadgeComponent = SIDEBAR_BADGES[item.href];
  const inner = (
    <Link href={item.href} className={linkClass}>
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

  return (
    <Tooltip>
      <TooltipTrigger render={inner} />
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function PrimaryCtaButton({
  cta,
  collapsed,
  active,
  onModal,
}: {
  cta: PrimaryCta;
  collapsed: boolean;
  active: boolean;
  onModal: () => void;
}) {
  const Icon = cta.icon;
  const expandedClass = cn(
    "group/cta flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active && "ring-2 ring-primary/40",
  );
  const railClass = cn(
    "grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active && "ring-2 ring-primary/40",
  );

  // Expanded rail — full-width control with label.
  if (!collapsed) {
    if (cta.kind === "modal") {
      return (
        <button
          type="button"
          onClick={onModal}
          className={expandedClass}
          aria-label={cta.label}
        >
          <Icon className="h-4 w-4" />
          <span>{cta.label}</span>
        </button>
      );
    }
    return (
      <Link
        href={cta.href ?? "#"}
        className={expandedClass}
        aria-label={cta.label}
      >
        <Icon className="h-4 w-4" />
        <span>{cta.label}</span>
      </Link>
    );
  }

  // Collapsed rail — icon-only with tooltip.
  const trigger =
    cta.kind === "modal" ? (
      <button
        type="button"
        onClick={onModal}
        className={railClass}
        aria-label={cta.label}
      >
        <Icon className="h-4 w-4" />
      </button>
    ) : (
      <Link href={cta.href ?? "#"} className={railClass} aria-label={cta.label}>
        <Icon className="h-4 w-4" />
      </Link>
    );

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent side="right" sideOffset={8}>
        {cta.label}
      </TooltipContent>
    </Tooltip>
  );
}
