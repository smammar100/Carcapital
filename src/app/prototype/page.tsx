"use client";

import { useState } from "react";
import {
  CalendarDays,
  Car,
  ChevronDown,
  ClipboardCheck,
  GitBranch,
  LayoutDashboard,
  MapPin,
  Plus,
  Receipt,
  Table,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /prototype — design comparison surface (auth-free).
 *
 * Current feature: NAVBAR / sidebar. 5 interactive variations side-by-side.
 * Each has a collapsible group tree (click a section header to open/close),
 * hover states, and a DISTINCT active state that does NOT mimic the solid-blue
 * "Add Vehicle" CTA. References (Mobbin): Microsoft Copilot / Circle (soft-tint
 * active), Zoho CRM / Shopify (collapsible sections + left-accent active), Deel
 * (uppercase sections, neutral pill active), Lyssna / Maze (expand/collapse
 * tree with connectors).
 */
export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Prototype — Navbar · 5 variations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a winner (A–E). Each is live: click a section header to
          open/close, hover items, click to set active. The active state is
          deliberately different from the solid-blue “Add Vehicle” CTA.
        </p>
      </header>

      <div className="flex flex-wrap gap-6">
        <Frame label="A — Soft-tint pill" sub="Copilot / Circle">
          <Sidebar variant="A" />
        </Frame>
        <Frame label="B — Left-accent bar" sub="Zoho / Shopify">
          <Sidebar variant="B" />
        </Frame>
        <Frame label="C — Accent text only" sub="minimal / Notion">
          <Sidebar variant="C" />
        </Frame>
        <Frame label="D — File-tree + connectors" sub="Lyssna / Maze">
          <Sidebar variant="D" />
        </Frame>
        <Frame label="E — Neutral pill + tick" sub="Deel (dense)">
          <Sidebar variant="E" />
        </Frame>
      </div>
    </div>
  );
}

function Frame({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-baseline justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      <div className="bg-background p-3">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------- shared nav data */

interface NavItem {
  label: string;
  icon: LucideIcon;
  badge?: string;
}
interface NavGroup {
  group: string;
  items: NavItem[];
}
const NAV: NavGroup[] = [
  {
    group: "Administrative",
    items: [
      { label: "Dashboard", icon: LayoutDashboard },
      { label: "Master Sheet", icon: Table },
      { label: "Master Calendar", icon: CalendarDays },
      { label: "Users & Permissions", icon: Users },
      { label: "Invoicing", icon: Receipt },
    ],
  },
  {
    group: "Inventory",
    items: [
      { label: "All Vehicles", icon: Car },
      { label: "Locations", icon: MapPin, badge: "New" },
    ],
  },
  {
    group: "Maintenance",
    items: [
      { label: "Pipeline", icon: GitBranch },
      { label: "Workshop Jobs", icon: Wrench },
      { label: "Inspection Queue", icon: ClipboardCheck },
    ],
  },
];

type Variant = "A" | "B" | "C" | "D" | "E";

// Active-item treatments — each visually distinct, none a solid-blue fill.
const ACTIVE: Record<Variant, string> = {
  A: "bg-primary/10 font-medium text-primary",
  B: "rounded-l-none border-l-2 border-primary bg-primary/5 font-medium text-foreground",
  C: "font-semibold text-primary",
  D: "bg-muted font-medium text-foreground",
  E: "bg-muted font-semibold text-foreground before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-primary",
};
const INACTIVE = "text-foreground/75 hover:bg-muted hover:text-foreground";

/* --------------------------------------------------------------- brand + CTA */

function NavHeader() {
  return (
    <div className="flex flex-col gap-3 px-1 pb-3">
      <div className="flex items-center gap-2 px-1">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold tracking-widest text-primary-foreground">
          CC
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold">Car Capital UK</div>
          <div className="truncate text-xs text-muted-foreground">
            Car Capital UK
          </div>
        </div>
      </div>
      {/* The solid-blue primary CTA — active nav states must look different */}
      <nord-button variant="primary" expand size="s">
        <Plus slot="start" className="h-4 w-4" />
        Add Vehicle
      </nord-button>
    </div>
  );
}

/* -------------------------------------------------------------- the sidebar */

function Sidebar({ variant }: { variant: Variant }) {
  // Maintenance starts collapsed so the closed state is visible at a glance.
  const [open, setOpen] = useState<Set<string>>(
    new Set(["Administrative", "Inventory"]),
  );
  const [active, setActive] = useState("Master Sheet");

  const toggle = (g: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const chevronLeft = variant === "D";

  return (
    <div className="flex h-[560px] w-64 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border p-2">
        <NavHeader />
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV.map((g) => {
          const isOpen = open.has(g.group);
          return (
            <div key={g.group} className="mb-1.5">
              <button
                type="button"
                onClick={() => toggle(g.group)}
                className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                {chevronLeft && (
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      !isOpen && "-rotate-90",
                    )}
                  />
                )}
                <span className="flex-1 text-left">{g.group}</span>
                {!chevronLeft && (
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      !isOpen && "-rotate-90",
                    )}
                  />
                )}
              </button>

              {isOpen && (
                <ul
                  className={cn(
                    "mt-0.5 flex flex-col gap-0.5",
                    variant === "D" && "ml-3 border-l border-border pl-2",
                  )}
                >
                  {g.items.map((it) => {
                    const on = active === it.label;
                    const showDot = variant === "C" && on;
                    return (
                      <li key={it.label}>
                        <button
                          type="button"
                          onClick={() => setActive(it.label)}
                          className={cn(
                            "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                            on ? ACTIVE[variant] : INACTIVE,
                          )}
                        >
                          {showDot ? (
                            <span className="grid h-4 w-4 shrink-0 place-items-center">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            </span>
                          ) : (
                            <it.icon className="h-4 w-4 shrink-0" />
                          )}
                          <span className="flex-1 truncate text-left">
                            {it.label}
                          </span>
                          {it.badge && (
                            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                              {it.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
