/**
 * Characterization tests — sales pipeline stage transitions.
 *
 * Pins the side-effect matrix of `salesService.updateStage`:
 *   completed_sale      → completion_date stamped, vehicle → sold,
 *                         publishable listing → sold (drafts untouched)
 *   deposit_taken /
 *   collection_delivery → vehicle reserved, live listing → reserved
 *   lost                → reserved vehicle released back to listed;
 *                         reserved listing → live, anything else → draft
 * plus the create() dedupe (never a second active deal per vehicle/lead).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, stepArgs, type SupabaseMock } from "@/test/supabase-mock";
import { makeListing, makeSalesDeal, makeVehicle } from "@/test/factories";
import type { Listing, SalesStage, Vehicle } from "@/lib/types";

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

const vehicleMocks = vi.hoisted(() => ({
  getById: vi.fn(),
  changeStatus: vi.fn(async () => undefined),
  update: vi.fn(async () => undefined),
}));
vi.mock("./vehicle-service", () => ({ vehicleService: vehicleMocks }));

const listingMocks = vi.hoisted(() => ({
  getForVehicle: vi.fn(),
  setStatusForVehicle: vi.fn(async () => undefined),
}));
vi.mock("./listing-service", () => ({ listingService: listingMocks }));

import { salesService } from "./sales-service";

function setup(opts: {
  stage: SalesStage;
  vehicle?: Partial<Vehicle>;
  listing?: Partial<Listing> | null;
}) {
  const deal = makeSalesDeal({ stage: opts.stage });
  db.current = createSupabaseMock((call) => {
    if (call.table === "sales_deals") return { data: deal, error: null };
    return undefined;
  });
  vehicleMocks.getById.mockResolvedValue(makeVehicle(opts.vehicle));
  listingMocks.getForVehicle.mockResolvedValue(
    opts.listing === null ? null : makeListing(opts.listing),
  );
  return deal;
}

beforeEach(() => {
  vehicleMocks.getById.mockReset();
  vehicleMocks.changeStatus.mockReset().mockResolvedValue(undefined);
  vehicleMocks.update.mockReset().mockResolvedValue(undefined);
  listingMocks.getForVehicle.mockReset();
  listingMocks.setStatusForVehicle.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-02T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("updateStage → completed_sale", () => {
  it("stamps completion_date (today, UTC date) and marks the vehicle sold", async () => {
    setup({ stage: "completed_sale", listing: { status: "live" } });
    await salesService.updateStage("deal-0001", "completed_sale", "user-9");

    const update = db.current.calls.find((c) =>
      c.steps.some((s) => s.method === "update"),
    );
    expect(stepArgs(update!, "update")).toEqual([
      { stage: "completed_sale", completion_date: "2026-07-02" },
    ]);
    // GEN-43: completing a sale stamps the vehicle row itself (status,
    // date_sold, selling_price, frozen days-in-stock) via update(), not a
    // bare changeStatus() — the dashboard/reports read those columns.
    expect(vehicleMocks.update).toHaveBeenCalledWith(
      "veh-0001",
      expect.objectContaining({ status: "sold", dateSold: "2026-07-02" }),
      "user-9",
    );
    expect(listingMocks.setStatusForVehicle).toHaveBeenCalledWith(
      "veh-0001",
      "sold",
    );
  });

  it("never stamps 'sold' on a draft listing", async () => {
    setup({ stage: "completed_sale", listing: { status: "draft" } });
    await salesService.updateStage("deal-0001", "completed_sale", "user-9");
    expect(vehicleMocks.update).toHaveBeenCalledWith(
      "veh-0001",
      expect.objectContaining({ status: "sold" }),
      "user-9",
    );
    expect(listingMocks.setStatusForVehicle).not.toHaveBeenCalled();
  });
});

describe.each(["deposit_taken", "collection_delivery"] as const)(
  "updateStage → %s (reservation)",
  (stage) => {
    it("reserves an available vehicle and its live listing", async () => {
      setup({ stage, vehicle: { status: "listed" }, listing: { status: "live" } });
      await salesService.updateStage("deal-0001", stage, "user-9");
      expect(vehicleMocks.changeStatus).toHaveBeenCalledWith(
        "veh-0001",
        "reserved",
        "user-9",
      );
      expect(listingMocks.setStatusForVehicle).toHaveBeenCalledWith(
        "veh-0001",
        "reserved",
      );
    });

    it("skips the vehicle status change when already reserved/sold, but still re-stamps the listing", async () => {
      setup({ stage, vehicle: { status: "reserved" }, listing: { status: "reserved" } });
      await salesService.updateStage("deal-0001", stage, "user-9");
      expect(vehicleMocks.changeStatus).not.toHaveBeenCalled();
      // NOTE: pins existing behavior — the listing is re-set to "reserved"
      // every time, even when it already is.
      expect(listingMocks.setStatusForVehicle).toHaveBeenCalledWith(
        "veh-0001",
        "reserved",
      );
    });

    it("leaves a draft listing untouched", async () => {
      setup({ stage, vehicle: { status: "listed" }, listing: { status: "draft" } });
      await salesService.updateStage("deal-0001", stage, "user-9");
      expect(listingMocks.setStatusForVehicle).not.toHaveBeenCalled();
    });
  },
);

describe("updateStage → lost (release reservation)", () => {
  it("releases a reserved vehicle back to listed; reserved listing goes live", async () => {
    setup({ stage: "lost", vehicle: { status: "reserved" }, listing: { status: "reserved" } });
    await salesService.updateStage("deal-0001", "lost", "user-9");
    expect(vehicleMocks.changeStatus).toHaveBeenCalledWith(
      "veh-0001",
      "listed",
      "user-9",
    );
    expect(listingMocks.setStatusForVehicle).toHaveBeenCalledWith(
      "veh-0001",
      "live",
    );
  });

  it("a non-reserved listing reverts to draft, never silently published", async () => {
    setup({ stage: "lost", vehicle: { status: "reserved" }, listing: { status: "live" } });
    await salesService.updateStage("deal-0001", "lost", "user-9");
    // NOTE: pins existing behavior — possible bug: a listing that was LIVE
    // (not reserved) when the deal is lost gets demoted to "draft".
    expect(listingMocks.setStatusForVehicle).toHaveBeenCalledWith(
      "veh-0001",
      "draft",
    );
  });

  it("does nothing to vehicle/listing when the vehicle was never reserved", async () => {
    setup({ stage: "lost", vehicle: { status: "listed" }, listing: { status: "live" } });
    await salesService.updateStage("deal-0001", "lost", "user-9");
    expect(vehicleMocks.changeStatus).not.toHaveBeenCalled();
    expect(listingMocks.setStatusForVehicle).not.toHaveBeenCalled();
  });
});

describe("updateStage → informational stages", () => {
  it("contacted changes nothing beyond the stage column", async () => {
    setup({ stage: "contacted", listing: { status: "live" } });
    await salesService.updateStage("deal-0001", "contacted", "user-9");
    const update = db.current.calls.find((c) =>
      c.steps.some((s) => s.method === "update"),
    );
    expect(stepArgs(update!, "update")).toEqual([{ stage: "contacted" }]);
    expect(vehicleMocks.changeStatus).not.toHaveBeenCalled();
    expect(listingMocks.setStatusForVehicle).not.toHaveBeenCalled();
  });
});

describe("create — active-deal dedupe", () => {
  const input = {
    companyId: "co-0001",
    vehicleId: "veh-0001",
    leadId: "lead-0001",
    customerName: "Sarah Whitfield",
    customerPhone: "07700 900123",
    customerEmail: null,
    sellingAgent: "user-2",
  };

  it("returns the existing active deal instead of inserting a duplicate", async () => {
    const existing = makeSalesDeal({ stage: "offer_made" });
    db.current = createSupabaseMock((call) => {
      if (call.table === "sales_deals") return { data: [existing], error: null };
      return undefined;
    });
    const res = await salesService.create(input);
    expect(res).toEqual({ deal: existing, existing: true });
    // Dedupe filter excludes lost deals and ORs vehicle + lead.
    const probe = db.current.calls[0];
    expect(stepArgs(probe, "neq")).toEqual(["stage", "lost"]);
    expect(stepArgs(probe, "or")).toEqual([
      "vehicle_id.eq.veh-0001,lead_id.eq.lead-0001",
    ]);
    expect(db.current.calls.some((c) => c.steps.some((s) => s.method === "insert"))).toBe(false);
  });

  it("inserts a new deal at stage new_lead when none is active", async () => {
    const created = makeSalesDeal();
    let probed = false;
    db.current = createSupabaseMock((call) => {
      if (call.table === "sales_deals" && !probed) {
        probed = true;
        return { data: [], error: null };
      }
      return { data: created, error: null };
    });
    const res = await salesService.create(input);
    expect(res.existing).toBe(false);
    const insert = db.current.calls.find((c) =>
      c.steps.some((s) => s.method === "insert"),
    );
    expect(stepArgs(insert!, "insert")?.[0]).toMatchObject({
      stage: "new_lead",
      vehicle_id: "veh-0001",
      lead_id: "lead-0001",
    });
  });
});
