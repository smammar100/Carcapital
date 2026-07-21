/**
 * GEN-71 — the reporting dashboard's numbers. These are what the business
 * acts on ("129 cars sold in 2024"), so the filtering and per-model maths are
 * pinned here rather than trusted to a chart.
 */
import { describe, expect, it } from "vitest";
import { makeVehicle } from "@/test/factories";
import {
  ALL,
  EMPTY_FILTERS,
  bestMarginModels,
  bestSellingModels,
  byModel,
  matchesFilters,
  profitOf,
} from "./reports";

const sold = (over: Parameters<typeof makeVehicle>[0] = {}) =>
  makeVehicle({
    status: "sold",
    dateSold: "2024-06-01",
    sellingPrice: 10_000,
    baseCost: 8_000,
    ...over,
  });

const inStock = (over: Parameters<typeof makeVehicle>[0] = {}) =>
  makeVehicle({
    status: "listed",
    dateSold: null,
    receivedDate: "2025-02-01",
    ...over,
  });

describe("matchesFilters", () => {
  it("passes everything when nothing is selected", () => {
    expect(matchesFilters(sold(), EMPTY_FILTERS)).toBe(true);
    expect(matchesFilters(inStock(), EMPTY_FILTERS)).toBe(true);
  });

  it("year means sale year for a sold car", () => {
    const v = sold({ dateSold: "2024-06-01", receivedDate: "2023-01-01" });
    expect(matchesFilters(v, { ...EMPTY_FILTERS, year: "2024" })).toBe(true);
    // Its arrival year must not sneak it into 2023.
    expect(matchesFilters(v, { ...EMPTY_FILTERS, year: "2023" })).toBe(false);
  });

  it("year means arrival year for a car still in stock", () => {
    const v = inStock({ receivedDate: "2025-02-01" });
    expect(matchesFilters(v, { ...EMPTY_FILTERS, year: "2025" })).toBe(true);
    expect(matchesFilters(v, { ...EMPTY_FILTERS, year: "2024" })).toBe(false);
  });

  it("combined filters intersect — not last-one-wins", () => {
    const audi = sold({ make: "AUDI", model: "A3", dateSold: "2024-06-01" });
    // Right make, wrong year: the year filter must still exclude it.
    expect(
      matchesFilters(audi, { ...EMPTY_FILTERS, make: "AUDI", year: "2023" }),
    ).toBe(false);
    // Right year, wrong make.
    expect(
      matchesFilters(audi, { ...EMPTY_FILTERS, make: "BMW", year: "2024" }),
    ).toBe(false);
    // Both right.
    expect(
      matchesFilters(audi, { ...EMPTY_FILTERS, make: "AUDI", year: "2024" }),
    ).toBe(true);
  });

  it("filters on model and status independently", () => {
    const v = sold({ make: "AUDI", model: "A3" });
    expect(matchesFilters(v, { ...EMPTY_FILTERS, model: "A3" })).toBe(true);
    expect(matchesFilters(v, { ...EMPTY_FILTERS, model: "A1" })).toBe(false);
    expect(matchesFilters(v, { ...EMPTY_FILTERS, status: "sold" })).toBe(true);
    expect(matchesFilters(v, { ...EMPTY_FILTERS, status: "listed" })).toBe(false);
  });

  it("ALL is the sentinel for an unset filter, not a literal match", () => {
    const v = sold({ make: "AUDI" });
    expect(matchesFilters(v, { ...EMPTY_FILTERS, make: ALL })).toBe(true);
  });
});

describe("profitOf", () => {
  it("is selling price less the all-in base cost", () => {
    expect(profitOf(sold({ sellingPrice: 12_000, baseCost: 9_500 }))).toBe(2_500);
  });

  it("an unsold car reads as a loss of its cost, not NaN", () => {
    expect(profitOf(sold({ sellingPrice: null, baseCost: 9_500 }))).toBe(-9_500);
  });
});

describe("byModel", () => {
  const rows = () =>
    byModel([
      sold({ make: "AUDI", model: "A3", sellingPrice: 10_000, baseCost: 8_000 }),
      sold({ make: "AUDI", model: "A3", sellingPrice: 10_000, baseCost: 9_000 }),
      sold({ make: "BMW", model: "1 Series", sellingPrice: 20_000, baseCost: 10_000 }),
    ]);

  it("groups by make + model and sums units, revenue and profit", () => {
    const audi = rows().find((r) => r.label === "AUDI A3");
    expect(audi).toMatchObject({ units: 2, revenue: 20_000, profit: 3_000 });
  });

  it("margin is profit as a share of revenue", () => {
    const audi = rows().find((r) => r.label === "AUDI A3")!;
    expect(audi.margin).toBeCloseTo(15, 5); // 3,000 / 20,000
    const bmw = rows().find((r) => r.label === "BMW 1 Series")!;
    expect(bmw.margin).toBeCloseTo(50, 5);
  });

  it("zero revenue is 0% margin, not a division by zero", () => {
    const [row] = byModel([
      sold({ make: "AUDI", model: "A3", sellingPrice: 0, baseCost: 0 }),
    ]);
    expect(row.margin).toBe(0);
  });
});

describe("ranking", () => {
  const rows = [
    { label: "A", units: 5, revenue: 100, profit: 5, margin: 5 },
    { label: "B", units: 5, revenue: 100, profit: 40, margin: 40 },
    { label: "C", units: 9, revenue: 100, profit: 10, margin: 10 },
  ];

  it("best-selling ranks by units, breaking ties on profit", () => {
    expect(bestSellingModels(rows, 3).map((r) => r.label)).toEqual([
      "C",
      "B",
      "A",
    ]);
  });

  it("best-margin ranks by margin, independent of volume", () => {
    expect(bestMarginModels(rows, 3).map((r) => r.label)).toEqual([
      "B",
      "C",
      "A",
    ]);
  });

  it("both respect the chart's limit", () => {
    expect(bestSellingModels(rows, 2)).toHaveLength(2);
    expect(bestMarginModels(rows, 2)).toHaveLength(2);
  });

  it("neither mutates the input order", () => {
    const before = rows.map((r) => r.label);
    bestSellingModels(rows, 3);
    bestMarginModels(rows, 3);
    expect(rows.map((r) => r.label)).toEqual(before);
  });
});
