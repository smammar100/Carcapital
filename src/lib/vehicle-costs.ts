/**
 * The canonical vehicle cost rollup (GEN-88).
 *
 * `totalBuyingPrice`, `landedCost` and `baseCost` are *stored* columns, not
 * computed ones — All Vehicles' "Total cost" and "Profit", the Master Sheet
 * and the reports all read them straight from the row. So editing a cost field
 * without recomputing these leaves the rest of the app quoting a stale figure
 * that no longer matches the ledger the user is looking at.
 *
 * The formula below is deliberately the sum of the twelve lines the Financials
 * expense ledger displays, so `baseCost` and the on-screen "Total expenses"
 * are the same number by construction rather than by coincidence.
 */

export interface VehicleCostInputs {
  buyingPrice: number;
  buyersFee: number | null;
  inspectionCharge: number | null;
  collectionFee: number | null;
  deliveryFee: number | null;
  lateStorageFee: number | null;
  loadingFee: number | null;
  unloadingFee: number | null;
  stockingCharges: number;
  valueAddition: number;
  warrantyCost: number | null;
  otherCharges: number | null;
}

export interface VehicleCostTotals {
  /** Purchase price plus the acquisition fees charged against it. */
  totalBuyingPrice: number;
  /** Total buying plus getting-it-here and getting-it-ready costs. */
  landedCost: number;
  /** Everything the car has cost — equals the expense ledger total. */
  baseCost: number;
}

const n = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** Acquisition fees — the charges that sit on the purchase itself. */
export function acquisitionFees(v: VehicleCostInputs): number {
  return (
    n(v.buyersFee) +
    n(v.inspectionCharge) +
    n(v.collectionFee) +
    n(v.deliveryFee) +
    n(v.lateStorageFee) +
    n(v.otherCharges)
  );
}

/** Movement costs — physically handling the car. */
export function handlingFees(v: VehicleCostInputs): number {
  return n(v.loadingFee) + n(v.unloadingFee);
}

export function computeCostTotals(v: VehicleCostInputs): VehicleCostTotals {
  const totalBuyingPrice = n(v.buyingPrice) + acquisitionFees(v);
  const landedCost = totalBuyingPrice + handlingFees(v) + n(v.valueAddition);
  const baseCost = landedCost + n(v.stockingCharges) + n(v.warrantyCost);
  return { totalBuyingPrice, landedCost, baseCost };
}

/**
 * Profit against a base cost. Mirrors the "Profit" column in All Vehicles:
 * a sold car uses its realised price, an unsold one its asking price.
 */
export function computeGrossEarning(
  sellingPrice: number | null,
  listingPrice: number | null,
  baseCost: number,
): number | null {
  const topLine = sellingPrice ?? listingPrice;
  return topLine === null ? null : Math.round(topLine - baseCost);
}

/**
 * Everything that must be written alongside an edited cost field so the stored
 * derived columns stay true. Returns only the derived keys — merge this into
 * the user's patch.
 */
export function derivedCostPatch(
  next: VehicleCostInputs & {
    sellingPrice: number | null;
    listingPrice: number | null;
  },
): VehicleCostTotals & { grossEarning: number | null } {
  const totals = computeCostTotals(next);
  return {
    ...totals,
    grossEarning: computeGrossEarning(
      next.sellingPrice,
      next.listingPrice,
      totals.baseCost,
    ),
  };
}

/** The twelve keys that feed the rollup — an edit to any of them re-derives. */
export const COST_INPUT_KEYS = [
  "buyingPrice",
  "buyersFee",
  "inspectionCharge",
  "collectionFee",
  "deliveryFee",
  "lateStorageFee",
  "loadingFee",
  "unloadingFee",
  "stockingCharges",
  "valueAddition",
  "warrantyCost",
  "otherCharges",
] as const;

/** True when a patch touches anything the derived totals depend on. */
export function affectsCostTotals(patch: Record<string, unknown>): boolean {
  return (
    COST_INPUT_KEYS.some((k) => k in patch) ||
    "sellingPrice" in patch ||
    "listingPrice" in patch
  );
}
