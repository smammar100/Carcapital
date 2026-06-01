/**
 * Stripe-style team roles for Car Capital UK.
 *
 * Each role is a curated bundle of granular `Capability` values from
 * `src/lib/capabilities.ts`. Inviting a team member assigns one or more
 * roles; the effective permission set is the UNION of every selected
 * role's capabilities (plus any explicit grants in `mockUserPermissions`).
 *
 * Owner / Super Administrator is special: it sets the `User.isSuperUser`
 * flag instead of adding capabilities, which bypasses every check.
 */

import type { Capability } from "./capabilities";

export type RoleValue =
  // Admin
  | "owner"
  | "administrator"
  | "iam_admin"
  // Operations
  | "inventory_manager"
  | "workshop_lead"
  | "inspector"
  | "driver"
  // Sales
  | "sales_specialist"
  | "sales_manager"
  | "finance_admin"
  | "aftercare_specialist"
  // View only
  | "view_only";

export type RoleGroup =
  | "Admin roles"
  | "Operations roles"
  | "Sales roles"
  | "View only roles";

export interface RoleDef {
  value: RoleValue;
  label: string;
  group: RoleGroup;
  description: string;
  capabilities: Capability[];
}

export const ROLE_DEFS: RoleDef[] = [
  // ----------------------------------------------------------------------
  // Admin roles
  // ----------------------------------------------------------------------
  {
    value: "owner",
    label: "Owner / Super Administrator",
    group: "Admin roles",
    description:
      "Full unrestricted access to every Car Capital module. Can invite or remove team members, manage roles, and override every permission gate. Reserved for the dealership owner.",
    capabilities: [], // bypassed via User.isSuperUser
  },
  {
    value: "administrator",
    label: "Administrator",
    group: "Admin roles",
    description:
      "Manages users, vendors, company settings, and views every financial dashboard. Cannot grant Owner / Super Administrator privileges.",
    capabilities: [
      "admin:view_master_sheet",
      "admin:view_financials",
      "admin:view_master_calendar",
      "admin:manage_users",
      "admin:manage_vendors",
      "admin:manage_settings",
      "inventory:edit",
      "inventory:edit_costs",
      "inventory:remove_from_website",
      "advert:create",
      "advert:edit",
      "advert:publish",
      // Spec v3.0 — Phase 1 foundation (Decisions C-2, F-1, F-3)
      "channels:configure",
      "data:migrate",
      "users:create_direct",
      // Spec v3.0 — Module A
      "locations:move",
      // Spec v3.0 · Module D — full external-invoice authority
      "external_invoice:create",
      "external_invoice:edit_any",
      "external_invoice:delete",
      // AutoTrader Connect — authority to publish a listing to AutoTrader.
      "listing:publish_autotrader",
    ],
  },
  {
    value: "iam_admin",
    label: "IAM Admin",
    group: "Admin roles",
    description:
      "Manages team members and per-user permissions only. No access to financials or inventory.",
    capabilities: [
      "admin:manage_users",
      "admin:manage_permissions",
      "users:create_direct",
    ],
  },

  // ----------------------------------------------------------------------
  // Operations roles
  // ----------------------------------------------------------------------
  {
    value: "inventory_manager",
    label: "Inventory Manager",
    group: "Operations roles",
    description:
      "Adds vehicles, edits arrival data and costs, manages photos, and creates listings. Sees the master sheet and financial tabs.",
    capabilities: [
      "inventory:add",
      "inventory:edit",
      "inventory:edit_costs",
      "inventory:remove_from_website",
      "maintenance:create",
      "photos:process",
      "advert:create",
      "advert:edit",
      "admin:view_master_sheet",
      "admin:view_financials",
      // Spec v3.0 — Module A: move authority for the day-to-day operator
      "locations:move",
      // Spec v3.0 · Module D — Inventory Manager creates external invoices
      "external_invoice:create",
    ],
  },
  {
    value: "workshop_lead",
    label: "Workshop Lead",
    group: "Operations roles",
    description:
      "Owns the maintenance pipeline. Creates and completes workshop jobs, adds notes, processes photos.",
    capabilities: [
      "maintenance:create",
      "maintenance:edit",
      "maintenance:complete",
      "workshop:add_note",
      "photos:process",
    ],
  },
  {
    value: "inspector",
    label: "Inspector",
    group: "Operations roles",
    description:
      "Runs the 20-point inspection, adds inspection notes, raises follow-up workshop jobs.",
    capabilities: [
      "inspection:run",
      "inspection:add_note",
      "maintenance:create",
      "workshop:add_note",
    ],
  },
  {
    value: "driver",
    label: "Driver",
    group: "Operations roles",
    description:
      "Logs new arrivals into the system. No edit access to costs, listings, or sales.",
    capabilities: ["inventory:add"],
  },

  // ----------------------------------------------------------------------
  // Sales roles
  // ----------------------------------------------------------------------
  {
    value: "sales_specialist",
    label: "Sales Specialist",
    group: "Sales roles",
    description:
      "Captures leads, books test drives, moves pipeline cards, and generates draft invoices. Cannot send invoices or mark them paid.",
    capabilities: [
      "sales:create_lead",
      "sales:edit_lead",
      "sales:book_appointment",
      "sales:edit_appointment",
      "sales:edit_pipeline_stage",
      "sales:mark_sold",
      "invoice:generate",
      "admin:view_master_calendar",
    ],
  },
  {
    value: "sales_manager",
    label: "Sales Manager",
    group: "Sales roles",
    description:
      "Everything in Sales Specialist, plus invoice send / mark-paid, warranty creation, and claim management.",
    capabilities: [
      "sales:create_lead",
      "sales:edit_lead",
      "sales:book_appointment",
      "sales:edit_appointment",
      "sales:edit_pipeline_stage",
      "sales:mark_sold",
      "invoice:generate",
      "invoice:edit",
      "invoice:send",
      "invoice:mark_paid",
      "warranty:create",
      "warranty:edit",
      "warranty:raise_claim",
      "warranty:resolve_claim",
      "admin:view_master_calendar",
      "admin:view_financials",
    ],
  },
  {
    value: "finance_admin",
    label: "Finance Admin",
    group: "Sales roles",
    description:
      "Owns the invoicing and refund workflows. Can edit invoices, mark paid, resolve warranty claims, and process vehicle returns.",
    capabilities: [
      "invoice:generate",
      "invoice:edit",
      "invoice:send",
      "invoice:mark_paid",
      "warranty:resolve_claim",
      "returns:create",
      "admin:view_financials",
      "admin:view_master_sheet",
    ],
  },
  {
    value: "aftercare_specialist",
    label: "Aftercare Specialist",
    group: "Sales roles",
    description:
      "Handles warranties, claims, and vehicle returns. No access to active sales pipeline or invoice edit / send.",
    capabilities: [
      "warranty:create",
      "warranty:edit",
      "warranty:raise_claim",
      "warranty:resolve_claim",
      "returns:create",
    ],
  },

  // ----------------------------------------------------------------------
  // View only
  // ----------------------------------------------------------------------
  {
    value: "view_only",
    label: "View Only",
    group: "View only roles",
    description:
      "Read-only access to the master sheet, master calendar, financial dashboards, and activity log. No edit rights anywhere.",
    capabilities: [
      "admin:view_master_sheet",
      "admin:view_master_calendar",
      "admin:view_financials",
    ],
  },
];

