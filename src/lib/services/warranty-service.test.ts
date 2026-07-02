/**
 * Characterization tests — warranty creation/purchase defaults.
 * The date-based effective-status derivation itself is pure and pinned in
 * src/lib/warranty-status.test.ts; here we pin the type-driven defaults the
 * service stamps onto new rows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, stepArgs, type SupabaseMock } from "@/test/supabase-mock";
import { makeVehicle, makeWarranty } from "@/test/factories";

const db = { current: null as unknown as SupabaseMock };

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => db.current.client,
}));
vi.mock("@/lib/cache", () => ({
  withCache: (_k: string, fn: () => unknown) => fn(),
  invalidate: vi.fn(),
}));
vi.mock("./activity-service", () => ({
  activityService: { log: vi.fn(async () => undefined) },
}));
vi.mock("./vehicle-service", () => ({
  vehicleService: { getById: vi.fn(async () => makeVehicle()) },
}));

import { warrantyService } from "./warranty-service";

const baseInput = {
  companyId: "co-0001",
  vehicleId: "veh-0001",
  saleDealId: null,
  customerName: "Sarah Whitfield",
  customerPhone: "07700 900123",
  customerEmail: null,
  coverageDetails: "3-month engine & gearbox cover",
  startDate: "2026-07-02",
  endDate: "2026-10-02",
  costToDealership: 0,
  costToCustomer: 199,
};

beforeEach(() => {
  db.current = createSupabaseMock((call) => {
    if (call.table === "warranties") return { data: makeWarranty(), error: null };
    return undefined;
  });
});

describe("create — type-driven defaults", () => {
  it("in-house: provider forced to 'Car Capital', purchase_status n_a, status active", async () => {
    await warrantyService.create(
      { ...baseInput, type: "in_house", provider: "Warranties 2000" },
      "user-9",
    );
    const insert = db.current.calls[0];
    expect(stepArgs(insert, "insert")?.[0]).toMatchObject({
      type: "in_house",
      // NOTE: pins existing behavior — a provider passed for an in-house
      // warranty is silently discarded in favour of "Car Capital".
      provider: "Car Capital",
      purchase_status: "n_a",
      status: "active",
      certificate_generated: false,
    });
  });

  it("external: provider kept, purchase lifecycle starts at 'pending'", async () => {
    await warrantyService.create(
      { ...baseInput, type: "external", provider: "Warranties 2000" },
      "user-9",
    );
    const insert = db.current.calls[0];
    expect(stepArgs(insert, "insert")?.[0]).toMatchObject({
      type: "external",
      provider: "Warranties 2000",
      purchase_status: "pending",
      status: "active",
    });
  });
});

describe("markPurchased", () => {
  it("flips purchase_status and records amount_paid separately from cost basis", async () => {
    await warrantyService.markPurchased("war-0001", {
      purchasedBy: "user-9",
      purchaseDate: "2026-07-01",
      providerReference: "W2K-8891",
      amountPaid: 145,
    });
    const update = db.current.calls[0];
    expect(stepArgs(update, "update")?.[0]).toMatchObject({
      purchase_status: "purchased",
      purchased_by: "user-9",
      provider_reference: "W2K-8891",
      amount_paid: 145,
    });
    expect(
      (stepArgs(update, "update")?.[0] as { purchased_at: string }).purchased_at,
    ).toBe(new Date("2026-07-01").toISOString());
  });

  it("omitted amountPaid is stored as null (not defaulted to the cost basis)", async () => {
    await warrantyService.markPurchased("war-0001", { purchasedBy: "user-9" });
    const update = db.current.calls[0];
    expect(stepArgs(update, "update")?.[0]).toMatchObject({
      amount_paid: null,
      provider_reference: null,
    });
  });
});

describe("cancel", () => {
  it("only sets status = cancelled — dates are left intact", async () => {
    await warrantyService.cancel("war-0001", "user-9", "customer refunded");
    const update = db.current.calls[0];
    expect(stepArgs(update, "update")).toEqual([{ status: "cancelled" }]);
  });
});
