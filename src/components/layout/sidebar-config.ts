import {
  LayoutDashboard,
  Car,
  Wrench,
  ClipboardCheck,
  Hammer,
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
 * Sidebar order follows a vehicle's life through the business, so a normal
 * day reads top to bottom instead of jumping between groups:
 *
 *   Inventory   — it arrives and is put somewhere
 *   Maintenance — it is inspected, then prepped and repaired
 *   Advert      — it goes to market (hidden for the MVP launch)
 *   Sales       — it is sold
 *   Warranties  — cover on cars sold, and the occasional return
 *   Admin       — oversight of all of the above
 *
 * Within a group the same rule applies: the steps come first, in the order
 * they happen, and anything that merely looks at those steps — an overview,
 * a calendar — comes after them. Maintenance is the case that matters, where
 * only the first two entries are stages a car passes through.
 *
 * Administrative used to sit second, directly under Dashboard, which pushed
 * every stage of the actual workflow below a group nobody touches hourly.
 * It now sits last: it reports on the lifecycle rather than being part of it.
 *
 * Items inside each group follow the same rule — Maintenance opens with the
 * Inspection Queue because that is what a car hits first, not the Pipeline
 * overview.
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
    // Exactly TWO steps, in the order a car meets them, then the views over
    // them. Inspection feeds Prep automatically — a car lands in Prep the
    // moment its inspection completes with outstanding items — so the first
    // two entries are the real sequence and nothing may be inserted between
    // them. Pipeline and Calendar are lenses on that same work, not further
    // stages, so they sit below it rather than interrupting it.
    //
    // Workshop Jobs used to sit third, between the two steps; it is now last
    // (see the note on it below).
    items: [
      {
        label: "Inspection Queue",
        href: "/maintenance/inspection",
        icon: ClipboardCheck,
        requiredAnyOf: ["inspection:run", "inspection:add_note"],
      },
      {
        label: "Prep & Repair",
        href: "/maintenance/prep",
        icon: Hammer,
        requiredAnyOf: [
          "maintenance:create",
          "maintenance:edit",
          "maintenance:complete",
        ],
      },
      // "Job Pipeline", not "Pipeline": Sales owns a Pipeline too, and two
      // identically-labelled rows in one rail cannot be told apart.
      {
        label: "Job Pipeline",
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
      // Last, and deliberately below the two views: walk-in servicing for the
      // public — other people's vehicles, booked by phone, that you never
      // owned and will never sell. It is the odd one out in this group, but a
      // whole heading for a single row costs more than it explains. What
      // mattered was getting it out from between Inspection and Prep, where it
      // put a stranger's car in the middle of preparing your own stock.
      {
        label: "Workshop Jobs",
        href: "/maintenance/workshop",
        icon: Briefcase,
        requiredAnyOf: [
          "maintenance:create",
          "maintenance:edit",
          "workshop:add_note",
        ],
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
        // Named for the pipeline stage that fills it. A user drags a card to
        // "Completed Sale" and then looks in the rail for where it went, so
        // the two labels have to be the same words — "Closed Deals" made them
        // guess that a closed deal and a completed sale were the same thing.
        label: "Completed Sale",
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
    // Everything that happens to a car after money changes hands. Returns
    // moved here from Administrative: a return is the last step of a sale,
    // not a back-office function.
    // Named for what is in it rather than when it happens. Three of the four
    // rows are warranties and live under /warranties, so the heading now
    // matches both the contents and the routes.
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
      {
        label: "Returns and Cancellations",
        href: "/admin/vehicle-returns",
        icon: Undo2,
        requiredAnyOf: ["returns:create"],
      },
    ],
  },
  {
    // Oversight of the lifecycle rather than a stage in it, so it sits last.
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
        label: "Reports & Analytics",
        href: "/admin/reports",
        icon: BarChart3,
        requiredAnyOf: ["admin:view_financials"],
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
        label: "Users & Permissions",
        href: "/admin/users-and-permissions",
        icon: Users,
        requiredAnyOf: ["admin:manage_permissions", "admin:manage_users"],
      },
      {
        label: "Activity Log",
        href: "/admin/activity",
        icon: History,
        requiredAnyOf: ["admin:view_master_sheet", "admin:view_financials"],
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

/**
 * Routes built but held back from the MVP launch.
 *
 * These are hidden from the nav only — the routes, pages and capability
 * guards above are left completely intact, so nothing here is a deletion and
 * unhiding a module is a one-line change (drop its href from this set).
 *
 * Deliberately NOT filtered out of SIDEBAR_GROUPS itself: `activeHrefForPath`
 * and the route-capability lookup both read that array, so removing entries
 * would strip the permission guard from a route that still exists and is
 * still reachable by direct URL.
 *
 *   Advert   — the AutoTrader publish/performance integration is not wired
 *              up, so the whole group would show empty or stale figures.
 *   Reports, Activity Log
 *            — backward-looking surfaces with no history to read now that the
 *              demo data has been cleared; they populate as trading begins.
 *
 * Master Calendar is deliberately NOT here. It was hidden with the other two
 * as a "reporting extra", which misread it: it shows what is booked next
 * rather than what already happened, so an empty database makes it a blank
 * diary to fill in, not a broken report.
 */
export const MVP_HIDDEN_HREFS: ReadonlySet<string> = new Set([
  "/advert/work-list",
  "/advert/performance",
  "/admin/advertisers",
  "/admin/reports",
  "/admin/activity",
]);

/**
 * Stable DOM id for a nav item, used as the guided tour's anchor.
 *
 * Derived from the href rather than hand-written per item so a renamed or
 * added route cannot silently lose its anchor and leave the tour pointing at
 * nothing. Slashes become dashes because the id is fed to `querySelector`,
 * where an unescaped `/` is a syntax error.
 *
 *   /maintenance/inspection  ->  tour-nav-maintenance-inspection
 */
export function navTourId(href: string): string {
  return `tour-nav${href.replace(/\//g, "-")}`;
}
