/**
 * UK VAT calculation for invoices.
 *
 * Canonical schemes (math is identical regardless of naming):
 *   - margin     — UK Used-Car Margin Scheme. VAT applies only to the profit
 *                  margin on the vehicle line: (sale − cost) × 1/6. Add-on
 *                  lines fall back to standard 20%.
 *   - standard   — 20% VAT on every line subtotal.
 *   - zero_rated — no VAT.
 *
 * SPEC_Invoicing_Module v2.0 renamed the scheme values to
 * `margin_used | standard_20 | zero_rated`. Existing rows still carry the
 * pre-spec `margin | standard | zero_rated`. Both are accepted everywhere and
 * collapsed via `normalizeVatScheme()`.
 */

import type { VatScheme, LegacyVatScheme } from "./types";

export const STANDARD_VAT_RATE = 0.2;

export type AnyVatScheme = VatScheme | LegacyVatScheme;
type CanonicalVatScheme = "margin" | "standard" | "zero_rated";

/** Collapse new + legacy scheme names to the canonical math bucket. */
export function normalizeVatScheme(scheme: AnyVatScheme): CanonicalVatScheme {
  switch (scheme) {
    case "margin":
    case "margin_used":
      return "margin";
    case "standard":
    case "standard_20":
      return "standard";
    case "zero_rated":
      return "zero_rated";
    default:
      return "margin";
  }
}

export interface CalculateVatInput {
  scheme: AnyVatScheme;
  /** The line subtotal (qty × unit price, signed for discounts). */
  lineNet: number;
  /** True for the vehicle line item (drives margin-scheme path). */
  isVehicleLine?: boolean;
  /** Required for vehicle line under margin scheme. */
  vehicleCost?: number;
}

export interface CalculateVatResult {
  vatAmount: number;
  gross: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateVat(input: CalculateVatInput): CalculateVatResult {
  const { lineNet, isVehicleLine = false, vehicleCost = 0 } = input;
  const scheme = normalizeVatScheme(input.scheme);

  if (scheme === "zero_rated") {
    return { vatAmount: 0, gross: round2(lineNet) };
  }

  if (scheme === "standard") {
    const vatAmount = round2(lineNet * STANDARD_VAT_RATE);
    return { vatAmount, gross: round2(lineNet + vatAmount) };
  }

  // scheme === "margin"
  if (isVehicleLine) {
    const margin = Math.max(0, lineNet - vehicleCost);
    const vatAmount = round2(margin / 6); // 1/6 of margin = 20% VAT-inclusive
    return { vatAmount, gross: round2(lineNet + vatAmount) };
  }

  // Add-ons / fees / discounts under margin scheme: standard 20%.
  const vatAmount = round2(lineNet * STANDARD_VAT_RATE);
  return { vatAmount, gross: round2(lineNet + vatAmount) };
}

export function formatVatLabel(scheme: AnyVatScheme): string {
  switch (normalizeVatScheme(scheme)) {
    case "margin":
      return "Margin Scheme: Used Vehicle";
    case "standard":
      return "Standard 20% VAT";
    case "zero_rated":
      return "Zero Rated";
  }
}
