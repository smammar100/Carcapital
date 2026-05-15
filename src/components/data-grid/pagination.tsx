"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

/**
 * Pagination state hook for table pages. Reduces the boilerplate that
 * /vehicles, /admin/master-sheet, and (soon) every other list page
 * reimplements inline.
 *
 * Returns a stable interface:
 *   - `page` (1-indexed; clamps to `[1, totalPages]`)
 *   - `pageSize` (25 / 50 / 100)
 *   - `setPage`, `setPageSize`
 *   - `offset` (zero-indexed slice start)
 *   - `pagedRows` (the consumer's filtered rows, already sliced)
 *   - `totalPages` (derived)
 *
 * Resetting to page 1 on filter change is the consumer's job — pass the
 * filter dependencies to `useEffect`, call `setPage(1)`. We don't try to
 * be clever about it because filter shape differs per page.
 */
export function usePagination<T>(
  filteredRows: T[] | undefined,
  initialPageSize: number = DEFAULT_PAGE_SIZE,
) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const total = filteredRows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Clamp the rendered page without touching state — keeps the user's
  // intent intact (if a filter temporarily narrows the result set, the
  // page snaps back when the filter loosens) and avoids the React 19
  // "setState in effect" lint warning. Consumers should call `setPage(1)`
  // when their filter dependencies change.
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;

  const pagedRows = React.useMemo(
    () => filteredRows?.slice(offset, offset + pageSize) ?? [],
    [filteredRows, offset, pageSize],
  );

  return {
    page: safePage,
    pageSize,
    setPage,
    setPageSize,
    offset,
    pagedRows,
    totalPages,
    total,
  };
}

/**
 * Pagination controls. Shows row range ("Showing 26-50 of 114"), a rows-
 * per-page select, and prev/next buttons.
 *
 * Designed to sit at the bottom of a table card. Consumer passes the same
 * values the `usePagination` hook returns.
 */
export function DataGridPagination({
  page,
  pageSize,
  totalPages,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  onPageChange: (next: number) => void;
  onPageSizeChange?: (next: number) => void;
}) {
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="tabular-nums">
          {total === 0
            ? "No rows"
            : `Showing ${firstRow}-${lastRow} of ${total}`}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger size="sm" className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span className="px-3 tabular-nums text-muted-foreground">
          Page <span className="font-medium text-foreground">{page}</span> of{" "}
          <span className="font-medium text-foreground">{totalPages}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
