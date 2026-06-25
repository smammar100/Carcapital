import type { WarrantyStatus } from "@/lib/types";

/** Whole days from local midnight today until the coverage end date. */
export function daysRemaining(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Stored warranties never get the "expired" status written to them — they only
 * carry "active"/"cancelled". Derive "expired" for active cover whose end date
 * is before today (local midnight), otherwise return the stored status.
 */
export function effectiveWarrantyStatus(w: {
  status: WarrantyStatus;
  endDate: string;
}): WarrantyStatus {
  if (w.status === "active" && daysRemaining(w.endDate) < 0) return "expired";
  return w.status;
}
