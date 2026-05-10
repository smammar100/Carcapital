"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  ActionButton,
  Avatar,
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
  DisclosureTitle,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import { useAuth } from "@/contexts/auth-context";
import { useSidebarState } from "@/contexts/sidebar-state-context";
import { SIDEBAR_GROUPS, type SidebarItem } from "./sidebar-config";

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

/**
 * v4.5 Spectrum sidebar.
 * - Brand row uses Spectrum Avatar for the company badge
 * - Collapsible groups use Spectrum Disclosure
 * - Rail-mode item tooltips use Spectrum TooltipTrigger
 * - Sidebar collapse toggle uses Spectrum ActionButton
 * - Lucide icons retained inside nav rows (Spectrum's icon set doesn't cover
 *   every domain concept the sidebar needs; visual consistency is acceptable)
 */
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

  function toggleGroup(label: string, isExpanded: boolean) {
    setGroupCollapsed((prev) => {
      const next = new Set(prev);
      if (isExpanded) next.delete(label);
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
        paddingTop: "var(--space-6)",
        paddingBottom: "var(--space-6)",
      }}
    >
      {/* Brand row — Spectrum Avatar + name + collapse toggle */}
      <div
        className={
          railCollapsed
            ? "flex items-center justify-center"
            : "flex items-center justify-between"
        }
        style={{
          paddingLeft: "var(--space-4)",
          paddingRight: "var(--space-4)",
          gap: "var(--space-3)",
        }}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center"
          style={{ gap: "var(--space-3)", textDecoration: "none" }}
        >
          <Avatar size={32}>CC</Avatar>
          {!railCollapsed && (
            <div
              className="flex min-w-0 flex-col leading-tight"
              style={{ gap: 2 }}
            >
              <Text
                UNSAFE_style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                Car Capital UK
              </Text>
              <Text
                UNSAFE_style={{
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                }}
              >
                {company?.name ?? "—"}
              </Text>
            </div>
          )}
        </Link>
        {!railCollapsed && (
          <ActionButton
            isQuiet
            aria-label="Collapse sidebar"
            onPress={toggleRail}
          >
            <ChevronsLeft size={16} />
          </ActionButton>
        )}
      </div>

      {/* Rail-mode expand button */}
      {railCollapsed && (
        <div
          className="flex justify-center"
          style={{ marginTop: "var(--space-3)" }}
        >
          <ActionButton
            isQuiet
            aria-label="Expand sidebar"
            onPress={toggleRail}
          >
            <ChevronsRight size={16} />
          </ActionButton>
        </div>
      )}

      {/* Brand → first nav-item gap */}
      <div style={{ height: "var(--space-8)" }} />

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

          // Single-item group (Dashboard) — flat row.
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

          // Rail mode — flat icon stack, no headers.
          if (railCollapsed) {
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

          // Expanded — Spectrum Disclosure with collapsible group.
          const hasActive = items.some((i) => isActive(i.href));
          const isOpen = !groupCollapsed.has(group.label) || hasActive;

          return (
            <Disclosure
              key={gi}
              isExpanded={isOpen}
              onExpandedChange={(expanded) =>
                toggleGroup(group.label!, expanded)
              }
              UNSAFE_style={{
                marginBottom: "var(--space-2)",
                background: "transparent",
                border: "none",
              }}
            >
              <DisclosureHeader>
                <DisclosureTitle>
                  <Text
                    UNSAFE_style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {group.label}
                  </Text>
                </DisclosureTitle>
              </DisclosureHeader>
              <DisclosurePanel>
                <div className="flex flex-col">
                  {items.map((item) => (
                    <NavRow
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      collapsed={false}
                    />
                  ))}
                </div>
              </DisclosurePanel>
            </Disclosure>
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

  const linkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    padding: collapsed
      ? "var(--space-2)"
      : "var(--space-2) var(--space-3)",
    borderRadius: 6,
    fontSize: 14,
    textDecoration: "none",
    color: active ? "var(--foreground)" : "var(--muted-foreground)",
    fontWeight: active ? 500 : 400,
    background: active ? "var(--accent)" : "transparent",
    transition: "background-color 120ms, color 120ms",
    justifyContent: collapsed ? "center" : "flex-start",
    position: "relative",
  };

  const inner = (
    <Link href={item.href} style={linkStyle}>
      {active && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            height: 20,
            width: 2,
            transform: "translateY(-50%)",
            background: "var(--primary)",
            borderRadius: "0 2px 2px 0",
          }}
        />
      )}
      <Icon size={16} style={{ flexShrink: 0 }} />
      {!collapsed && (
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.label}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return inner;

  // Rail mode — Spectrum TooltipTrigger reveals the label on hover.
  return (
    <TooltipTrigger delay={300}>
      {inner}
      <Tooltip placement="end">{item.label}</Tooltip>
    </TooltipTrigger>
  );
}
