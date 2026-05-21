"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef, SelectionState } from "./types";

// ────────────────────────────────────────────────────────────────────────────
// Row grouping
// ────────────────────────────────────────────────────────────────────────────

export interface RowGroup<T> {
  key: string;
  label: string;
  rows: T[];
}

/**
 * Group rows by a key for collapsible sections (ClickUp-style).
 *
 *   const { groups, isCollapsed, toggle } = useRowGroups(
 *     rows, (r) => r.status, (k) => STATUS_LABEL[k]);
 *
 * Render each group as `<DataGridGroupHeaderRow>` followed by its
 * `<DataGridRow>`s (skipped when `isCollapsed(group.key)`).
 */
export function useRowGroups<T>(
  rows: T[] | undefined,
  groupBy: (row: T) => string,
  labelFor?: (key: string) => string,
) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(
    () => new Set(),
  );

  const groups = React.useMemo<RowGroup<T>[] | undefined>(() => {
    if (!rows) return undefined;
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const k = groupBy(row);
      const bucket = map.get(k);
      if (bucket) bucket.push(row);
      else map.set(k, [row]);
    }
    return [...map.entries()].map(([key, groupRows]) => ({
      key,
      label: labelFor ? labelFor(key) : key,
      rows: groupRows,
    }));
  }, [rows, groupBy, labelFor]);

  const toggle = React.useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isCollapsed = React.useCallback(
    (key: string) => collapsed.has(key),
    [collapsed],
  );

  return { groups, isCollapsed, toggle };
}

/** Collapsible group banner row spanning the whole table width. */
export function DataGridGroupHeaderRow({
  label,
  count,
  collapsed,
  onToggle,
  span,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  /** Total column count incl. the selection + trailing columns. */
  span: number;
}) {
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <tr>
      <td
        colSpan={span}
        className="sticky left-0 border-b bg-muted/70 px-2"
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 w-full items-center gap-1.5 text-left text-xs font-semibold"
        >
          <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="uppercase tracking-wide">{label}</span>
          <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        </button>
      </td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Aggregate footer row
// ────────────────────────────────────────────────────────────────────────────

/**
 * A pinned-to-bottom totals row (Airtable / Attio "Sum" footer). The
 * consumer supplies `total(col)` — return a node for columns that
 * aggregate, `null`/`undefined` for the rest.
 */
export function DataGridTotalsRow<T>({
  cols,
  total,
  selection,
  trailing,
}: {
  cols: ColumnDef<T>[];
  total: (col: ColumnDef<T>, index: number) => React.ReactNode;
  selection?: SelectionState;
  trailing?: boolean;
}) {
  return (
    <tr className="sticky bottom-0 z-10">
      {selection ? (
        <td className="sticky left-0 z-10 border-t border-r bg-muted shadow-[2px_0_4px_-2px_var(--shadow-color)]" />
      ) : null}
      {cols.map((c, i) => {
        const align =
          c.align ??
          (c.type === "number" || c.type === "currency" ? "right" : "left");
        return (
          <td
            key={c.key}
            className={cn(
              "border-t border-r bg-muted px-3 text-[11px] font-semibold tabular-nums",
              c.sticky &&
                "sticky z-10 shadow-[2px_0_4px_-2px_var(--shadow-color)]",
            )}
            style={c.sticky ? { left: selection ? 40 : 0 } : undefined}
          >
            <div
              className={cn(
                "flex h-9 items-center",
                align === "right" && "justify-end",
                align === "center" && "justify-center",
              )}
            >
              {total(c, i)}
            </div>
          </td>
        );
      })}
      {trailing ? <td className="border-t bg-muted" /> : null}
    </tr>
  );
}
