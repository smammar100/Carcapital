import { describe, expect, it } from "vitest";
import {
  compareValues,
  cycleSort,
  sortRows,
  toSortableDate,
  toSortableNumber,
  toSortableText,
  type SortState,
} from "./table-sort";

describe("cycleSort", () => {
  // GEN-92 UAT 1-3: asc → desc → unsorted.
  it("starts an unsorted column at ascending", () => {
    expect(cycleSort(null, "make__Make")).toEqual({
      column: "make__Make",
      direction: "asc",
    });
  });

  it("flips ascending to descending", () => {
    const current: SortState = { column: "make__Make", direction: "asc" };
    expect(cycleSort(current, "make__Make")).toEqual({
      column: "make__Make",
      direction: "desc",
    });
  });

  it("clears the sort on the third click", () => {
    const current: SortState = { column: "make__Make", direction: "desc" };
    expect(cycleSort(current, "make__Make")).toBeNull();
  });

  it("starts a different column fresh at ascending", () => {
    const current: SortState = { column: "make__Make", direction: "desc" };
    expect(cycleSort(current, "mileage__Mileage")).toEqual({
      column: "mileage__Mileage",
      direction: "asc",
    });
  });
});

describe("compareValues", () => {
  // GEN-92 UAT 4: the headline bug a string sort would cause.
  it("orders numbers numerically, not lexically", () => {
    expect(compareValues(9000, 10000, "asc")).toBeLessThan(0);
    expect(compareValues(10000, 9000, "asc")).toBeGreaterThan(0);
  });

  it("reverses for descending", () => {
    expect(compareValues(9000, 10000, "desc")).toBeGreaterThan(0);
  });

  it("orders text alphabetically, case-insensitively", () => {
    expect(compareValues("audi", "BMW", "asc")).toBeLessThan(0);
    expect(compareValues("Audi", "audi", "asc")).toBe(0);
  });

  it("orders embedded numbers naturally", () => {
    expect(compareValues("Mk2", "Mk10", "asc")).toBeLessThan(0);
  });

  // GEN-92 UAT 6: blanks group at one end regardless of direction.
  it("puts blanks last when ascending", () => {
    expect(compareValues(null, 5, "asc")).toBeGreaterThan(0);
    expect(compareValues(5, null, "asc")).toBeLessThan(0);
  });

  it("still puts blanks last when descending", () => {
    expect(compareValues(null, 5, "desc")).toBeGreaterThan(0);
    expect(compareValues(5, null, "desc")).toBeLessThan(0);
  });

  it("treats two blanks as equal", () => {
    expect(compareValues(null, "", "asc")).toBe(0);
  });
});

describe("sortRows", () => {
  const rows = [
    { name: "c", n: 10000 },
    { name: "a", n: 9000 },
    { name: "b", n: null as number | null },
  ];

  it("sorts numerically ascending with blanks last", () => {
    const sorted = sortRows(rows, (r) => r.n, "asc");
    expect(sorted.map((r) => r.name)).toEqual(["a", "c", "b"]);
  });

  it("sorts numerically descending with blanks still last", () => {
    const sorted = sortRows(rows, (r) => r.n, "desc");
    expect(sorted.map((r) => r.name)).toEqual(["c", "a", "b"]);
  });

  it("is stable for equal keys", () => {
    const equal = [
      { id: 1, group: "x" },
      { id: 2, group: "x" },
      { id: 3, group: "x" },
    ];
    const sorted = sortRows(equal, (r) => r.group, "asc");
    expect(sorted.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("does not mutate the input array", () => {
    const original = [...rows];
    sortRows(rows, (r) => r.n, "asc");
    expect(rows).toEqual(original);
  });

  it("handles an empty list", () => {
    expect(sortRows([], () => null, "asc")).toEqual([]);
  });
});

describe("toSortableNumber", () => {
  it("passes numbers through", () => {
    expect(toSortableNumber(42)).toBe(42);
  });

  it("strips currency formatting", () => {
    expect(toSortableNumber("£12,500.00")).toBe(12500);
  });

  it("maps empty and unparseable values to null", () => {
    expect(toSortableNumber("")).toBeNull();
    expect(toSortableNumber(null)).toBeNull();
    expect(toSortableNumber("n/a")).toBeNull();
  });
});

describe("toSortableDate", () => {
  // GEN-92 UAT 5: chronological, not string order.
  it("orders dates chronologically", () => {
    const jan = toSortableDate("2027-01-05");
    const feb = toSortableDate("2026-02-01");
    expect(feb).toBeLessThan(jan!);
  });

  it("maps empty and invalid values to null", () => {
    expect(toSortableDate("")).toBeNull();
    expect(toSortableDate("not-a-date")).toBeNull();
  });
});

describe("toSortableText", () => {
  it("trims and preserves text", () => {
    expect(toSortableText("  Audi ")).toBe("Audi");
  });

  it("maps blank to null so it groups with the empties", () => {
    expect(toSortableText("   ")).toBeNull();
    expect(toSortableText(null)).toBeNull();
  });

  it("renders booleans comparably", () => {
    expect(toSortableText(true)).toBe("yes");
    expect(toSortableText(false)).toBe("no");
  });
});
