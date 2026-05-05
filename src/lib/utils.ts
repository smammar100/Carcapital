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

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
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

/** Stripe-style "6 Dec 2024, 12:35". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return DATETIME_FMT.format(new Date(iso));
}

const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatTime12(hhmm: string): string {
  // accepts "14:30" → "2:30 PM"
  const [h, m] = hhmm.split(":").map(Number);
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
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86400000);
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
