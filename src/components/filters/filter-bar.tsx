"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Shared, schema-driven filter bar (GEN-22). Used by Completed Deals, Invoices
 * (GEN-23) and Reports & Analytics (GEN-24). It owns no data — the consumer
 * declares which controls to show (search, a date range with quick presets,
 * and any number of select filters), holds the resulting `FilterState`, and
 * applies it to its own rows via `matchesFilterState`.
 *
 * Kept deliberately schema-driven so it keeps working unchanged when the
 * historical Master Sheet backfill lands: the select options are supplied by
 * the page (usually derived from the current data), never hard-coded here.
 */

export interface DateRange {
  from: string | null; // inclusive ISO date (yyyy-mm-dd) or null
  to: string | null; // inclusive ISO date (yyyy-mm-dd) or null
}

export interface FilterState {
  search: string;
  date: DateRange;
  /** selectKey → selected option value ("" means "all"). */
  selects: Record<string, string>;
}

export interface SelectFilter {
  key: string;
  label: string;
  /** Text for the "no filter" option — also acts as the field's resting
   *  placeholder (e.g. "All sources"), so no separate label is needed. */
  allLabel?: string;
  options: { value: string; label: string }[];
}

const EMPTY_FILTER_STATE: FilterState = {
  search: "",
  date: { from: null, to: null },
  selects: {},
};

/** Hook owning filter state, with a stable reset. */
export function useFilterState(
  initial: FilterState = EMPTY_FILTER_STATE,
): {
  state: FilterState;
  setState: React.Dispatch<React.SetStateAction<FilterState>>;
  reset: () => void;
} {
  const [state, setState] = React.useState<FilterState>(initial);
  const reset = React.useCallback(
    () => setState({ search: "", date: { from: null, to: null }, selects: {} }),
    [],
  );
  return { state, setState, reset };
}

/* --------------------------------------------------------------- presets */

type Preset = {
  value: string;
  label: string;
  range: (now: Date) => DateRange;
};

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/** Built-in presets + the most recent `yearCount` calendar years. */
function buildPresets(now: Date, yearCount: number): Preset[] {
  const y = now.getFullYear();
  const base: Preset[] = [
    { value: "all", label: "Any date", range: () => ({ from: null, to: null }) },
    {
      value: "this-month",
      label: "This month",
      range: (n) => ({
        from: iso(new Date(n.getFullYear(), n.getMonth(), 1)),
        to: iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)),
      }),
    },
    {
      value: "last-month",
      label: "Last month",
      range: (n) => ({
        from: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        to: iso(new Date(n.getFullYear(), n.getMonth(), 0)),
      }),
    },
    {
      value: "this-year",
      label: "This year",
      range: (n) => ({
        from: iso(new Date(n.getFullYear(), 0, 1)),
        to: iso(new Date(n.getFullYear(), 11, 31)),
      }),
    },
  ];
  const years: Preset[] = Array.from({ length: yearCount }, (_, i) => {
    const yr = y - 1 - i; // last year, the year before, …
    return {
      value: `year-${yr}`,
      label: String(yr),
      range: () => ({ from: `${yr}-01-01`, to: `${yr}-12-31` }),
    };
  });
  return [...base, ...years];
}

/* ------------------------------------------------------------- component */

