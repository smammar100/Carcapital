/**
 * Characterization tests — SPEC invoice math (src/lib/invoice-calc.ts).
 *
 * This module IS invoice-service's pure calculation core: invoice-service's
 * own `legacyTotals`/`prepareInvoice` are module-private and DB-coupled, and
 * the invoice-generation page (src/app/(dashboard)/sales/invoice-generation/
 * page.tsx) keeps some presentation-level math inline in the component —
 * both are untestable here until an extraction (A6) moves them into
 * invoice-math.ts. Everything they compute funnels through the functions
 * pinned below.
 */
import { describe, expect, it } from "vitest";
import {
  balanceDue,
  computeInvoiceTotals,
  discountTotal,
  freeAddonsCount,
  grandTotalInclAddons,
  paidAddonsTotal,
  salesPrice,
  subtotal,
  vatAmount,
} from "./invoice-calc";
import { makeLineItem } from "@/test/factories";

// £12,495 Golf, £500 discount, £299 paid warranty add-on, free mats.
const lines = [
  makeLineItem("vehicle_price", 12495),
  makeLineItem("discount", 500),
  makeLineItem("addon_paid", 299, { description: "12-month warranty" }),
  makeLineItem("addon_free", 0, { description: "Floor mats", total: 0 }),
];
const VEHICLE_COST = 10000;

describe("line aggregations", () => {
  it("salesPrice takes the vehicle line total", () => {
    expect(salesPrice(lines)).toBe(12495);
    expect(salesPrice([])).toBe(0);
  });

  it("discountTotal / paidAddonsTotal / freeAddonsCount", () => {
    expect(discountTotal(lines)).toBe(500);
    expect(paidAddonsTotal(lines)).toBe(299);
    expect(freeAddonsCount(lines)).toBe(1);
  });

  it("subtotal = vehicle − discount + paid add-ons", () => {
    expect(subtotal(lines)).toBe(12294);
  });

  it("only the FIRST vehicle/discount line counts, but VAT sums ALL of them", () => {
    // NOTE: pins existing behavior — possible bug: salesPrice/discountTotal
    // use .find(), so a second discount line is ignored by the subtotal while
    // vatAmount still includes its (negative) VAT — the two go out of sync.
    const doubled = [...lines, makeLineItem("discount", 100)];
    expect(discountTotal(doubled)).toBe(500); // second £100 discount dropped
    expect(subtotal(doubled)).toBe(12294); // unchanged
    expect(vatAmount(doubled, "standard_20")).toBe(
      vatAmount(lines, "standard_20") - 20, // …yet its VAT is subtracted
    );
  });
});

describe("vatAmount per scheme", () => {
  it("margin_used: margin/6 on vehicle, 20% on add-ons, −20% on discount", () => {
    // (12495−10000)/6 = 415.8333→415.83; 299×0.2 = 59.8; −500×0.2 = −100
    expect(vatAmount(lines, "margin_used", VEHICLE_COST)).toBe(375.63);
  });

  it("margin_used with no vehicleCost taxes the whole price as margin", () => {
    // 12495/6 = 2082.5 + 59.8 − 100
    expect(vatAmount(lines, "margin_used")).toBe(2042.3);
  });

  it("standard_20: 20% of every line (discount negative)", () => {
    // 2499 + 59.8 − 100
    expect(vatAmount(lines, "standard_20", VEHICLE_COST)).toBe(2458.8);
  });

  it("zero_rated: 0", () => {
    expect(vatAmount(lines, "zero_rated", VEHICLE_COST)).toBe(0);
  });
});

describe("grandTotalInclAddons", () => {
  it("standard scheme ADDS VAT on top of the subtotal", () => {
    expect(grandTotalInclAddons(lines, "standard_20", VEHICLE_COST)).toBe(
      12294 + 2458.8,
    );
  });

  it("margin scheme: customer pays the subtotal — VAT recorded separately", () => {
    expect(grandTotalInclAddons(lines, "margin_used", VEHICLE_COST)).toBe(12294);
  });

  it("zero rated: customer pays the subtotal", () => {
    expect(grandTotalInclAddons(lines, "zero_rated")).toBe(12294);
  });
});

describe("balanceDue (deposit / finance arithmetic)", () => {
  it("grand − deposit − finance", () => {
    expect(balanceDue(12294, 500, 10000)).toEqual({
      balanceDue: 1794,
      overpayment: false,
    });
  });

  it("clamps to zero and flags overpayment when payments exceed the total", () => {
    expect(balanceDue(12294, 500, 12000)).toEqual({
      balanceDue: 0,
      overpayment: true,
    });
  });

  it("exact settlement is not an overpayment", () => {
    expect(balanceDue(12294, 294, 12000)).toEqual({
      balanceDue: 0,
      overpayment: false,
    });
  });

  it("rounds the balance to 2dp", () => {
    expect(balanceDue(100.556, 0.55, 0).balanceDue).toBe(100.01);
  });
});

describe("computeInvoiceTotals (one-shot summary)", () => {
  it("margin_used £12,495 sale with £500 deposit + £10,000 finance", () => {
    expect(computeInvoiceTotals(lines, "margin_used", 500, 10000, VEHICLE_COST))
      .toEqual({
        salesPrice: 12495,
        discount: 500,
        paidAddonsTotal: 299,
        freeAddonsCount: 1,
        subtotal: 12294,
        vatAmount: 375.63,
        grandTotalInclAddons: 12294,
        balanceDue: 1794,
        overpayment: false,
      });
  });

  it("standard_20 variant of the same deal", () => {
    expect(computeInvoiceTotals(lines, "standard_20", 500, 10000, VEHICLE_COST))
      .toEqual({
        salesPrice: 12495,
        discount: 500,
        paidAddonsTotal: 299,
        freeAddonsCount: 1,
        subtotal: 12294,
        vatAmount: 2458.8,
        grandTotalInclAddons: 14752.8,
        balanceDue: 4252.8,
        overpayment: false,
      });
  });

  it("empty invoice is all zeros", () => {
    expect(computeInvoiceTotals([], "margin_used", 0, 0)).toEqual({
      salesPrice: 0,
      discount: 0,
      paidAddonsTotal: 0,
      freeAddonsCount: 0,
      subtotal: 0,
      vatAmount: 0,
      grandTotalInclAddons: 0,
      balanceDue: 0,
      overpayment: false,
    });
  });
});
