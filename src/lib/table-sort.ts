/**
 * Type-aware sorting for the vehicle data grid (GEN-92).
 *
 * Car Capital's reference point is Excel: click a header, the list reorders.
 * The subtlety is that the grid holds money, mileage, dates and free text in
 * the same table, so a single string comparator would sort 9,000 above 10,000
 * and order dates by their rendered day-first text. Each column type therefore
 * gets its own extraction rule before a shared comparator runs.
 *
 * Kept framework-free so the ordering rules can be unit-tested directly.
 */

export type SortDirection = "asc" | "desc";

export interface SortState {
  /** Column identity (`colKey`), not the data key — two columns can share a key. */
  column: string;
  direction: SortDirection;
}

/**
 * Header click cycles asc → desc → unsorted, then back to asc on the next
 * click. Clicking a different column always starts that column at asc.
 */
export function cycleSort(
  current: SortState | null,
  column: string,
): SortState | null {
  if (!current || current.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return null;
}

/**
 * Compares two extracted values.
 *
 * Empty values always sort last, in both directions — a blank is "no
 * information", not a value smaller than everything else, and flipping the
 * direction should not march the blanks to the top (GEN-92 UAT 6).
 */
export function compareValues(
  a: string | number | null,
  b: string | number | null,
  direction: SortDirection,
): number {
  const aEmpty = a === null || a === "";
  const bEmpty = b === null || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let result: number;
  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else {
    // Locale-aware and case-insensitive so "audi" and "Audi" sit together,
    // and numeric-aware so "Mk2" precedes "Mk10".
    result = String(a).localeCompare(String(b), "en-GB", {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? result : -result;
}

/**
 * Stable sort — rows comparing equal keep their original relative order, so
 * sorting by a low-cardinality column (Status, Fuel) does not shuffle rows
 * arbitrarily on every click.
 */
export function sortRows<T>(
  rows: T[],
  extract: (row: T) => string | number | null,
  direction: SortDirection,
): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      const cmp = compareValues(extract(x.row), extract(y.row), direction);
      return cmp !== 0 ? cmp : x.index - y.index;
    })
    .map((entry) => entry.row);
}

/** Numeric text → number. Tolerates currency symbols and separators. */
export function toSortableNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).replace(/[£,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Date-ish value → epoch milliseconds, so ordering is chronological. */
export function toSortableDate(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const t = new Date(String(raw)).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Anything → a comparable string, or null when empty. */
export function toSortableText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw ? "yes" : "no";
  const s = String(raw).trim();
  return s === "" ? null : s;
}
