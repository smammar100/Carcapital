"use client";

import type { ReactNode } from "react";
import { useStickyShadow } from "@/hooks/use-sticky-shadow";
import { cn } from "@/lib/utils";

interface StickyTableLayoutProps {
  /** Filter row / toolbar — pinned to the top of the table area. */
  filterRow?: ReactNode;
  /** Pagination bar — pinned to the bottom of the table area. */
  pagination?: ReactNode;
  /** Table body (anything that scrolls between top and bottom). */
  children: ReactNode;
  /** Override the wrapper class (default `flex flex-col gap-3`). */
  className?: string;
}

/**
 * Spec v3.0 · Module E.3 — wrap a wide table so its filter row stays
 * pinned to the top and its pagination stays pinned to the bottom while
 * the user scrolls horizontally / vertically through 60+ columns.
 *
 * Adds a subtle shadow to the filter row once content has scrolled under
 * it (via `useStickyShadow`).
 *
 * Z-index discipline: filter = 20, pagination = 20, toasts above (50),
 * modals above (100).
 */
export function StickyTableLayout({
  filterRow,
  pagination,
  children,
  className,
}: StickyTableLayoutProps) {
  const { ref, isStuck } = useStickyShadow<HTMLDivElement>();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {filterRow ? (
        <div
          ref={ref}
          className={cn(
            "sticky top-0 z-20 bg-background transition-shadow",
            isStuck && "shadow-[0_2px_4px_-1px_rgba(0,0,0,0.08)]",
          )}
          data-sticky="filter"
        >
          {filterRow}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
      {pagination ? (
        <div
          className="sticky bottom-0 z-20 bg-background"
          data-sticky="pagination"
        >
          {pagination}
        </div>
      ) : null}
    </div>
  );
}
