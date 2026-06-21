"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  VEHICLE_FEATURES,
  FEATURE_CATEGORIES,
  FEATURE_CATEGORY_TONE,
  categoryForFeature,
  type FeatureCategory,
} from "@/lib/vehicle-features";

interface FeaturePickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
}

/** Catalogue names grouped by category (static reference data). */
const CAT_ITEMS: Record<FeatureCategory, string[]> = FEATURE_CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat] = VEHICLE_FEATURES.filter((f) => f.category === cat).map(
      (f) => f.name,
    );
    return acc;
  },
  {} as Record<FeatureCategory, string[]>,
);

/**
 * Equipment picker for the Advert tool — one category at a time. A segmented
 * tab bar (with selected-count badges) switches between Comfort / Exterior /
 * Interior / Safety & Security / Other; each shows a searchable two-column
 * checklist with a Select-all-in-view shortcut. A running selected summary sits
 * below. Mirrors the AutoTrader "This car comes with…" taxonomy.
 */
export function FeaturePicker({ selected, onChange }: FeaturePickerProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<FeatureCategory>(FEATURE_CATEGORIES[0]);

  const selectedSet = useMemo(
    () => new Set(selected.map((s) => s.toLowerCase())),
    [selected],
  );
  const has = (name: string) => selectedSet.has(name.toLowerCase());

  const toggle = (name: string) =>
    has(name)
      ? onChange(selected.filter((s) => s.toLowerCase() !== name.toLowerCase()))
      : onChange([...selected, name]);

  const addMany = (names: string[]) => {
    const missing = names.filter((n) => !has(n));
    if (missing.length) onChange([...selected, ...missing]);
  };
  const removeMany = (names: string[]) => {
    const drop = new Set(names.map((n) => n.toLowerCase()));
    onChange(selected.filter((s) => !drop.has(s.toLowerCase())));
  };

  const selectedInCat = (cat: FeatureCategory) =>
    CAT_ITEMS[cat].filter((n) => has(n)).length;

  const q = query.trim().toLowerCase();
  const items = useMemo(
    () => CAT_ITEMS[active].filter((n) => n.toLowerCase().includes(q)),
    [active, q],
  );
  const allInViewOn = items.length > 0 && items.every((n) => has(n));

  return (
    <div className="flex flex-col gap-3">
      {/* Header: count + clear all */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {selected.length} feature{selected.length === 1 ? "" : "s"} selected
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground transition hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Category tabs with selected-count badges */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
        {FEATURE_CATEGORIES.map((cat) => {
          const n = selectedInCat(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setActive(cat);
                setQuery("");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                active === cat
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  FEATURE_CATEGORY_TONE[cat].dot,
                )}
              />
              {cat}
              {n > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 text-2xs font-semibold text-primary">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search (scoped to active category) + select-all-in-view */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${active}…`}
            className="h-9 pl-8"
          />
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => (allInViewOn ? removeMany(items) : addMany(items))}
            className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
          >
            {allInViewOn ? "Clear all in view" : "Select all in view"}
          </button>
        )}
      </div>

      {/* Two-column checklist for the active category */}
      <div className="grid max-h-72 grid-cols-1 gap-x-4 gap-y-0.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {items.length === 0 ? (
          <div className="col-span-full px-2 py-6 text-center text-xs text-muted-foreground">
            No {active} features match “{query}”.
          </div>
        ) : (
          items.map((name) => {
            const on = has(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-muted/60",
                  on && "bg-muted/40",
                )}
              >
                <Checkbox on={on} />
                <span className="truncate">{name}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Running selected summary */}
      <div className="border-t border-border pt-3">
        <div className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          Selected ({selected.length})
        </div>
        {selected.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
            No features selected — pick from the categories above.
          </div>
        ) : (
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {selected.map((name) => {
              const tone = FEATURE_CATEGORY_TONE[categoryForFeature(name)];
              return (
                <span
                  key={name}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs",
                    tone.chip,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                  {name}
                  <button
                    type="button"
                    onClick={() => toggle(name)}
                    className="ml-0.5 rounded text-muted-foreground transition hover:text-foreground"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Checkbox({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "grid h-4 w-4 shrink-0 place-items-center rounded border transition",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40",
      )}
    >
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}
