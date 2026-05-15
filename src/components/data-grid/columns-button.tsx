"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ColumnDef } from "./types";

/**
 * Column-visibility toggle, extracted from the Master Sheet so every
 * list page can let users hide columns they don't care about.
 *
 * Consumer manages a `Set<string>` of hidden column keys. We don't
 * persist — that's a follow-up (saved views per user). For now the
 * toggle resets on page reload, which is fine for the day-to-day "show
 * me only the columns I'm working with right now" use case.
 *
 * Always-visible columns (e.g. the vehicle thumbnail column, the
 * checkbox column when bulk-select is on) can be marked via the
 * optional `lockedKeys` prop; they appear in the popover with a
 * disabled checkbox.
 */
export function DataGridColumnsButton<T>({
  columns,
  hiddenKeys,
  onChange,
  lockedKeys,
}: {
  columns: ColumnDef<T>[];
  hiddenKeys: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Column keys the user shouldn't be able to hide (e.g. row identifier). */
  lockedKeys?: Set<string>;
}) {
  const toggle = (key: string) => {
    const next = new Set(hiddenKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const visibleCount = columns.length - hiddenKeys.size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Columns
          <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
            {visibleCount}/{columns.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
          Show columns
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="flex flex-col gap-1 p-2">
            {columns.map((col) => {
              const keyStr = String(col.key);
              const isHidden = hiddenKeys.has(keyStr);
              const isLocked = lockedKeys?.has(keyStr) ?? false;
              return (
                <label
                  key={keyStr}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={!isHidden}
                    onCheckedChange={() => !isLocked && toggle(keyStr)}
                    disabled={isLocked}
                  />
                  <Label className="flex-1 cursor-pointer font-normal">
                    {col.label}
                  </Label>
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
