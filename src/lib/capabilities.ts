/**
 * Per-user capability grid (v4.1 spec §11.18 + Gap 3).
 *
 * Capabilities are granular permissions assigned per-user, not per-role.
 * A user's `isSuperUser` flag bypasses all checks.
 *
 * The legacy `User.role` enum stays for display labelling (avatar badge,
 * login picker subtitle) but no longer drives authority — every gating call
 * goes through `usePermissions().can(cap)`.
 */

export type Capability =
  // Inventory
  | "inventory:add"
  | "inventory:edit"
  | "inventory:edit_costs"
  | "inventory:remove_from_website"
  // Inspection
  | "inspection:run"
  | "inspection:add_note"
  // Maintenance / Workshop
  | "maintenance:create"
  | "maintenance:edit"
  | "maintenance:complete"
  | "workshop:add_note"
  // Photos
  | "photos:process"
  // Listings / Advert
  | "advert:create"
  | "advert:edit"
  | "advert:publish"
  // Sales
  | "sales:create_lead"
  | "sales:edit_lead"
  | "sales:book_appointment"
  | "sales:edit_appointment"
  | "sales:edit_pipeline_stage"
  | "sales:mark_sold"
  // Invoicing
  | "invoice:generate"
  | "invoice:edit"
  | "invoice:send"
  | "invoice:mark_paid"
  // Warranty
  | "warranty:create"
  | "warranty:edit"
  | "warranty:raise_claim"
  | "warranty:resolve_claim"
  // Returns
  | "returns:create"
  // Admin / view permissions
  | "admin:view_master_sheet"
  | "admin:view_financials"
  | "admin:view_master_calendar"
  | "admin:manage_users"
  | "admin:manage_permissions"
  | "admin:manage_vendors"
  | "admin:manage_settings"
  // Spec v3.0 — Phase 1 foundation
  | "channels:configure"
  | "data:migrate"
  | "users:create_direct"
  // Spec v3.0 — Module A · Vehicle Locations
  | "locations:move"
  | "locations:edit_history"
  | "locations:delete"
  // Spec v3.0 · Module D
  | "external_invoice:create"
  | "external_invoice:edit_any"
  | "external_invoice:delete"
  // AutoTrader Connect — publish a listing to AutoTrader (live API write)
  | "listing:publish_autotrader";

