import {
  LayoutDashboard,
  Car,
  Wrench,
  ClipboardCheck,
  Calendar as CalendarIcon,
  Megaphone,
  // Image as ImageIcon, // restore with the Photo Processing nav item
  UserPlus,
  CalendarCheck,
  TrendingUp,
  Shield,
  ExternalLink,
  Receipt,
  Store,
  Users,
  History,
  BarChart3,
  FileSpreadsheet,
  Undo2,
  Briefcase,
  Handshake,
  ShieldAlert,
  MapPin,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/capabilities";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Capabilities that unlock this item. The item is shown if the user has
   * ANY one of them (or is a super-user). Omit to always show (e.g. Dashboard).
   */
  requiredAnyOf?: Capability[];
}

export interface SidebarGroup {
  label: string | null;
  items: SidebarItem[];
}

/**
 * v4.1 sidebar — single-tenant Car Capital UK.
 * Order locked per CLAUDE_CODE_PROMPT_v4_1.md §10:
 * Dashboard → ADMIN → INVENTORY → MAINTENANCE → ADVERT → SALES → WARRANTIES.
 *
 * `requiredAnyOf` gates visibility by capability (see app-sidebar.tsx). Each
 * item's capabilities mirror the guard on its page so the nav and the page
 * agree on who may enter.
 */
export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: null,
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Administrative",
    items: [
      {
        label: "Master Sheet",
        href: "/admin/master-sheet",
        icon: FileSpreadsheet,
        requiredAnyOf: ["admin:view_master_sheet"],
      },
      {
        label: "Master Calendar",
        href: "/admin/master-calendar",
        icon: CalendarIcon,
        requiredAnyOf: ["admin:view_master_calendar"],
      },
      {
        label: "Users & Permissions",
        href: "/admin/users-and-permissions",
        icon: Users,
        requiredAnyOf: ["admin:manage_permissions", "admin:manage_users"],
      },
      {
        label: "Returns and Cancellations",
        href: "/admin/vehicle-returns",
        icon: Undo2,
        requiredAnyOf: ["returns:create"],
      },
      {
        label: "Invoicing",
        href: "/admin/invoicing",
        icon: Receipt,
        requiredAnyOf: [
          "invoice:generate",
          "invoice:send",
          "invoice:mark_paid",
          "invoice:edit",
        ],
      },
      {
        label: "Vendors",
        href: "/admin/vendors",
        icon: Store,
        requiredAnyOf: ["admin:manage_vendors"],
      },
      {
        label: "Activity Log",
        href: "/admin/activity",
        icon: History,
        requiredAnyOf: ["admin:view_master_sheet", "admin:view_financials"],
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      {
        label: "All Vehicles",
        href: "/vehicles",
        icon: Car,
        requiredAnyOf: [
          "inventory:add",
          "inventory:edit",
          "inspection:run",
          "maintenance:create",
          "photos:process",
          "advert:create",
        ],
      },
      // Spec v3.0 · Module A — Locations lives inside Inventory so the
      // four-tab page sits next to the vehicle list it filters.
      {
        label: "Locations",
        href: "/admin/locations",
        icon: MapPin,
        requiredAnyOf: ["locations:move"],
      },
      // "Add Vehicle" lives in the brand-row CTA above the nav, not here.
    ],
  },
  {
    label: "Maintenance",
    items: [
      {
        label: "Pipeline",
        href: "/maintenance",
        icon: Wrench,
        requiredAnyOf: [
          "maintenance:create",
          "maintenance:edit",
          "maintenance:complete",
        ],
      },
      {
        label: "Calendar",
        href: "/maintenance/calendar",
        icon: CalendarIcon,
        requiredAnyOf: ["maintenance:create", "maintenance:edit", "inspection:run"],
      },
      {
        label: "Inspection Queue",
        href: "/maintenance/inspection",
        icon: ClipboardCheck,
        requiredAnyOf: ["inspection:run", "inspection:add_note"],
      },
      {
        label: "Workshop Jobs",
        href: "/maintenance/workshop",
        icon: Briefcase,
        requiredAnyOf: ["maintenance:create", "maintenance:edit", "workshop:add_note"],
      },
    ],
  },
  {
    label: "Advert",
    items: [
      {
        label: "Work List",
        href: "/advert/work-list",
        icon: Megaphone,
        requiredAnyOf: ["advert:create", "advert:edit"],
      },
      // Hidden for now (per request) — restore this block to bring back the
      // Photo Processing nav item. Also re-enable the `Image as ImageIcon`
      // import above when restoring.
      // {
      //   label: "Photo Processing",
      //   href: "/advert/photo-processing",
      //   icon: ImageIcon,
      //   requiredAnyOf: ["photos:process"],
      // },
      {
        label: "Performance",
        href: "/advert/performance",
        icon: BarChart3,
        requiredAnyOf: ["advert:edit", "listing:publish_autotrader"],
      },
      // AutoTrader Connect — dealers (advertisers) on our integration.
      {
        label: "Advertisers",
        href: "/admin/advertisers",
        icon: Building2,
        requiredAnyOf: ["advertiser:read"],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        label: "Leads",
        href: "/sales/leads",
        icon: UserPlus,
        requiredAnyOf: ["sales:create_lead", "sales:edit_lead"],
      },
      {
        label: "Appointments",
        href: "/sales/appointments",
        icon: CalendarCheck,
        requiredAnyOf: ["sales:book_appointment", "sales:edit_appointment"],
      },
      {
        label: "Pipeline",
        href: "/sales/pipeline",
        icon: TrendingUp,
        requiredAnyOf: ["sales:edit_pipeline_stage"],
      },
      {
        label: "Closed Deals",
        href: "/sales/deals",
        icon: Handshake,
        requiredAnyOf: ["sales:mark_sold", "sales:edit_pipeline_stage"],
      },
      {
        label: "Invoice Generation",
        href: "/sales/invoice-generation",
        icon: Receipt,
        requiredAnyOf: ["invoice:generate"],
      },
    ],
  },
  {
    label: "Warranties",
    items: [
      {
        label: "In-House",
        href: "/warranties/in-house",
        icon: Shield,
        requiredAnyOf: ["warranty:create", "warranty:edit"],
      },
      {
        label: "External",
        href: "/warranties/external",
        icon: ExternalLink,
        requiredAnyOf: ["warranty:create", "warranty:edit"],
      },
      {
        label: "Claims",
        href: "/warranties/claims",
        icon: ShieldAlert,
        requiredAnyOf: ["warranty:raise_claim", "warranty:resolve_claim"],
      },
    ],
  },
];