const selectClass =
  "h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FilterBar({
  state,
  onChange,
  searchPlaceholder = "Search…",
  dateLabel,
  selects = [],
  yearPresetCount = 4,
  now,
  className,
}: {
  state: FilterState;
  onChange: (next: FilterState) => void;
  searchPlaceholder?: string;
  /** Show a date-range filter with this label (e.g. "Completed"). Omit to hide. */
  dateLabel?: string;
  selects?: SelectFilter[];
  yearPresetCount?: number;
  /** Injected "today" so callers stay deterministic/testable; defaults to now. */
  now?: Date;
  className?: string;
}): React.ReactElement {
  const today = now ?? new Date();
  // Cheap to rebuild each render; no memo needed (avoids an unstable date dep).
  const presets = buildPresets(today, yearPresetCount);

  // Custom range mode is UI-only state (not part of the filter data): the raw
  // From/To inputs stay hidden behind a "Custom range…" option so the bar reads
  // clearly, and only appear when the user actually wants a bespoke range.
  const [customDate, setCustomDate] = React.useState(false);
  const matchedPreset = presets.find(
    (p) =>
      p.range(today).from === state.date.from &&
      p.range(today).to === state.date.to,
  )?.value;
  const hasDate = state.date.from !== null || state.date.to !== null;
  const showCustom = customDate || (hasDate && !matchedPreset);
  const dateValue = showCustom ? "custom" : (matchedPreset ?? "all");

  function onPickPreset(value: string): void {
    if (value === "custom") {
      setCustomDate(true); // reveal inputs, keep whatever range is set
      return;
    }
    setCustomDate(false);
    const p = presets.find((x) => x.value === value);
    onChange({ ...state, date: p ? p.range(today) : { from: null, to: null } });
  }

  const hasActive =
    state.search.trim() !== "" ||
    state.date.from !== null ||
    state.date.to !== null ||
    Object.values(state.selects).some((v) => v !== "");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2",
        className,
      )}
    >
      {/* search — grows, but capped so the filters keep their space */}
      <div className="relative min-w-[180px] max-w-md flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={state.search}
          onChange={(e) => onChange({ ...state, search: e.target.value })}
          placeholder={searchPlaceholder}
          className="h-8 pl-7 text-xs"
          aria-label="Search"
        />
      </div>

      {/* date filter — every option is prefixed with what it filters (e.g.
          "Completed: This year"), so the control is self-explanatory in any
          state. The raw From/To inputs only appear for a custom range. */}
      {dateLabel && (
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label={`${dateLabel} date filter`}
            className={selectClass}
            value={dateValue}
            onChange={(e) => onPickPreset(e.target.value)}
          >
            {presets.map((p) => (
              <option key={p.value} value={p.value}>
                {dateLabel}: {p.label}
              </option>
            ))}
            <option value="custom">{dateLabel}: Custom range…</option>
          </select>
          {showCustom && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">from</span>
              <input
                type="date"
                aria-label={`${dateLabel} from`}
                value={state.date.from ?? ""}
                onChange={(e) =>
                  onChange({
                    ...state,
                    date: { ...state.date, from: e.target.value || null },
                  })
                }
                className={selectClass}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                aria-label={`${dateLabel} to`}
                value={state.date.to ?? ""}
                onChange={(e) =>
                  onChange({
                    ...state,
                    date: { ...state.date, to: e.target.value || null },
                  })
                }
                className={selectClass}
              />
            </div>
          )}
        </div>
      )}

      {/* select filters — the "all" option names the field, so no outer label */}
      {selects.map((f) => (
        <select
          key={f.key}
          aria-label={f.label}
          className={selectClass}
          value={state.selects[f.key] ?? ""}
          onChange={(e) =>
            onChange({
              ...state,
              selects: { ...state.selects, [f.key]: e.target.value },
            })
          }
        >
          <option value="">{f.allLabel ?? `All ${f.label.toLowerCase()}`}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {hasActive && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-8 gap-1 text-xs text-muted-foreground"
          onClick={() =>
            onChange({ search: "", date: { from: null, to: null }, selects: {} })
          }
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------- apply helpers */

/**
 * Test a row against a FilterState. The consumer supplies accessors so the bar
 * stays data-agnostic:
 *  - `searchText(row)` → the concatenated searchable string
 *  - `date(row)` → the row's ISO date for the range filter (or null)
 *  - `selectValue(row, key)` → the row's value for a given select filter
 */
export function matchesFilterState<T>(
  row: T,
  state: FilterState,
  accessors: {
    searchText?: (row: T) => string;
    date?: (row: T) => string | null;
    selectValue?: (row: T, key: string) => string | null;
  },
): boolean {
  const term = state.search.trim().toLowerCase();
  if (term && accessors.searchText) {
    if (!accessors.searchText(row).toLowerCase().includes(term)) return false;
  }
  if ((state.date.from || state.date.to) && accessors.date) {
    const d = accessors.date(row);
    if (!d) return false;
    const day = d.slice(0, 10);
    if (state.date.from && day < state.date.from) return false;
    if (state.date.to && day > state.date.to) return false;
  }
  if (accessors.selectValue) {
    for (const [key, want] of Object.entries(state.selects)) {
      if (!want) continue;
      if (accessors.selectValue(row, key) !== want) return false;
    }
  }
  return true;
}
