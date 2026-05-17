import {
  LayoutDashboard,
  Settings,
  Car,
  Plus,
  Wrench,
  ClipboardCheck,
  Calendar as CalendarIcon,
  Megaphone,
  Image as ImageIcon,
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
  ListPlus,
  type LucideIcon,
} from "lucide-react";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface SidebarGroup {
  label: string | null;
  items: SidebarItem[];
}

/**
 * v4.1 sidebar — single-tenant Car Capital UK.
 * Order locked per CLAUDE_CODE_PROMPT_v4_1.md §10:
 * Dashboard → ADMIN → INVENTORY → MAINTENANCE → ADVERT → SALES → WARRANTIES.
 */
export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: null,
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Administrative",
    items: [
      { label: "Master Sheet", href: "/admin/master-sheet", icon: FileSpreadsheet },
      { label: "Custom Fields", href: "/admin/custom-fields", icon: ListPlus },
      { label: "Master Calendar", href: "/admin/master-calendar", icon: CalendarIcon },
      { label: "Users & Permissions", href: "/admin/users-and-permissions", icon: Users },
      { label: "Vehicle Returns", href: "/admin/vehicle-returns", icon: Undo2 },
      { label: "Invoicing", href: "/admin/invoicing", icon: Receipt },
      { label: "Vendors", href: "/admin/vendors", icon: Store },
      { label: "Activity Log", href: "/admin/activity", icon: History },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "All Vehicles", href: "/vehicles", icon: Car },
      { label: "Add Vehicle", href: "/inventory/add-vehicle", icon: Plus },
    ],
  },
  {
    label: "Maintenance",
    items: [
      { label: "Pipeline", href: "/maintenance", icon: Wrench },
      { label: "Calendar", href: "/maintenance/calendar", icon: CalendarIcon },
      { label: "Inspection Queue", href: "/maintenance/inspection", icon: ClipboardCheck },
      { label: "Workshop Jobs", href: "/maintenance/workshop", icon: Briefcase },
    ],
  },
  {
    label: "Advert",
    items: [
      { label: "Work List", href: "/advert/work-list", icon: Megaphone },
      { label: "Photo Processing", href: "/advert/photo-processing", icon: ImageIcon },
      { label: "Listings", href: "/advert/listings", icon: Megaphone },
      { label: "Performance", href: "/advert/performance", icon: BarChart3 },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/sales/leads", icon: UserPlus },
      { label: "Appointments", href: "/sales/appointments", icon: CalendarCheck },
      { label: "Pipeline", href: "/sales/pipeline", icon: TrendingUp },
      { label: "Deals", href: "/sales/deals", icon: Handshake },
      { label: "Invoice Generation", href: "/sales/invoice-generation", icon: Receipt },
    ],
  },
  {
    label: "Warranties",
    items: [
      { label: "In-House", href: "/warranties/in-house", icon: Shield },
      { label: "External", href: "/warranties/external", icon: ExternalLink },
      { label: "Claims", href: "/warranties/claims", icon: ShieldAlert },
    ],
  },
];

/** Used by AppHeader to derive the page title from the current pathname. */
export function titleFromPath(pathname: string): string {
  for (const group of SIDEBAR_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href) return item.label;
      if (pathname.startsWith(item.href + "/")) return item.label;
    }
  }
  if (pathname.startsWith("/vehicles/")) return "Vehicle";
  if (pathname.startsWith("/warranties/")) return "Warranty";
  return "Car Capital UK";
}