/** Whether a pathname sits under (or exactly on) a nav item's href. */
function matchesHref(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * The single active sidebar href for a path: the LONGEST matching item href, so
 * a child route (`/maintenance/calendar`) beats its parent (`/maintenance`) and
 * only one nav item is ever highlighted (GEN-36). Returns null when nothing
 * matches. Mirrors the longest-match rule already used by requiredCapsForPath.
 */
export function activeHrefForPath(pathname: string): string | null {
  let best: string | null = null;
  for (const group of SIDEBAR_GROUPS) {
    for (const item of group.items) {
      if (matchesHref(pathname, item.href)) {
        if (best === null || item.href.length > best.length) best = item.href;
      }
    }
  }
  return best;
}

/** Used by AppHeader to derive the page title from the current pathname. */
export function titleFromPath(pathname: string): string {
  const activeHref = activeHrefForPath(pathname);
  if (activeHref) {
    for (const group of SIDEBAR_GROUPS) {
      for (const item of group.items) {
        if (item.href === activeHref) return item.label;
      }
    }
  }
  if (pathname.startsWith("/vehicles/")) return "Vehicle";
  if (pathname.startsWith("/warranties/")) return "Warranty";
  return "Car Capital UK";
}

/** Routes outside the sidebar that still need gating. */
const EXTRA_ROUTE_CAPS: Array<{ href: string; caps: Capability[] }> = [
  { href: "/inventory/add-vehicle", caps: ["inventory:add"] },
  { href: "/admin/settings", caps: ["admin:manage_settings"] },
  {
    href: "/sales",
    caps: [
      "sales:create_lead",
      "sales:edit_lead",
      "sales:book_appointment",
      "sales:edit_appointment",
      "sales:edit_pipeline_stage",
      "sales:mark_sold",
      "invoice:generate",
    ],
  },
  {
    href: "/warranties",
    caps: ["warranty:create", "warranty:edit", "warranty:raise_claim", "warranty:resolve_claim"],
  },
];

/** Routes with no capability gate (open to any signed-in user). */
const ALWAYS_OPEN = ["/dashboard"];

/**
 * Resolve which capabilities (ANY of) unlock a given path. Returns `null`
 * when the route has no gate. Picks the longest matching href so
 * `/maintenance/inspection` beats `/maintenance`.
 */
export function requiredCapsForPath(pathname: string): Capability[] | null {
  if (ALWAYS_OPEN.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  const candidates: Array<{ href: string; caps: Capability[] }> = [];
  for (const group of SIDEBAR_GROUPS) {
    for (const item of group.items) {
      if (item.requiredAnyOf) {
        candidates.push({ href: item.href, caps: item.requiredAnyOf });
      }
    }
  }
  candidates.push(...EXTRA_ROUTE_CAPS);

  let best: { href: string; caps: Capability[] } | null = null;
  for (const c of candidates) {
    if (pathname === c.href || pathname.startsWith(c.href + "/")) {
      if (!best || c.href.length > best.href.length) best = c;
    }
  }
  return best ? best.caps : null;
}
