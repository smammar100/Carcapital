"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One action available in the bulk-action toolbar. Consumers declare an
 * array of these per page (`BulkAction<Vehicle>[]`, `BulkAction<Lead>[]`
 * etc.) and the toolbar renders them as buttons.
 *
 * `run` receives the selected row IDs (string keys consumers chose,
 * usually entity.id). The consumer is responsible for showing a confirm
 * dialog if the action is destructive — bulk delete should always
 * confirm, bulk export usually shouldn't.
 */
export interface BulkAction {
  /** Unique key for the action (used for React keys + analytics). */
  key: string;
  /** Display label on the button. */
  label: string;
  /** Optional icon component (lucide-react etc.). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Style hint — "destructive" colours the button red. */
  variant?: "default" | "outline" | "destructive";
  /** Called with the array of selected row IDs. */
  run: (selectedIds: string[]) => void | Promise<void>;
  /** Disable the action when true (e.g. >100 rows selected, action not supported). */
  disabled?: boolean;
}

/**
 * Bulk-action toolbar. Slides into view at the bottom of the page when
 * any row is selected; collapses when the selection clears.
 *
 * Renders inline-flow, not fixed-positioned — the consumer drops it
 * inside the `DataGridShell` after the table so it sits with the page's
 * content flow rather than hovering over it. Aligns with the LeafyGreen
 * grid frame so it doesn't bleed past 1400px content cap.
 */
export function DataGridBulkBar({
  selectedCount,
  selectedIds,
  actions,
  onClear,
  className,
}: {
  selectedCount: number;
  selectedIds: string[];
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${selectedCount} rows selected`}
      className={cn(
        "sticky bottom-4 z-10 mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-2.5 shadow-lg",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium tabular-nums">
          {selectedCount} {selectedCount === 1 ? "row" : "rows"} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={onClear}
        >
          <X className="mr-1 h-3 w-3" />
          Clear
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.key}
              variant={action.variant ?? "outline"}
              size="sm"
              disabled={action.disabled}
              onClick={() => void action.run(selectedIds)}
            >
              {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