export const ALL_CAPABILITIES: Capability[] = [
  "inventory:add",
  "inventory:edit",
  "inventory:edit_costs",
  "inventory:remove_from_website",
  "inspection:run",
  "inspection:add_note",
  "maintenance:create",
  "maintenance:edit",
  "maintenance:complete",
  "workshop:add_note",
  "photos:process",
  "advert:create",
  "advert:edit",
  "advert:publish",
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
  "returns:create",
  "admin:view_master_sheet",
  "admin:view_financials",
  "admin:view_master_calendar",
  "admin:manage_users",
  "admin:manage_permissions",
  "admin:manage_vendors",
  "admin:manage_settings",
  "channels:configure",
  "data:migrate",
  "users:create_direct",
  "locations:move",
  "locations:edit_history",
  "locations:delete",
  "external_invoice:create",
  "external_invoice:edit_any",
  "external_invoice:delete",
  "listing:publish_autotrader",
];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "inventory:add": "Add Vehicle",
  "inventory:edit": "Edit Vehicle",
  "inventory:edit_costs": "Edit Costs",
  "inventory:remove_from_website": "Remove from Website",
  "inspection:run": "Run Inspection",
  "inspection:add_note": "Add Inspection Note",
  "maintenance:create": "Create Maintenance Job",
  "maintenance:edit": "Edit Maintenance Job",
  "maintenance:complete": "Complete Maintenance Job",
  "workshop:add_note": "Add Workshop Note",
  "photos:process": "Process Photos",
  "advert:create": "Create Listing",
  "advert:edit": "Edit Listing",
  "advert:publish": "Publish Listing",
  "sales:create_lead": "Create Lead",
  "sales:edit_lead": "Edit Lead",
  "sales:book_appointment": "Book Appointment",
  "sales:edit_appointment": "Edit Appointment",
  "sales:edit_pipeline_stage": "Edit Pipeline Stage",
  "sales:mark_sold": "Mark Sold",
  "invoice:generate": "Generate Invoice",
  "invoice:edit": "Edit Invoice",
  "invoice:send": "Send Invoice",
  "invoice:mark_paid": "Mark Invoice Paid",
  "warranty:create": "Create Warranty",
  "warranty:edit": "Edit Warranty",
  "warranty:raise_claim": "Raise Claim",
  "warranty:resolve_claim": "Resolve Claim",
  "returns:create": "Create Vehicle Return",
  "admin:view_master_sheet": "View Master Sheet",
  "admin:view_financials": "View Financials",
  "admin:view_master_calendar": "View Master Calendar",
  "admin:manage_users": "Manage Users",
  "admin:manage_permissions": "Manage Permissions",
  "admin:manage_vendors": "Manage Vendors",
  "admin:manage_settings": "Manage Settings",
  "channels:configure": "Configure Lead Channels",
  "data:migrate": "Run Data Migration",
  "users:create_direct": "Create Users Directly",
  "locations:move": "Move Vehicle",
  "locations:edit_history": "Edit Movement History",
  "locations:delete": "Delete Movement",
  "external_invoice:create": "Create External Invoice",
  "listing:publish_autotrader": "Publish to AutoTrader",
  "external_invoice:edit_any": "Edit Any External Invoice",
  "external_invoice:delete": "Delete External Invoice",
};

export interface CapabilityGroup {
  label: string;
  capabilities: Capability[];
}

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    label: "Inventory",
    capabilities: [
      "inventory:add",
      "inventory:edit",
      "inventory:edit_costs",
      "inventory:remove_from_website",
    ],
  },
  {
    label: "Inspection",
    capabilities: ["inspection:run", "inspection:add_note"],
  },
  {
    label: "Maintenance & Workshop",
    capabilities: [
      "maintenance:create",
      "maintenance:edit",
      "maintenance:complete",
      "workshop:add_note",
    ],
  },
  {
    label: "Photos",
    capabilities: ["photos:process"],
  },
  {
    label: "Adverts",
    capabilities: ["advert:create", "advert:edit", "advert:publish"],
  },
  {
    label: "Leads & Sales",
    capabilities: [
      "sales:create_lead",
      "sales:edit_lead",
      "sales:book_appointment",
      "sales:edit_appointment",
      "sales:edit_pipeline_stage",
      "sales:mark_sold",
    ],
  },
  {
    label: "Invoicing",
    capabilities: [
      "invoice:generate",
      "invoice:edit",
      "invoice:send",
      "invoice:mark_paid",
    ],
  },
  {
    label: "Warranties",
    capabilities: [
      "warranty:create",
      "warranty:edit",
      "warranty:raise_claim",
      "warranty:resolve_claim",
    ],
  },
  {
    label: "Returns",
    capabilities: ["returns:create"],
  },
  {
    label: "Locations",
    capabilities: ["locations:move", "locations:edit_history", "locations:delete"],
  },
  {
    label: "External Invoicing",
    capabilities: [
      "external_invoice:create",
      "external_invoice:edit_any",
      "external_invoice:delete",
    ],
  },
  {
    label: "Advert",
    capabilities: ["listing:publish_autotrader"],
  },
  {
    label: "Admin",
    capabilities: [
      "admin:view_master_sheet",
      "admin:view_financials",
      "admin:view_master_calendar",
      "admin:manage_users",
      "admin:manage_permissions",
      "admin:manage_vendors",
      "admin:manage_settings",
      "channels:configure",
      "data:migrate",
      "users:create_direct",
    ],
  },
];
