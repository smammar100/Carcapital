"use client";

import * as React from "react";

/** A column comparator: returns <0, 0, >0 like Array.prototype.sort. */
export type Comparator<T> = (a: T, b: T) => number;

export interface UseSortResult<T> {
  /** Rows sorted by the active column (undefined while `rows` is undefined). */
  sorted: T[] | undefined;
  /** The active sort column id, or null when unsorted. */
  sortKey: string | null;
  sortDir: "asc" | "desc";
  /** Pass to `<DataGridHeaderRow onSort>`. Toggles asc/desc, or switches column. */
  onSort: (key: string) => void;
}

/**
 * Sort state + comparison for the data grid. The grid header already
 * renders the sort affordance (`ColumnDef.sortable` + `onSort`); this hook
 * supplies the missing half — toggling asc/desc and applying the chosen
 * comparator — so a page wires sorting in three lines instead of
 * re-implementing it each time.
 *
 *   const { sorted, sortKey, sortDir, onSort } = useSort(rows, {
 *     name:  (a, b) => a.name.localeCompare(b.name),
 *     price: (a, b) => a.price - b.price,
 *   });
 *
 * The comparator map is keyed by each column's `sortKey ?? key`.
 */
export function useSort<T>(
  rows: T[] | undefined,
  comparators: Record<string, Comparator<T>>,
  initial?: { key: string; dir?: "asc" | "desc" },
): UseSortResult<T> {
  const [sortKey, setSortKey] = React.useState<string | null>(
    initial?.key ?? null,
  );
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">(
    initial?.dir ?? "asc",
  );

  const onSort = React.useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sorted = React.useMemo(() => {
    if (!rows) return undefined;
    if (!sortKey) return rows;
    const cmp = comparators[sortKey];
    if (!cmp) return rows;
    const out = [...rows].sort(cmp);
    if (sortDir === "desc") out.reverse();
    return out;
  }, [rows, sortKey, sortDir, comparators]);

  return { sorted, sortKey, sortDir, onSort };
}
