import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ColType =
  | "vehicle"
  | "user"
  | "text"
  | "phone"
  | "number"
  | "currency"
  | "date"
  | "dateRange"
  | "boolean"
  | "select"
  | "channels"
  | "vehicleStatus"
  | "salesStage"
  | "leadStatus"
  | "appointmentStatus"
  | "appointmentOutcome"
  | "warrantyStatus"
  | "invoiceStatus"
  | "returnStatus"
  | "returnResolution"
  | "atIndicator"
  | "custom";

export interface ColumnDef<T> {
  /** Unique key — used for React keys and as the default `get` field. */
  key: string;
  label: string;
  type: ColType;
  /** Pixel width. Omit for organic sizing (use with shell `fluid` mode). */
  width?: number;
  /** Cell text alignment. Defaults to "right" for number/currency, else "left". */
  align?: "left" | "right" | "center";
  /** When true, the column sticks to the left edge during horizontal scroll. */
  sticky?: boolean;
  /** Override the type-derived header icon. */
  headerIcon?: LucideIcon;
  /** Pull a value from the row. Defaults to `row[key]`. */
  get?: (row: T) => unknown;
  /** Render a custom cell. Wins over the type-driven renderer. */
  render?: (row: T, index: number) => ReactNode;
  /** Convert the value to a CSV string. Defaults to `String(get(row) ?? "")`. */
  csv?: (row: T) => string;
  /**
   * When true, the column header is a clickable sort control. The consumer
   * owns the actual sort state + comparison (via DataGridHeaderRow's
   * `sortKey` / `sortDir` / `onSort`); `sortKey` overrides `key` as the
   * identifier passed to `onSort` when the two differ.
   */
  sortable?: boolean;
  /** Sort identifier passed to `onSort`. Defaults to `key`. */
  sortKey?: string;
}

export interface SelectionState {
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  /** When true, the header checkbox is checked (all visible rows selected). */
  allSelected: boolean;
}
