/**
 * Pure invoice math — SPEC_Invoicing_Module §6. No I/O, unit-testable.
 * Consumed by the form's live cost-summary panel, the PDF template, and
 * invoice-service at save time (totals are persisted for immutability).
 */

import type { InvoiceLineItem, VatScheme } from "./types";
import { calculateVat, normalizeVatScheme } from "./vat";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function salesPrice(lines: InvoiceLineItem[]): number {
  return round2(
    lines.find((l) => l.type === "vehicle_price")?.total ?? 0,
  );
}

export function discountTotal(lines: InvoiceLineItem[]): number {
  return round2(lines.find((l) => l.type === "discount")?.total ?? 0);
}

export function paidAddonsTotal(lines: InvoiceLineItem[]): number {
  return round2(
    lines
      .filter((l) => l.type === "addon_paid")
      .reduce((s, l) => s + l.total, 0),
  );
}

export function freeAddonsCount(lines: InvoiceLineItem[]): number {
  return lines.filter((l) => l.type === "addon_free").length;
}

export function subtotal(lines: InvoiceLineItem[]): number {
  return round2(
    salesPrice(lines) - discountTotal(lines) + paidAddonsTotal(lines),
  );
}

/**
 * The VAT to RECORD on the invoice (output VAT for the VAT return). Computed
 * through the single `calculateVat` engine so it always equals the sum of the
 * per-line VAT stored on `invoice_line_items`:
 *   - standard: 20% of every line (added on top — see grandTotal)
 *   - margin:   (sale − vehicleCost)/6 on the vehicle line (VAT-inclusive), 20%
 *               on add-ons/fees
 *   - zero:     0
 * `vehicleCost` is the vehicle's buying price (needed for the margin line).
 */
export function vatAmount(
  lines: InvoiceLineItem[],
  scheme: VatScheme,
  vehicleCost = 0,
): number {
  return round2(
    lines.reduce(
      (sum, l) =>
        sum +
        calculateVat({
          scheme,
          lineNet: l.total,
          isVehicleLine: l.type === "vehicle_price",
          vehicleCost,
        }).vatAmount,
      0,
    ),
  );
}

export function grandTotalInclAddons(
  lines: InvoiceLineItem[],
  scheme: VatScheme,
  vehicleCost = 0,
): number {
  // Standard VAT is ADDED on top of the net price. Margin VAT is already
  // inside the price (VAT-inclusive) and zero-rated has none — so for those the
  // customer pays the subtotal, with VAT recorded separately (vatAmount above).
  if (normalizeVatScheme(scheme) === "standard") {
    return round2(subtotal(lines) + vatAmount(lines, scheme, vehicleCost));
  }
  return round2(subtotal(lines));
}

export interface BalanceResult {
  balanceDue: number;
  overpayment: boolean;
}

export function balanceDue(
  grandTotal: number,
  depositAmount: number,
  financeAmount: number,
): BalanceResult {
  const raw = round2(grandTotal - depositAmount - financeAmount);
  return { balanceDue: Math.max(0, raw), overpayment: raw < 0 };
}

export interface InvoiceTotals {
  salesPrice: number;
  discount: number;
  paidAddonsTotal: number;
  freeAddonsCount: number;
  subtotal: number;
  vatAmount: number;
  grandTotalInclAddons: number;
  balanceDue: number;
  overpayment: boolean;
}

/** One-shot summary used by the form panel, PDF, and service. */
export function computeInvoiceTotals(
  lines: InvoiceLineItem[],
  scheme: VatScheme,
  depositAmount: number,
  financeAmount: number,
  vehicleCost = 0,
): InvoiceTotals {
  const grand = grandTotalInclAddons(lines, scheme, vehicleCost);
  const bal = balanceDue(grand, depositAmount, financeAmount);
  return {
    salesPrice: salesPrice(lines),
    discount: discountTotal(lines),
    paidAddonsTotal: paidAddonsTotal(lines),
    freeAddonsCount: freeAddonsCount(lines),
    subtotal: subtotal(lines),
    vatAmount: vatAmount(lines, scheme, vehicleCost),
    grandTotalInclAddons: grand,
    balanceDue: bal.balanceDue,
    overpayment: bal.overpayment,
  };
}
