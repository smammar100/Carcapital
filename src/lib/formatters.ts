/**
 * Display + validation formatters shared across the app.
 *
 * Prefer these over hand-rolling £ symbols and date strings in JSX — the
 * Phase 5 prompt requires every monetary, date, and mileage value to use
 * the same renderer so the app feels coherent at a glance.
 *
 * Currency / date / relative-time helpers also exist in `src/lib/utils.ts`
 * (`formatCurrency`, `formatDate`, `formatRelativeTime`) for back-compat
 * with code written before this module landed. New code should import
 * from here so we can converge on one source of truth.
 */
import { format, formatDistanceToNow, parseISO } from "date-fns";

/** Currency — "£12,450.00", "—" for null/zero (override with `showZero`). */
export function formatCurrency(
  amount: number | null | undefined,
  opts: { showZero?: boolean } = {},
): string {
  if (amount === null || amount === undefined) return "—";
  if (amount === 0 && !opts.showZero) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Compact currency for KPI cards — drops the ".00" on whole pounds. */
export function formatCurrencyCompact(
  amount: number | null | undefined,
): string {
  if (amount === null || amount === undefined) return "—";
  const fractionDigits = amount % 1 === 0 ? 0 : 2;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Date only — "23 Apr 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return "—";
  }
}

/** Date + time — "23 Apr 2026 · 14:12". */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy · HH:mm");
  } catch {
    return "—";
  }
}

/** Relative — "2 hours ago", "3 days ago". */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

/** Mileage — "51,500 mi". */
export function formatMileage(miles: number | null | undefined): string {
  if (miles === null || miles === undefined) return "—";
  return `${new Intl.NumberFormat("en-GB").format(miles)} mi`;
}

/** Days in stock — "144 days" or "144d" (compact). */
export function formatDaysInStock(days: number, compact: boolean = false): string {
  return compact ? `${days}d` : `${days} day${days === 1 ? "" : "s"}`;
}

/** Percentage — "23%". */
export function formatPercent(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

// ============================================================
// Validation predicates
// ============================================================

/** UK VIN — 17 chars alphanumeric, no I/O/Q. */
export function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

/** UK postcode — anywhere from "M1 1AA" to "SW1A 0AA". Whitespace-tolerant. */
export function isValidPostcode(pc: string): boolean {
  return /^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i.test(pc.trim());
}

/** UK mobile — `07…` or `+447…`, 11 / 13 digits, whitespace-tolerant. */
export function isValidUkMobile(phone: string): boolean {
  const cleaned = phone.replace(/\s+/g, "");
  return /^(\+447|07)\d{9}$/.test(cleaned);
}
