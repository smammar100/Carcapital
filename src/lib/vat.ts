/**
 * UK VAT calculation for invoices.
 *
 * Three schemes per Car Capital UK v4.1 spec:
 *   - margin     — UK Used-Car Margin Scheme. VAT applies only to the profit
 *                  margin on the vehicle line: (sale − cost) × 1/6. Add-on
 *                  lines fall back to standard 20% (per spec §11.15 footnote).
 *   - standard   — 20% VAT on every line subtotal.
 *   - zero_rated — no VAT.
 *
 * `calculateVat()` is a per-line helper. Callers are expected to pass
 * `vehicleCost` for the vehicle line under the margin scheme; otherwise it can
 * be omitted and the function falls back gracefully (no VAT on the vehicle if
 * cost is unknown).
 */

import type { VatScheme } from "./types";

export const STANDARD_VAT_RATE = 0.2;

export interface CalculateVatInput {
  scheme: VatScheme;
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
  const { scheme, lineNet, isVehicleLine = false, vehicleCost = 0 } = input;

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

  // Add-ons / fees / discounts under margin scheme: standard 20% per spec.
  const vatAmount = round2(lineNet * STANDARD_VAT_RATE);
  return { vatAmount, gross: round2(lineNet + vatAmount) };
}

export function formatVatLabel(scheme: VatScheme): string {
  switch (scheme) {
    case "margin":
      return "Margin Scheme — Used Vehicle";
    case "standard":
      return "Standard 20% VAT";
    case "zero_rated":
      return "Zero Rated";
  }
}
