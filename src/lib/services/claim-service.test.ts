/**
 * Characterization tests — warranty claim lifecycle stamps.
 * Pins the resolved_at stamping matrix on claimService.updateStatus and the
 * defaults on create (status "open", both cache namespaces invalidated).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, stepArgs, type SupabaseMock } from "@/test/supabase-mock";
import { makeClaim } from "@/test/factories";

const db = { current: null as unknown as SupabaseMock };

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => db.current.client,
}));
const cacheMocks = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock("@/lib/cache", () => ({
  withCache: (_k: string, fn: () => unknown) => fn(),
  invalidate: cacheMocks.invalidate,
}));
vi.mock("./activity-service", () => ({
  activityService: { log: vi.fn(async () => undefined) },
}));

import { claimService } from "./claim-service";

const NOW = "2026-07-02T12:00:00.000Z";

beforeEach(() => {
  cacheMocks.invalidate.mockClear();
  db.current = createSupabaseMock((call) => {
    if (call.table === "warranty_claims")
      return { data: makeClaim(), error: null };
    return undefined;
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("updateStatus — resolved_at stamping", () => {
  it.each(["resolved", "rejected"] as const)(
    "%s stamps resolved_at with the current instant",
    async (status) => {
      await claimService.updateStatus("claim-0001", status);
      const update = db.current.calls[0];
      expect(stepArgs(update, "update")).toEqual([
        { status, resolved_at: NOW },
      ]);
    },
  );

  it.each(["open", "under_review", "approved"] as const)(
    "moving back to %s CLEARS resolved_at",
    async (status) => {
      await claimService.updateStatus("claim-0001", status);
      const update = db.current.calls[0];
      expect(stepArgs(update, "update")).toEqual([
        { status, resolved_at: null },
      ]);
    },
  );

  it("invalidates both the claims and warranties cache namespaces", async () => {
    await claimService.updateStatus("claim-0001", "resolved");
    expect(cacheMocks.invalidate.mock.calls.map((c) => c[0])).toEqual([
      "claims:",
      "warranties:",
    ]);
  });
});

describe("create", () => {
  it("always inserts with status 'open' and the given complaint flag", async () => {
    await claimService.create(
      {
        warrantyId: "war-0001",
        vehicleId: "veh-0001",
        companyId: "co-0001",
        customerName: "Sarah Whitfield",
        issueDescription: "Clutch judder at low speed",
        isComplaint: true,
        estimatedCost: 320,
      },
      "user-9",
    );
    const insert = db.current.calls[0];
    expect(stepArgs(insert, "insert")).toEqual([
      {
        warranty_id: "war-0001",
        vehicle_id: "veh-0001",
        company_id: "co-0001",
        customer_name: "Sarah Whitfield",
        issue_description: "Clutch judder at low speed",
        is_complaint: true,
        estimated_cost: 320,
        status: "open",
      },
    ]);
    expect(cacheMocks.invalidate.mock.calls.map((c) => c[0])).toEqual([
      "claims:",
      "warranties:",
    ]);
  });
});
