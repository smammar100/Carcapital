"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PillTab<Value extends string> {
  value: Value;
  label: ReactNode;
  /** Optional count rendered after the label as monospaced muted text. */
  count?: number | null;
}

interface PillTabsProps<Value extends string> {
  tabs: PillTab<Value>[];
  active: Value;
  onChange: (value: Value) => void;
  className?: string;
}

/**
 * Segmented control styled as pill tabs — the v5 demo replaces shadcn's
 * underlined tabs with this softer chip group. Uses radio semantics so
 * keyboard users still get arrow-key navigation; the click handler keeps
 * controlled state in the parent so the tab persists across re-renders.
 */
export function PillTabs<Value extends string>({
  tabs,
  active,
  onChange,
  className,
}: PillTabsProps<Value>) {
  return (
    <div
      role="tablist"
      className={cn(
        "mb-3.5 inline-flex gap-0.5 rounded-full border bg-muted/40 p-1",
        "max-w-full overflow-x-auto",
        className,
      )}
    >
      {tabs.map((t) => {
        const isActive = t.value === active;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.value)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1 font-mono text-[10.5px] text-muted-foreground">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
