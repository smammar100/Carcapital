import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DAYS_IN_STOCK_THRESHOLDS } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return GBP.format(value);
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// A bare date ("2026-06-25", no time) is parsed as UTC midnight; formatting it
// in a negative-UTC locale can roll back to the previous day. Detect these and
// render in UTC so the shown day matches the stored date.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_FMT_UTC = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  if (DATE_ONLY_RE.test(iso)) return DATE_FMT_UTC.format(new Date(iso));
  return DATE_FMT.format(new Date(iso));
}

const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATETIME_FMT_UTC = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Stripe-style "6 Dec 2024, 12:35". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Date-only input has no time component — format in UTC so the day is stable.
  if (DATE_ONLY_RE.test(iso)) return DATETIME_FMT_UTC.format(new Date(iso));
  return DATETIME_FMT.format(new Date(iso));
}

const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatTime12(hhmm: string): string {
  // accepts "14:30" → "2:30 PM"
  const [h, m] = (hhmm ?? "").split(":").map(Number);
  // Guard malformed/empty input so we never render "Invalid Date".
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "—";
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return TIME_FMT.format(d).toLowerCase().replace(" ", "");
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

export function daysBetween(a: string, b: string): number {
  // Compare UTC-midnight of each date so the count is DST-safe (a fixed
  // 86_400_000 ms divisor is off by one across a DST boundary).
  const da = new Date(a);
  const db = new Date(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86400000);
}

export type DaysInStockColor = "green" | "amber" | "red";

export function getDaysInStockColor(days: number): DaysInStockColor {
  if (days < DAYS_IN_STOCK_THRESHOLDS.green) return "green";
  if (days < DAYS_IN_STOCK_THRESHOLDS.amber) return "amber";
  return "red";
}

export function formatRegPlate(reg: string): string {
  const cleaned = reg.toUpperCase().replace(/\s+/g, "");
  if (cleaned.length === 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  return cleaned;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/**
 * SPEC Point 2 — 12-char temporary password for direct user creation.
 * Excludes ambiguous chars (0/O, 1/l/I) so it can be read aloud.
 */
export function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const pick = (set: string, n: number) => {
    const r = new Uint32Array(n);
    crypto.getRandomValues(r);
    return Array.from(r, (x) => set[x % set.length]).join("");
  };
  const raw = pick(upper, 3) + pick(lower, 3) + pick(digits, 3) + pick(symbols, 3);
  const arr = raw.split("");
  const ord = new Uint32Array(arr.length);
  crypto.getRandomValues(ord);
  return arr
    .map((c, i) => ({ c, k: ord[i] }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c)
    .join("");
}
