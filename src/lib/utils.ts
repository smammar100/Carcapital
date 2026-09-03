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
 * Grows a control's clickable area to the 40px desktop floor (44px on touch)
 * without changing how large it looks.
 *
 * A 16px checkbox is a 16px target however much space sits around it, and the
 * app was full of them (GEN-122). This paints an invisible, centred ::after
 * over the control so the pointer has something bigger to land on while the
 * drawn control keeps its size — the same trick the design system already used
 * for touch, extended to the mouse.
 *
 * The control must be positioned (`relative`) for the pseudo to anchor to it,
 * and its neighbours must sit far enough apart that the expanded areas don't
 * overlap — an expander that covers the next control steals its clicks.
 */
export const hitTarget =
  "after:absolute after:top-1/2 after:left-1/2 after:size-full after:min-h-10 after:min-w-10 after:-translate-x-1/2 after:-translate-y-1/2 pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11";
