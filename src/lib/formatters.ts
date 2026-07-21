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

/**
 * Reduce a typed UK phone number to its national form (`0…`), or null if it
 * isn't one.
 *
 * People type phone numbers with whatever separators they like — spaces,
 * hyphens, brackets, dots, a leading +. All of those are noise; only the
 * digits carry meaning. Previously only whitespace was stripped, so
 * "0161-496-0123" and "(01234) 567890" were rejected as invalid (GEN-67).
 *
 * Returns null for anything containing letters or other junk, so genuinely
 * bad input is still caught.
 */
export function normaliseUkPhone(phone: string): string | null {
  const cleaned = phone.trim().replace(/[\s\-().]/g, "");
  if (!cleaned) return null;

  // Accept the three ways of writing the country code, then work in national
  // form ("020…", "07…") so every rule below reads the same.
  let national: string;
  if (cleaned.startsWith("+44")) national = `0${cleaned.slice(3)}`;
  else if (cleaned.startsWith("0044")) national = `0${cleaned.slice(4)}`;
  else if (cleaned.startsWith("44") && !cleaned.startsWith("440"))
    national = `0${cleaned.slice(2)}`;
  else national = cleaned;

  // Letters, symbols, a stray "+" mid-number: not a phone number.
  if (!/^\d+$/.test(national)) return null;
  if (!national.startsWith("0")) return null;

  // UK numbers are 10 or 11 digits nationally. 04 and 06 are unallocated, and
  // "00…" is an international prefix, not a UK number.
  if (!/^0[12335789]/.test(national)) return null;
  if (national.length < 10 || national.length > 11) return null;

  // Mobiles are always 11 digits — a 10-digit "07…" is a typo, not a short
  // landline.
  if (national.startsWith("07") && national.length !== 11) return null;

  return national;
}

/** Any valid UK number — mobile, landline, or non-geographic. */
export function isValidUkPhone(phone: string): boolean {
  return normaliseUkPhone(phone) !== null;
}

/**
 * UK mobile specifically (`07…`). Use only where a mobile is genuinely
 * required — a field merely labelled "phone" should take `isValidUkPhone`,
 * which accepts landlines too.
 */
export function isValidUkMobile(phone: string): boolean {
  const national = normaliseUkPhone(phone);
  return national !== null && national.startsWith("07");
}
