"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterChipsProps<T extends string> {
  options: FilterOption<T>[];
  activeValue: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Small toggle row used above warranty/claim tables. Built on the existing
 * shadcn Button primitive so the active/idle styling matches the rest of
 * the app's filter UI.
 */
export function FilterChips<T extends string>({
  options,
  activeValue,
  onChange,
  className,
}: FilterChipsProps<T>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((opt) => {
        const active = opt.value === activeValue;
        return (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            onClick={() => onChange(opt.value)}
            className="h-8 gap-1.5"
          >
            <span>{opt.label}</span>
            {typeof opt.count === "number" && (
              <span
                className={cn(
                  "text-xs",
                  active ? "opacity-80" : "text-muted-foreground",
                )}
              >
                {opt.count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
