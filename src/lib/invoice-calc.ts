/**
 * Pure invoice math — SPEC_Invoicing_Module §6. No I/O, unit-testable.
 * Consumed by the form's live cost-summary panel, the PDF template, and
 * invoice-service at save time (totals are persisted for immutability).
 */

import type { InvoiceLineItem, VatScheme } from "./types";

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

export function vatAmount(
  lines: InvoiceLineItem[],
  scheme: VatScheme,
): number {
  if (scheme === "standard_20") return round2(subtotal(lines) * 0.2);
  // margin_used: output VAT computed on margin, not shown on the customer
  // invoice. zero_rated: none.
  return 0;
}

export function grandTotalInclAddons(
  lines: InvoiceLineItem[],
  scheme: VatScheme,
): number {
  return round2(subtotal(lines) + vatAmount(lines, scheme));
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
): InvoiceTotals {
  const grand = grandTotalInclAddons(lines, scheme);
  const bal = balanceDue(grand, depositAmount, financeAmount);
  return {
    salesPrice: salesPrice(lines),
    discount: discountTotal(lines),
    paidAddonsTotal: paidAddonsTotal(lines),
    freeAddonsCount: freeAddonsCount(lines),
    subtotal: subtotal(lines),
    vatAmount: vatAmount(lines, scheme),
    grandTotalInclAddons: grand,
    balanceDue: bal.balanceDue,
    overpayment: bal.overpayment,
  };
}
