/**
 * Characterization tests — warranty effective-status derivation.
 * Stored warranties only ever carry active/cancelled; "expired" is derived
 * at read time from the end date (local-midnight basis).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysRemaining, effectiveWarrantyStatus } from "./warranty-status";
import { makeWarranty } from "@/test/factories";

beforeEach(() => {
  vi.useFakeTimers();
  // Local noon so local-midnight math is TZ-independent in the test.
  vi.setSystemTime(new Date(2026, 6, 2, 12, 0, 0)); // 2 July 2026, local
});

afterEach(() => {
  vi.useRealTimers();
});

describe("daysRemaining", () => {
  it.each([
    ["2026-07-02", 0], // ends today
    ["2026-07-03", 1], // ends tomorrow
    ["2026-07-01", -1], // ended yesterday
    ["2026-08-01", 30],
    ["2025-07-02", -365],
  ])("end %s → %i days", (endDate, days) => {
    expect(daysRemaining(endDate)).toBe(days);
  });
});

describe("effectiveWarrantyStatus", () => {
  it("active cover ending TODAY is still active (expires at end of day)", () => {
    expect(
      effectiveWarrantyStatus(makeWarranty({ status: "active", endDate: "2026-07-02" })),
    ).toBe("active");
  });

  it("active cover that ended YESTERDAY derives to expired", () => {
    expect(
      effectiveWarrantyStatus(makeWarranty({ status: "active", endDate: "2026-07-01" })),
    ).toBe("expired");
  });

  it("active cover starting today (full term ahead) is active", () => {
    expect(
      effectiveWarrantyStatus(
        makeWarranty({ status: "active", startDate: "2026-07-02", endDate: "2026-10-02" }),
      ),
    ).toBe("active");
  });

  it("cancelled overrides the dates — even inside the coverage window", () => {
    expect(
      effectiveWarrantyStatus(
        makeWarranty({ status: "cancelled", startDate: "2026-06-01", endDate: "2026-09-01" }),
      ),
    ).toBe("cancelled");
  });

  it("cancelled cover whose dates have also lapsed stays cancelled, not expired", () => {
    expect(
      effectiveWarrantyStatus(makeWarranty({ status: "cancelled", endDate: "2020-01-01" })),
    ).toBe("cancelled");
  });

  it("a stored 'expired' status passes through untouched", () => {
    expect(
      effectiveWarrantyStatus(makeWarranty({ status: "expired", endDate: "2099-01-01" })),
    ).toBe("expired");
  });

  it("cover that has not STARTED yet is still reported active", () => {
    // NOTE: pins existing behavior — possible bug: the derivation only looks
    // at endDate, so a warranty starting next month already reads "active".
    expect(
      effectiveWarrantyStatus(
        makeWarranty({ status: "active", startDate: "2026-08-01", endDate: "2026-11-01" }),
      ),
    ).toBe("active");
  });
});
