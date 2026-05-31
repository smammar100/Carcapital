"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
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

/**
 * Equipment picker for the Advert tool — selected chips (removable) above a
 * searchable, category-colour-coded catalogue. Mirrors the AutoTrader "This
 * car comes with…" picker. Clicking an available feature adds it; the × on a
 * selected chip removes it.
 */
export function FeaturePicker({ selected, onChange }: FeaturePickerProps) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(
    () => new Set(selected.map((s) => s.toLowerCase())),
    [selected],
  );

  const add = (name: string) => {
    if (selectedSet.has(name.toLowerCase())) return;
    onChange([...selected, name]);
  };
  const remove = (name: string) =>
    onChange(selected.filter((s) => s.toLowerCase() !== name.toLowerCase()));

  const q = query.trim().toLowerCase();
  const availableByCategory = useMemo(() => {
    const map = new Map<FeatureCategory, string[]>();
    for (const cat of FEATURE_CATEGORIES) map.set(cat, []);
    for (const f of VEHICLE_FEATURES) {
      if (selectedSet.has(f.name.toLowerCase())) continue;
      if (q && !f.name.toLowerCase().includes(q)) continue;
      map.get(f.category)!.push(f.name);
    }
    return map;
  }, [q, selectedSet]);

  const noResults =
    !!q &&
    FEATURE_CATEGORIES.every(
      (cat) => (availableByCategory.get(cat) ?? []).length === 0,
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Selected */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Selected ({selected.length})
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
        {selected.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            No features selected — add from the catalogue below.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
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
                    onClick={() => remove(name)}
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

      {/* Search + category key */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search features…"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {FEATURE_CATEGORIES.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  FEATURE_CATEGORY_TONE[cat].dot,
                )}
              />
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Available catalogue, grouped */}
      <div className="flex flex-col gap-3">
        {FEATURE_CATEGORIES.map((cat) => {
          const items = availableByCategory.get(cat) ?? [];
          if (items.length === 0) return null;
          const tone = FEATURE_CATEGORY_TONE[cat];
          return (
            <div key={cat}>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                {cat}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => add(name)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs transition hover:bg-muted/60",
                      tone.chip,
                    )}
                  >
                    <Plus className="h-3 w-3 opacity-60" />
                    {name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {noResults && (
          <div className="text-xs text-muted-foreground">
            No features match “{query}”.
          </div>
        )}
      </div>
    </div>
  );
}
