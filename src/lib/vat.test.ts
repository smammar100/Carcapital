/**
 * Characterization tests — the single VAT engine (src/lib/vat.ts).
 * This is the calc core consumed by invoice-service (legacyTotals) and
 * invoice-calc (SPEC sales totals).
 */
import { describe, expect, it } from "vitest";
import {
  STANDARD_VAT_RATE,
  calculateVat,
  formatVatLabel,
  normalizeVatScheme,
} from "./vat";

describe("normalizeVatScheme", () => {
  it.each([
    ["margin", "margin"],
    ["margin_used", "margin"],
    ["standard", "standard"],
    ["standard_20", "standard"],
    ["zero_rated", "zero_rated"],
  ] as const)("%s → %s", (input, expected) => {
    expect(normalizeVatScheme(input)).toBe(expected);
  });

  it("unknown scheme strings silently fall back to margin", () => {
    // NOTE: pins existing behavior — possible bug: a typo'd scheme value is
    // treated as the margin scheme rather than rejected.
    expect(normalizeVatScheme("vat_20" as never)).toBe("margin");
  });
});

describe("calculateVat — standard 20%", () => {
  it("adds 20% on a £12,495.00 vehicle line", () => {
    expect(STANDARD_VAT_RATE).toBe(0.2);
    expect(
      calculateVat({ scheme: "standard_20", lineNet: 12495, isVehicleLine: true }),
    ).toEqual({ vatAmount: 2499, gross: 14994 });
  });

  it("rounds half-penny VAT to 2dp", () => {
    // 33.33 × 0.2 = 6.666 → 6.67
    expect(calculateVat({ scheme: "standard", lineNet: 33.33 })).toEqual({
      vatAmount: 6.67,
      gross: 40,
    });
  });
});

describe("calculateVat — margin scheme (used vehicles)", () => {
  it("vehicle line: VAT = (sale − cost) / 6, VAT-inclusive", () => {
    const r = calculateVat({
      scheme: "margin_used",
      lineNet: 12495,
      isVehicleLine: true,
      vehicleCost: 10000,
    });
    // margin £2,495 → 2495/6 = 415.8333… → 415.83
    expect(r.vatAmount).toBe(415.83);
    // NOTE: pins existing behavior — possible bug: gross ADDS the margin VAT
    // on top of the sale price (12495 + 415.83) even though margin VAT is
    // documented as already inside the price.
    expect(r.gross).toBe(12910.83);
  });

  it("negative margin (sold below cost) clamps VAT to zero", () => {
    expect(
      calculateVat({
        scheme: "margin",
        lineNet: 9500,
        isVehicleLine: true,
        vehicleCost: 10000,
      }),
    ).toEqual({ vatAmount: 0, gross: 9500 });
  });

  it("non-vehicle lines under margin scheme get standard 20%", () => {
    expect(
      calculateVat({ scheme: "margin_used", lineNet: 299 }),
    ).toEqual({ vatAmount: 59.8, gross: 358.8 });
  });

  it("negative net (discount fed as negative) yields negative VAT", () => {
    expect(calculateVat({ scheme: "margin_used", lineNet: -500 })).toEqual({
      vatAmount: -100,
      gross: -600,
    });
  });
});

describe("calculateVat — zero rated", () => {
  it("no VAT on any line", () => {
    expect(
      calculateVat({ scheme: "zero_rated", lineNet: 12495, isVehicleLine: true }),
    ).toEqual({ vatAmount: 0, gross: 12495 });
  });
});

describe("formatVatLabel", () => {
  it.each([
    ["margin_used", "Margin Scheme — Used Vehicle"],
    ["margin", "Margin Scheme — Used Vehicle"],
    ["standard_20", "Standard 20% VAT"],
    ["zero_rated", "Zero Rated"],
  ] as const)("%s → %s", (scheme, label) => {
    expect(formatVatLabel(scheme)).toBe(label);
  });
});
