import {
  Plus,
  ClipboardCheck,
  Wrench,
  UserPlus,
  Receipt,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "./capabilities";

/**
 * The primary call-to-action shown above the sidebar nav, tailored to the
 * signed-in user's job. Chosen by the highest-priority capability the user
 * holds, so it always points at an action they can actually perform.
 */
export interface PrimaryCta {
  label: string;
  icon: LucideIcon;
  /** "modal" opens the Add-Vehicle modal; "link" navigates to `href`. */
  kind: "modal" | "link";
  href?: string;
  /** Pathname used to mark the CTA active in the nav. */
  activeMatch: string;
}

interface CtaRule {
  cap: Capability;
  cta: PrimaryCta;
}

// First matching rule wins. Order = priority.
const CTA_RULES: CtaRule[] = [
  {
    cap: "inventory:add",
    cta: { label: "Add Vehicle", icon: Plus, kind: "modal", activeMatch: "/inventory/add-vehicle" },
  },
  {
    // Administrator manages inventory/adverts/vendors but lacks inventory:add —
    // Add Vehicle is still their most frequent creation action, so an
    // inventory:edit holder gets it too (ranks above admin:manage_users below).
    cap: "inventory:edit",
    cta: { label: "Add Vehicle", icon: Plus, kind: "modal", activeMatch: "/inventory/add-vehicle" },
  },
  {
    cap: "inspection:run",
    cta: { label: "Start Inspection", icon: ClipboardCheck, kind: "link", href: "/maintenance/inspection", activeMatch: "/maintenance/inspection" },
  },
  {
    cap: "maintenance:edit",
    cta: { label: "Open Workshop", icon: Wrench, kind: "link", href: "/maintenance/workshop", activeMatch: "/maintenance/workshop" },
  },
  {
    cap: "sales:create_lead",
    cta: { label: "New Lead", icon: UserPlus, kind: "link", href: "/sales/leads?new=1", activeMatch: "/sales/leads" },
  },
  {
    cap: "invoice:generate",
    cta: { label: "New Invoice", icon: Receipt, kind: "link", href: "/sales/invoice-generation", activeMatch: "/sales/invoice-generation" },
  },
  {
    cap: "warranty:create",
    cta: { label: "New Warranty", icon: Shield, kind: "link", href: "/warranties/in-house?new=1", activeMatch: "/warranties/in-house" },
  },
  {
    cap: "admin:manage_users",
    cta: { label: "Invite Member", icon: Users, kind: "link", href: "/admin/users-and-permissions?invite=1", activeMatch: "/admin/users-and-permissions" },
  },
];

export function getPrimaryCta(opts: {
  isSuperUser: boolean;
  can: (c: Capability) => boolean;
}): PrimaryCta | null {
  // Super-users get the universal Add Vehicle action.
  if (opts.isSuperUser) {
    return { label: "Add Vehicle", icon: Plus, kind: "modal", activeMatch: "/inventory/add-vehicle" };
  }
  for (const rule of CTA_RULES) {
    if (opts.can(rule.cap)) return rule.cta;
  }
  return null; // view_only and any capability-less user: no primary CTA
}
