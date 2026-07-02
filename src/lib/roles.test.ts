/**
 * Characterization tests — permissions matrix (roles side).
 * Pins CURRENT behavior; every expected bundle below is a snapshot of the
 * role definitions as shipped. Changing a role's capabilities is a
 * deliberate act and must update this table.
 */
import { describe, expect, it } from "vitest";
import {
  ROLE_DEFS,
  ROLE_GROUPS,
  capabilitiesForRoles,
  legacyRoleForRoles,
  roleByValue,
  rolesByGroup,
  type RoleValue,
} from "./roles";
import { ALL_CAPABILITIES } from "./capabilities";

const bundle = (role: RoleValue): string[] =>
  [...(roleByValue(role)?.capabilities ?? [])].sort();

describe("role capability bundles (sorted snapshot)", () => {
  it("pins every role's bundle", () => {
    const bundles = Object.fromEntries(
      ROLE_DEFS.map((r) => [r.value, bundle(r.value)]),
    );
    expect(bundles).toEqual({
      // Owner grants nothing directly — access flows via User.isSuperUser.
      owner: [],
      administrator: [
        "admin:manage_settings",
        "admin:manage_users",
        "admin:manage_vendors",
        "admin:view_financials",
        "admin:view_master_calendar",
        "admin:view_master_sheet",
        "advert:create",
        "advert:edit",
        "advert:publish",
        "advertiser:read",
        "advertiser:sync",
        "channels:configure",
        "data:migrate",
        "external_invoice:create",
        "external_invoice:delete",
        "external_invoice:edit_any",
        "inventory:edit",
        "inventory:edit_costs",
        "inventory:remove_from_website",
        "listing:publish_autotrader",
        "locations:move",
        "users:create_direct",
      ],
      iam_admin: [
        "admin:manage_permissions",
        "admin:manage_users",
        "users:create_direct",
      ],
      inventory_manager: [
        "admin:view_financials",
        "admin:view_master_sheet",
        "advert:create",
        "advert:edit",
        "external_invoice:create",
        "inventory:add",
        "inventory:edit",
        "inventory:edit_costs",
        "inventory:remove_from_website",
        "locations:move",
        "maintenance:create",
        "photos:process",
      ],
      workshop_lead: [
        "maintenance:complete",
        "maintenance:create",
        "maintenance:edit",
        "photos:process",
        "workshop:add_note",
      ],
      inspector: [
        "inspection:add_note",
        "inspection:run",
        "maintenance:create",
        "workshop:add_note",
      ],
      driver: ["inventory:add"],
      sales_specialist: [
        "admin:view_master_calendar",
        "invoice:generate",
        "sales:book_appointment",
        "sales:create_lead",
        "sales:edit_appointment",
        "sales:edit_lead",
        "sales:edit_pipeline_stage",
        "sales:mark_sold",
      ],
      sales_manager: [
        "admin:view_financials",
        "admin:view_master_calendar",
        "invoice:edit",
        "invoice:generate",
        "invoice:mark_paid",
        "invoice:send",
        "sales:book_appointment",
        "sales:create_lead",
        "sales:edit_appointment",
        "sales:edit_lead",
        "sales:edit_pipeline_stage",
        "sales:mark_sold",
        "warranty:create",
        "warranty:edit",
        "warranty:raise_claim",
        "warranty:resolve_claim",
      ],
      finance_admin: [
        "admin:view_financials",
        "admin:view_master_sheet",
        "invoice:edit",
        "invoice:generate",
        "invoice:mark_paid",
        "invoice:send",
        "returns:create",
        "warranty:resolve_claim",
      ],
      aftercare_specialist: [
        "returns:create",
        "warranty:create",
        "warranty:edit",
        "warranty:raise_claim",
        "warranty:resolve_claim",
      ],
      view_only: [
        "admin:view_financials",
        "admin:view_master_calendar",
        "admin:view_master_sheet",
      ],
    });
  });

  it("every capability in every bundle exists in ALL_CAPABILITIES", () => {
    const all = new Set<string>(ALL_CAPABILITIES);
    for (const def of ROLE_DEFS) {
      for (const cap of def.capabilities) {
        expect(all, `${def.value} grants unknown capability ${cap}`).toContain(
          cap,
        );
      }
    }
  });

  it("role values are unique", () => {
    const values = ROLE_DEFS.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("rolesByGroup partitions ROLE_DEFS across ROLE_GROUPS exactly", () => {
    const partitioned = ROLE_GROUPS.flatMap((g) =>
      rolesByGroup(g).map((r) => r.value),
    );
    expect(partitioned.sort()).toEqual(ROLE_DEFS.map((r) => r.value).sort());
    expect(partitioned.length).toBe(ROLE_DEFS.length);
  });

  it("roleByValue returns undefined for an unknown role", () => {
    expect(roleByValue("ceo" as RoleValue)).toBeUndefined();
  });
});

describe("capabilitiesForRoles (union semantics)", () => {
  it("unions capabilities across roles without duplicates", () => {
    const caps = capabilitiesForRoles(["driver", "inspector"]);
    expect([...caps].sort()).toEqual([
      "inspection:add_note",
      "inspection:run",
      "inventory:add",
      "maintenance:create",
      "workshop:add_note",
    ]);
  });

  it("owner alone yields an EMPTY set — super-user flag is checked upstream", () => {
    expect(capabilitiesForRoles(["owner"]).size).toBe(0);
  });

  it("unknown roles are silently ignored", () => {
    const caps = capabilitiesForRoles(["driver", "ceo" as RoleValue]);
    expect([...caps]).toEqual(["inventory:add"]);
  });

  it("empty role list yields empty set", () => {
    expect(capabilitiesForRoles([]).size).toBe(0);
  });
});

describe("legacyRoleForRoles mapping", () => {
  const single: Array<[RoleValue, string]> = [
    ["owner", "owner"],
    ["administrator", "admin"],
    ["iam_admin", "admin"],
    ["inventory_manager", "inventory_manager"],
    ["inspector", "inspector"],
    ["driver", "driver"],
    ["workshop_lead", "workshop"],
    ["sales_specialist", "sales"],
    ["sales_manager", "sales"],
    ["finance_admin", "sales"],
    ["aftercare_specialist", "sales"],
    // NOTE: pins existing behavior — possible bug: view_only maps to "sales",
    // so a view-only user appears in salesperson pickers that filter on
    // role === "sales" despite having no sales capabilities.
    ["view_only", "sales"],
  ];
  it.each(single)("[%s] → %s", (role, legacy) => {
    expect(legacyRoleForRoles([role])).toBe(legacy);
  });

  it("precedence: owner beats everything", () => {
    expect(legacyRoleForRoles(["sales_manager", "administrator", "owner"])).toBe(
      "owner",
    );
  });

  it("precedence: admin beats operations/sales", () => {
    expect(legacyRoleForRoles(["inventory_manager", "iam_admin"])).toBe("admin");
  });

  it("precedence: inventory_manager beats inspector/driver/workshop", () => {
    expect(
      legacyRoleForRoles(["driver", "inspector", "inventory_manager"]),
    ).toBe("inventory_manager");
    expect(legacyRoleForRoles(["workshop_lead", "inspector"])).toBe("inspector");
  });

  it("empty roles fall back to 'sales'", () => {
    expect(legacyRoleForRoles([])).toBe("sales");
  });
});
