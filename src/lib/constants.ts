import type {
  VehicleStatus,
  MaintenanceStatus,
  SalesStage,
  BodyType,
  FuelType,
  FinanceProvider,
} from "./types";

export const VEHICLE_STATUSES: {
  value: VehicleStatus;
  label: string;
  color: string;
}[] = [
  { value: "received", label: "Received", color: "blue" },
  { value: "inspection_pending", label: "Inspection Pending", color: "yellow" },
  { value: "being_prepared", label: "Being Prepared", color: "orange" },
  { value: "photos_pending", label: "Photos Pending", color: "yellow" },
  { value: "photos_ready", label: "Photos Ready", color: "green" },
  { value: "ready", label: "Ready", color: "green" },
  { value: "listed", label: "Listed", color: "purple" },
  { value: "reserved", label: "Reserved", color: "pink" },
  { value: "sold", label: "Sold", color: "gray" },
  { value: "returned", label: "Returned", color: "red" },
];

export const MAINTENANCE_STATUSES: {
  value: MaintenanceStatus;
  label: string;
  subtitle: string;
}[] = [
  { value: "pending", label: "Pending", subtitle: "New stock, no maintenance" },
  { value: "in_progress", label: "In Progress", subtitle: "Working" },
  { value: "completed", label: "Completed", subtitle: "Done" },
  { value: "stalled", label: "Stalled", subtitle: "Halted, no resolution" },
];

/**
 * The pipeline every company is seeded with (migration 0038). NOT the live
 * list — stages are configurable, so anything rendering a board or a dropdown
 * must read `pipelineStageService`. This is the fallback for the places that
 * only have a slug in hand, and the source of the shipped labels.
 *
 * "Offer Made" was dropped and "Test Drive" became "Qualified / Viewing" per
 * the UAT call (GEN-65). The `offer_made` label survives here so historical
 * deals and activity entries still render a name rather than a raw slug.
 */
const SALES_STAGES: { value: SalesStage; label: string }[] = [
  { value: "new_lead", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "test_drive", label: "Qualified / Viewing" },
  { value: "deposit_taken", label: "Deposit Taken" },
  { value: "collection_delivery", label: "Collection / Delivery" },
  { value: "completed_sale", label: "Completed Sale" },
  { value: "lost", label: "Lost" },
  { value: "offer_made", label: "Offer Made" },
];

/**
 * Display name for a stage slug. Falls back to a humanised slug so a
 * user-added stage ("awaiting_finance") reads as "Awaiting Finance" wherever
 * the live catalogue isn't loaded.
 */
export function salesStageLabel(slug: string): string {
  const known = SALES_STAGES.find((s) => s.value === slug);
  if (known) return known.label;
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const BODY_TYPES: BodyType[] = [
  "hatchback",
  "saloon",
  "suv",
  "mpv",
  "estate",
  "convertible",
  "coupe",
];

export const FUEL_TYPES: FuelType[] = ["petrol", "diesel", "hybrid", "electric"];

/**
 * Stocking (floorplan) funders — how the DEALERSHIP financed buying the car.
 * The fees are the economics of that: a charge to put a car on finance, a
 * daily holding cost, a charge to take it off.
 *
 * Not the customer's motor finance on a sale — that is
 * `MOTOR_FINANCE_PROVIDERS` in `@/lib/invoice-templates` (GEN-109).
 */
export const FINANCE_PROVIDERS: {
  value: FinanceProvider;
  label: string;
  loadingFee: number;
  dailyCharge: number;
  unloadingFee: number;
}[] = [
  {
    value: "none",
    label: "None / Self-funded",
    loadingFee: 0,
    dailyCharge: 0,
    unloadingFee: 0,
  },
  {
    value: "next_gear",
    label: "Next Gear Capital",
    loadingFee: 85,
    dailyCharge: 0.375,
    unloadingFee: 25,
  },
  {
    value: "close_brothers",
    label: "Close Brothers",
    loadingFee: 20,
    dailyCharge: 0.15,
    unloadingFee: 0,
  },
  {
    value: "bca",
    label: "BCA",
    loadingFee: 41,
    dailyCharge: 0.3,
    unloadingFee: 0,
  },
  {
    value: "infinit",
    label: "INFINIT",
    loadingFee: 0,
    dailyCharge: 0,
    unloadingFee: 0,
  },
];

export const AUCTION_HOUSES = [
  "BCA Auction",
  "Blackbushe",
  "Paddock Wood",
  "Manheim",
  "Other",
] as const;

export const DAYS_IN_STOCK_THRESHOLDS = {
  green: 30,
  amber: 60,
  red: 90,
};

export const VAT_RATE = 0.2;

// The 20-point checklist used to live here as a hard-coded constant. It's
// per-company, configurable data now (GEN-78) — see
// inspection-checklist-service.ts / migration 0042.

export const NEGATIVE_INSPECTION_STATUSES = new Set([
  "Expired",
  "Expiring Soon",
  "Low",
  "Poor",
  "Needs Replacing",
  "Contaminated",
  "Major Damage",
  "Replace",
  "Missing",
  "Dead",
  "Weak",
  "Active",
  "Faulty",
  "Abnormal",
  "Rough",
  "Slipping",
  "Fair",
  "No",
  "Fail",
]);
