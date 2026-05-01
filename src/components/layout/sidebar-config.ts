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
  Receipt,
  Store,
  Users,
  History,
  MessageSquare,
  BarChart3,
  FileSpreadsheet,
  Undo2,
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

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: null,
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Administrative",
    items: [
      { label: "Master Sheet", href: "/admin/master-sheet", icon: FileSpreadsheet },
      { label: "Users & Access", href: "/admin/users", icon: Users },
      { label: "Vehicle Returns", href: "/admin/returns", icon: Undo2 },
      { label: "Invoicing", href: "/admin/invoicing", icon: Receipt },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "All Vehicles", href: "/vehicles", icon: Car },
      { label: "Add Vehicle", href: "/vehicles/new", icon: Plus },
    ],
  },
  {
    label: "Maintenance",
    items: [
      { label: "Pipeline", href: "/maintenance", icon: Wrench },
      { label: "Calendar", href: "/maintenance/calendar", icon: CalendarIcon },
      { label: "Inspection", href: "/maintenance/inspection", icon: ClipboardCheck },
    ],
  },
  {
    label: "Advert",
    items: [
      { label: "Work List", href: "/listings", icon: Megaphone },
      { label: "Photo Processing", href: "/listings/photos", icon: ImageIcon },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/leads", icon: UserPlus },
      { label: "Appointments", href: "/appointments", icon: CalendarCheck },
      { label: "Pipeline / Deals", href: "/sales", icon: TrendingUp },
      { label: "Master Calendar", href: "/sales/master-calendar", icon: CalendarIcon },
    ],
  },
  { label: null, items: [{ label: "Warranties", href: "/warranties", icon: Shield }] },
  { label: null, items: [{ label: "Workshop", href: "/workshop", icon: Wrench }] },
  { label: null, items: [{ label: "Insights", href: "/insights", icon: BarChart3 }] },
  { label: null, items: [{ label: "Activity Log", href: "/activity", icon: History }] },
  { label: null, items: [{ label: "Vendors", href: "/vendors", icon: Store }] },
  { label: null, items: [{ label: "Messages", href: "/messages", icon: MessageSquare }] },
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
