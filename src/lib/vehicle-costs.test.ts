import { describe, expect, it } from "vitest";
import {
  acquisitionFees,
  affectsCostTotals,
  computeCostTotals,
  computeGrossEarning,
  derivedCostPatch,
  handlingFees,
  type VehicleCostInputs,
} from "./vehicle-costs";

const base: VehicleCostInputs = {
  buyingPrice: 10000,
  buyersFee: 200,
  inspectionCharge: 50,
  collectionFee: 100,
  deliveryFee: 75,
  lateStorageFee: 25,
  loadingFee: 30,
  unloadingFee: 20,
  stockingCharges: 85,
  valueAddition: 400,
  warrantyCost: 150,
  otherCharges: 60,
};

describe("acquisitionFees", () => {
  it("sums the purchase-side fees", () => {
    // 200 + 50 + 100 + 75 + 25 + 60
    expect(acquisitionFees(base)).toBe(510);
  });

  it("treats nulls as zero rather than NaN", () => {
    expect(
      acquisitionFees({
        ...base,
        buyersFee: null,
        inspectionCharge: null,
        collectionFee: null,
        deliveryFee: null,
        lateStorageFee: null,
        otherCharges: null,
      }),
    ).toBe(0);
  });
});

describe("handlingFees", () => {
  it("sums loading and unloading", () => {
    expect(handlingFees(base)).toBe(50);
  });

  it("treats nulls as zero", () => {
    expect(handlingFees({ ...base, loadingFee: null, unloadingFee: null })).toBe(0);
  });
});

describe("computeCostTotals", () => {
  it("derives total buying from price plus acquisition fees", () => {
    expect(computeCostTotals(base).totalBuyingPrice).toBe(10510);
  });

  it("derives landed cost from total buying plus handling and prep", () => {
    // 10510 + 50 handling + 400 prep
    expect(computeCostTotals(base).landedCost).toBe(10960);
  });

  it("derives base cost including stocking and warranty", () => {
    // 10960 + 85 stocking + 150 warranty
    expect(computeCostTotals(base).baseCost).toBe(11195);
  });

  /**
   * The guarantee the Financials tab depends on: the stored baseCost and the
   * on-screen expense ledger total must be the same number.
   */
  it("equals the sum of the twelve expense ledger lines", () => {
    const ledgerTotal =
      base.buyingPrice +
      (base.buyersFee ?? 0) +
      (base.inspectionCharge ?? 0) +
      (base.collectionFee ?? 0) +
      (base.deliveryFee ?? 0) +
      (base.lateStorageFee ?? 0) +
      (base.loadingFee ?? 0) +
      (base.unloadingFee ?? 0) +
      base.stockingCharges +
      base.valueAddition +
      (base.warrantyCost ?? 0) +
      (base.otherCharges ?? 0);

    expect(computeCostTotals(base).baseCost).toBe(ledgerTotal);
  });

  it("handles an all-null cost sheet", () => {
    const empty: VehicleCostInputs = {
      buyingPrice: 0,
      buyersFee: null,
      inspectionCharge: null,
      collectionFee: null,
      deliveryFee: null,
      lateStorageFee: null,
      loadingFee: null,
      unloadingFee: null,
      stockingCharges: 0,
      valueAddition: 0,
      warrantyCost: null,
      otherCharges: null,
    };
    expect(computeCostTotals(empty)).toEqual({
      totalBuyingPrice: 0,
      landedCost: 0,
      baseCost: 0,
    });
  });

  // GEN-88 UAT 3/4: correcting the buying price must move the totals.
  it("propagates a buying-price correction into every total", () => {
    const corrected = computeCostTotals({ ...base, buyingPrice: 9000 });
    expect(corrected.totalBuyingPrice).toBe(9510);
    expect(corrected.landedCost).toBe(9960);
    expect(corrected.baseCost).toBe(10195);
  });
});

describe("computeGrossEarning", () => {
  it("uses the realised price for a sold car", () => {
    expect(computeGrossEarning(13000, 14000, 11195)).toBe(1805);
  });

  it("falls back to the asking price when unsold", () => {
    expect(computeGrossEarning(null, 14000, 11195)).toBe(2805);
  });

  it("is null when neither price is known", () => {
    expect(computeGrossEarning(null, null, 11195)).toBeNull();
  });

  it("can be negative on a loss-making car", () => {
    expect(computeGrossEarning(10000, null, 11195)).toBe(-1195);
  });
});

describe("derivedCostPatch", () => {
  it("returns every derived column for the edited record", () => {
    const patch = derivedCostPatch({
      ...base,
      sellingPrice: null,
      listingPrice: 14000,
    });
    expect(patch).toEqual({
      totalBuyingPrice: 10510,
      landedCost: 10960,
      baseCost: 11195,
      grossEarning: 2805,
    });
  });
});

describe("affectsCostTotals", () => {
  it("detects a cost-field edit", () => {
    expect(affectsCostTotals({ buyingPrice: 9000 })).toBe(true);
    expect(affectsCostTotals({ warrantyCost: 0 })).toBe(true);
  });

  it("detects a price edit, which moves profit", () => {
    expect(affectsCostTotals({ listingPrice: 12000 })).toBe(true);
    expect(affectsCostTotals({ sellingPrice: 12000 })).toBe(true);
  });

  it("ignores an unrelated edit", () => {
    expect(affectsCostTotals({ colour: "Red" })).toBe(false);
    expect(affectsCostTotals({})).toBe(false);
  });
});
