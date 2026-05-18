// Tone maps for status / category fields not already covered by the existing
// badge components in `components/shared/status-badge.tsx`. Keys map to a
// colour token that is resolved against `COLOR_CLASSES` in that file (which
// already has full light + dark variants), so dark-mode parity is automatic.
//
// Existing badges that should be reused:
//   - VehicleStatusBadge   (vehicle status)
//   - SalesStageBadge      (sales pipeline stage)
//   - MaintenanceStatusBadge (maintenance status)

import type {
  AppointmentOutcome,
  AppointmentStatus,
  InvoiceStatus,
  LeadStatus,
  ReturnResolutionPath,
  ReturnStatus,
  WarrantyStatus,
} from "./types";

export const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
  yellow:
    "bg-yellow-100 text-yellow-900 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-900",
  orange:
    "bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900",
  green:
    "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  purple:
    "bg-purple-100 text-purple-900 border-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-900",
  pink: "bg-pink-100 text-pink-900 border-pink-200 dark:bg-pink-950/40 dark:text-pink-200 dark:border-pink-900",
  gray: "bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-700",
  red: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900",
};

export const LEAD_STATUS_TONE: Record<LeadStatus, string> = {
  new: "blue",
  contacted: "purple",
  appointment_booked: "orange",
  lost: "gray",
};

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, string> = {
  upcoming: "blue",
  completed: "green",
  cancelled: "gray",
  no_show: "red",
};

export const APPOINTMENT_OUTCOME_TONE: Record<AppointmentOutcome, string> = {
  pending: "gray",
  test_drive: "purple",
  offer_made: "yellow",
  deposit_taken: "orange",
  sold: "green",
  lost: "red",
};

export const WARRANTY_STATUS_TONE: Record<WarrantyStatus, string> = {
  active: "green",
  expired: "gray",
  cancelled: "red",
};

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, string> = {
  draft: "gray",
  sent: "blue",
  paid: "green",
  overdue: "red",
  issued: "blue",
  cancelled: "red",
};

export const RETURN_STATUS_TONE: Record<ReturnStatus, string> = {
  pending: "yellow",
  in_review: "blue",
  resolved: "green",
  rejected: "red",
};

export const RETURN_RESOLUTION_TONE: Record<ReturnResolutionPath, string> = {
  vendor: "purple",
  supplier: "blue",
  g_trader: "orange",
  other: "gray",
};

export const AT_INDICATOR_TONE: Record<string, string> = {
  great: "green",
  good: "blue",
  above_average: "yellow",
  unrated: "gray",
};

export function toneClass(token: string | undefined): string {
  return token ? (COLOR_CLASSES[token] ?? COLOR_CLASSES.gray) : COLOR_CLASSES.gray;
}
