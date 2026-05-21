"use client";

import * as React from "react";
import { Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Row-density control for the data grid (Airtable-style Short/Medium/Tall).
 *
 * `DataGridTable` reads the chosen density and sets the `--dg-row-h` CSS
 * variable on the `<table>`; rows render at `var(--dg-row-h)`. Density is
 * therefore a single prop threaded into the table — no per-row plumbing.
 */
export type Density = "compact" | "normal" | "comfortable";

/** Pixel row heights per density. `normal` matches the legacy h-13 (52px). */
export const DENSITY_ROW_HEIGHT: Record<Density, string> = {
  compact: "36px",
  normal: "52px",
  comfortable: "68px",
};

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "comfortable", label: "Comfortable" },
];

/** Density state hook — pairs with `<DataGridDensityToggle>` + `DataGridTable`. */
export function useDensity(initial: Density = "normal") {
  const [density, setDensity] = React.useState<Density>(initial);
  return { density, setDensity };
}

export function DataGridDensityToggle({
  density,
  onChange,
}: {
  density: Density;
  onChange: (next: Density) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          title="Row density"
          aria-label="Row density"
        >
          <Rows3 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {DENSITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex w-full items-center rounded px-2 py-1.5 text-sm hover:bg-muted",
              density === opt.value && "font-medium text-foreground",
              density !== opt.value && "text-muted-foreground",
            )}
          >
            {opt.label}
            {density === opt.value ? (
              <span className="ml-auto text-xs text-primary">●</span>
            ) : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
