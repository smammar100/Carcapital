"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Standardised search input for list pages. Replaces the five different
 * inline patterns currently in /vehicles, /admin/master-sheet,
 * /warranties/claims, /advert/work-list, and /admin/users-and-permissions.
 *
 * Controlled — the consumer owns `value` and `onChange` so they can wire
 * to URL params (`?q=…`), debouncing, or whatever filter pipeline the
 * page uses. We provide no state; we provide the input UI.
 */
export function DataGridSearchBar({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pr-8 pl-8"
      />
      {value && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/**
 * Search state hook. Owns the input value and an optional URL-sync so a
 * dealer who refreshes the page lands back on the same filtered view.
 *
 * The matcher is consumer-provided — different pages search different
 * fields (vehicles by reg + stockId, leads by name + phone, etc.) — so
 * the hook handles the plumbing and lets the page decide what counts as
 * a match.
 */
export function useTableSearch<T>(
  rows: T[] | undefined,
  matcher: (row: T, normalisedTerm: string) => boolean,
  options?: { syncQueryParam?: string },
) {
  const syncKey = options?.syncQueryParam;

  // Lazy initialiser reads the URL once on mount — avoids the
  // "setState inside useEffect" pattern that lints as a smell.
  const [value, setValue] = React.useState<string>(() => {
    if (!syncKey || typeof window === "undefined") return "";
    return new URL(window.location.href).searchParams.get(syncKey) ?? "";
  });

  // Writing back to the URL is a genuine external side-effect (history
  // API), so the useEffect is appropriate here.
  React.useEffect(() => {
    if (!syncKey || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(syncKey, value);
    } else {
      url.searchParams.delete(syncKey);
    }
    window.history.replaceState({}, "", url.toString());
  }, [value, syncKey]);

  const normalised = value.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!rows) return undefined;
    if (!normalised) return rows;
    return rows.filter((row) => matcher(row, normalised));
  }, [rows, normalised, matcher]);

  return { value, setValue, filtered };
}
