/**
 * Characterization tests — permissions matrix (capability catalogue side).
 * Pure data pins: the catalogue, labels and admin-grid grouping must stay in
 * lock-step or the permissions UI silently drops rows.
 */
import { describe, expect, it } from "vitest";
import {
  ALL_CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  type Capability,
} from "./capabilities";

describe("ALL_CAPABILITIES", () => {
  it("pins the catalogue size", () => {
    expect(ALL_CAPABILITIES).toHaveLength(48);
  });

  it("contains no duplicates", () => {
    expect(new Set(ALL_CAPABILITIES).size).toBe(ALL_CAPABILITIES.length);
  });
});

describe("CAPABILITY_LABELS", () => {
  it("has a non-empty human label for every capability", () => {
    for (const cap of ALL_CAPABILITIES) {
      expect(typeof CAPABILITY_LABELS[cap]).toBe("string");
      expect(CAPABILITY_LABELS[cap].length).toBeGreaterThan(0);
    }
  });

  it("has no labels for capabilities outside the catalogue", () => {
    expect(Object.keys(CAPABILITY_LABELS).sort()).toEqual(
      [...ALL_CAPABILITIES].sort(),
    );
  });
});

describe("CAPABILITY_GROUPS (admin permissions grid)", () => {
  it("covers every capability exactly once — none dropped, none doubled", () => {
    const grouped = CAPABILITY_GROUPS.flatMap((g) => g.capabilities);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...ALL_CAPABILITIES].sort());
  });

  it("pins the group labels in display order", () => {
    expect(CAPABILITY_GROUPS.map((g) => g.label)).toEqual([
      "Inventory",
      "Inspection",
      "Maintenance & Workshop",
      "Photos",
      "Adverts",
      "Leads & Sales",
      "Invoicing",
      "Warranties",
      "Returns",
      "Locations",
      "External Invoicing",
      "Advert",
      "Admin",
    ]);
  });

  it("every grouped capability is a valid Capability", () => {
    const all = new Set<Capability>(ALL_CAPABILITIES);
    for (const g of CAPABILITY_GROUPS) {
      for (const cap of g.capabilities) expect(all).toContain(cap);
    }
  });
});