export const ROLE_GROUPS: RoleGroup[] = [
  "Admin roles",
  "Operations roles",
  "Sales roles",
  "View only roles",
];

export function roleByValue(value: RoleValue): RoleDef | undefined {
  return ROLE_DEFS.find((r) => r.value === value);
}

/**
 * Compute the union of capabilities for the given list of roles.
 * Owner / Super Administrator returns an empty set — its access is granted
 * via `User.isSuperUser` instead, which is checked separately upstream.
 */
export function capabilitiesForRoles(roles: RoleValue[]): Set<Capability> {
  const out = new Set<Capability>();
  for (const r of roles) {
    const def = roleByValue(r);
    if (!def) continue;
    for (const cap of def.capabilities) out.add(cap);
  }
  return out;
}

export function rolesByGroup(group: RoleGroup): RoleDef[] {
  return ROLE_DEFS.filter((r) => r.group === group);
}

/**
 * Map a set of capability-roles to the coarse LEGACY `users.role` value.
 *
 * The app is capability-driven now (`roles[]` + `user_permissions`), but the
 * single `users.role` column is still NOT NULL and a handful of UI filters key
 * off it (salesperson / inspector pickers in the sales + maintenance pages).
 * Every profile-row insert must therefore supply a sensible legacy value.
 *
 * The mapping mirrors the seeded data exactly: owner / admin / inspector /
 * driver / inventory_manager keep their specific value; every sales-ish or
 * specialist role (sales_specialist, sales_manager, finance_admin,
 * aftercare_specialist, workshop_lead, view_only) falls back to "sales".
 */
export function legacyRoleForRoles(roles: RoleValue[]): string {
  if (roles.includes("owner")) return "owner";
  if (roles.includes("administrator") || roles.includes("iam_admin"))
    return "admin";
  if (roles.includes("inventory_manager")) return "inventory_manager";
  if (roles.includes("inspector")) return "inspector";
  if (roles.includes("driver")) return "driver";
  return "sales";
}
