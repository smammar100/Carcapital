/**
 * Characterization tests — warranty creation/purchase defaults.
 * The date-based effective-status derivation itself is pure and pinned in
 * src/lib/warranty-status.test.ts; here we pin the type-driven defaults the
 * service stamps onto new rows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, stepArgs, type SupabaseMock } from "@/test/supabase-mock";
import { makeVehicle, makeWarranty } from "@/test/factories";
import type { Invoice, WarrantyDeclaration } from "@/lib/types";

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

/**
 * GEN-66 — closing a sales invoice is what issues the cover. Before this,
 * Section F only reached the PDF and no warranty record was ever written,
 * so "in-house" warranties simply didn't exist in the Warranties module.
 */
describe("syncFromInvoice", () => {
  const declaration: WarrantyDeclaration = {
    type: "in_house",
    provider: "Car Capital UK Ltd",
    providerPhone: "0208 000 0000",
    providerEmail: "warranty@carcapital.co.uk",
    coverType: "Premier",
    claimLimit: 2000,
    diagnosticsCover: 60,
    duration: "3 Months",
    excessPercent: 10,
    wearTearCovered: false,
  };

  const invoice = (over: Partial<Invoice> = {}): Invoice =>
    ({
      id: "inv-0001",
      companyId: "co-0001",
      vehicleId: "veh-0001",
      invoiceNumber: "INV-1042",
      invoiceDate: "2026-07-02",
      partyName: "Sarah Whitfield",
      partyPhone: "07700 900123",
      partyEmail: null,
      buyerName: "Sarah Whitfield",
      buyerPhone: "07700 900123",
      buyerEmail: "sarah@example.co.uk",
      lineItems: [
        { addonCategory: "warranty", total: 199 },
        { addonCategory: "wash", total: 40 },
      ],
      warranty: declaration,
      nonWarrantyDisclaimerAccepted: false,
      ...over,
    }) as unknown as Invoice;

  /** Respond to the initial `getForInvoice` lookup with `existing`, then rows. */
  function seed(existing: unknown) {
    let lookedUp = false;
    db.current = createSupabaseMock((call) => {
      if (call.table !== "warranties") return undefined;
      if (!lookedUp) {
        lookedUp = true;
        return { data: existing, error: null };
      }
      return { data: makeWarranty(), error: null };
    });
  }

  it("in-house declaration creates a warranty linked to the invoice", async () => {
    seed(null);
    await warrantyService.syncFromInvoice(invoice(), "user-9");
    const insert = db.current.calls.find((c) => stepArgs(c, "insert"));
    expect(stepArgs(insert!, "insert")?.[0]).toMatchObject({
      invoice_id: "inv-0001",
      vehicle_id: "veh-0001",
      type: "in_house",
      provider: "Car Capital",
      purchase_status: "n_a",
      status: "active",
      customer_name: "Sarah Whitfield",
      start_date: "2026-07-02",
      // 3 Months from the invoice date, and only the warranty add-on line
      // counts toward what the buyer paid for cover.
      end_date: "2026-10-02",
      cost_to_customer: 199,
    });
  });

  it("external declaration keeps the provider and starts the purchase tracker", async () => {
    seed(null);
    await warrantyService.syncFromInvoice(
      invoice({
        warranty: {
          ...declaration,
          type: "external",
          provider: "Warranties 2000",
          duration: "12 Months",
        },
      }),
      "user-9",
    );
    const insert = db.current.calls.find((c) => stepArgs(c, "insert"));
    expect(stepArgs(insert!, "insert")?.[0]).toMatchObject({
      type: "external",
      provider: "Warranties 2000",
      purchase_status: "pending",
      end_date: "2027-07-02",
    });
  });

  it("re-saving the same invoice updates its warranty instead of duplicating", async () => {
    seed(makeWarranty({ id: "war-0001", invoiceId: "inv-0001" }));
    await warrantyService.syncFromInvoice(invoice(), "user-9");
    expect(db.current.calls.some((c) => stepArgs(c, "insert"))).toBe(false);
    const update = db.current.calls.find((c) => stepArgs(c, "update"));
    expect(stepArgs(update!, "update")?.[0]).toMatchObject({
      type: "in_house",
      provider: "Car Capital",
      cost_to_customer: 199,
    });
  });

  it("no declaration (disclaimer ticked) creates nothing", async () => {
    seed(null);
    const result = await warrantyService.syncFromInvoice(
      invoice({ warranty: null, nonWarrantyDisclaimerAccepted: true }),
      "user-9",
    );
    expect(result).toBeNull();
    expect(db.current.calls.some((c) => stepArgs(c, "insert"))).toBe(false);
  });

  it("removing the declaration on an edit cancels the warranty it issued", async () => {
    seed(makeWarranty({ id: "war-0001", invoiceId: "inv-0001", status: "active" }));
    await warrantyService.syncFromInvoice(
      invoice({ warranty: null, nonWarrantyDisclaimerAccepted: true }),
      "user-9",
    );
    const update = db.current.calls.find((c) => stepArgs(c, "update"));
    expect(stepArgs(update!, "update")?.[0]).toEqual({ status: "cancelled" });
  });

  it("end date clamps to a shorter month rather than spilling into the next", async () => {
    seed(null);
    await warrantyService.syncFromInvoice(
      invoice({ invoiceDate: "2026-01-31" }),
      "user-9",
    );
    const insert = db.current.calls.find((c) => stepArgs(c, "insert"));
    expect(stepArgs(insert!, "insert")?.[0]).toMatchObject({
      end_date: "2026-04-30",
    });
  });
});
