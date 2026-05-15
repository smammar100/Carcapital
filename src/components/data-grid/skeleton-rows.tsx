import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ColumnDef } from "./types";

/**
 * Loading placeholder for a DataGridTable. Renders N skeleton rows that
 * match the visible column structure — so the table doesn't shift its
 * layout when real data arrives.
 *
 * Use in place of the previous full-page `<Skeleton className="h-72" />`
 * pattern. The shape echoes the actual `<tr>` / `<td>` markup the table
 * will emit, so the column widths and alignments are already locked in
 * before the network round-trip completes.
 *
 * Why per-row skeletons matter for this app:
 * - The Master Sheet has ~30 columns and 25 rows per page; a single
 *   block skeleton makes the page look like the column count is unknown.
 * - Vehicles and Leads pages show currency / dates in right-aligned
 *   columns — a block placeholder doesn't communicate that alignment.
 * - DVLA / Supabase cold calls take 800-1500ms in production; users
 *   stare at the placeholder long enough to notice the mismatch.
 *
 * The skeleton is purely presentational. The consumer wraps it in
 * `<tbody>` (same place as their real rows).
 */
export function DataGridSkeletonRows<T>({
  columns,
  rows = 8,
}: {
  /** Same column defs the real table renders with. Used to space the cells. */
  columns: ColumnDef<T>[];
  /** Number of skeleton rows to render. Default 8 — enough to fill a viewport. */
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b">
          {columns.map((col) => (
            <td
              key={String(col.key)}
              className="px-3 py-2"
              style={col.width ? { width: col.width } : undefined}
            >
              <Skeleton
                className="h-4"
                style={{
                  // Vary the width slightly so the skeleton doesn't look
                  // mechanical. Right-aligned cells (numbers) tend to be
                  // shorter than left-aligned text cells.
                  width:
                    col.align === "right"
                      ? `${40 + ((rowIndex * 7) % 30)}%`
                      : `${60 + ((rowIndex * 11) % 30)}%`,
                  marginLeft: col.align === "right" ? "auto" : undefined,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
