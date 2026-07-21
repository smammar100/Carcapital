import type { Vehicle } from "@/lib/types";

/**
 * Pure aggregation behind Reports & Analytics (GEN-71).
 *
 * Lives outside the page because these are the numbers the business acts on —
 * "129 cars sold in 2024" has to be right, and has to be checkable without
 * rendering a chart.
 */

/** Sentinel for "no filter applied". */
export const ALL = "all";

export interface ReportFilters {
  /** Year of the vehicle's event — see `matchesFilters`. */
  year: string;
  make: string;
  model: string;
  status: string;
}

export const EMPTY_FILTERS: ReportFilters = {
  year: ALL,
  make: ALL,
  model: ALL,
  status: ALL,
};

/**
 * Does this vehicle survive the filter bar?
 *
 * Filters combine as an intersection — year AND make AND model AND status, not
 * whichever was picked last.
 *
 * "Year" means the year of the event the page is reporting on: the sale year
 * for a car that sold, the arrival year for one still in stock. A car has one
 * or the other, never both, so there's no ambiguity per row.
 */
export function matchesFilters(v: Vehicle, f: ReportFilters): boolean {
  if (f.make !== ALL && v.make !== f.make) return false;
  if (f.model !== ALL && v.model !== f.model) return false;
  if (f.status !== ALL && v.status !== f.status) return false;
  if (f.year !== ALL) {
    const iso = v.dateSold ?? v.receivedDate;
    if (!iso || iso.slice(0, 4) !== f.year) return false;
  }
  return true;
}

/** Profit on a sold car: what it fetched, less everything it cost to get here. */
export const profitOf = (v: Vehicle): number =>
  (v.sellingPrice ?? 0) - v.baseCost;

export interface ModelRow {
  label: string;
  units: number;
  revenue: number;
  profit: number;
  /** Profit as a percentage of revenue. 0 when nothing was sold. */
  margin: number;
}

/**
 * Per-model performance — "which models sell, and which ones actually make
 * money". Margin is a share of revenue, not an absolute, so a cheap car with a
 * fat mark-up ranks above an expensive one sold near cost.
 */
export function byModel(sold: Vehicle[]): ModelRow[] {
  const map = new Map<string, ModelRow>();
  for (const v of sold) {
    const label = `${v.make} ${v.model}`.trim() || "Unknown";
    const row = map.get(label) ?? {
      label,
      units: 0,
      revenue: 0,
      profit: 0,
      margin: 0,
    };
    row.units += 1;
    row.revenue += v.sellingPrice ?? 0;
    row.profit += profitOf(v);
    map.set(label, row);
  }
  for (const row of map.values()) {
    row.margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
  }
  return [...map.values()];
}

/** Best sellers first; ties broken by which made more money. */
export function bestSellingModels(rows: ModelRow[], limit: number): ModelRow[] {
  return [...rows]
    .sort((a, b) => b.units - a.units || b.profit - a.profit)
    .slice(0, limit);
}

/** Fattest margins first. */
export function bestMarginModels(rows: ModelRow[], limit: number): ModelRow[] {
  return [...rows].sort((a, b) => b.margin - a.margin).slice(0, limit);
}
