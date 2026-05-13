"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCustomerSearch } from "@/hooks/use-customer-search";
import type { Customer } from "@/lib/types";
import { CustomerResultRow } from "./customer-result-row";
import { CreateNewCustomerRow } from "./create-new-customer-row";

interface CustomerSearchStepProps {
  /** Last-selected customer id ("new" = create-new sentinel). */
  selectedId: string | null;
  onSelect: (
    /** null = the user picked "Create new". */
    customer: Customer | null,
    /** "new" when create-new, the customer id otherwise. */
    selectedId: string,
  ) => void;
  /** Called when the user picks something and clicks Continue. */
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * Step 1 of the Add Enquiry modal — dedup search.
 *
 * Autofocuses the input on mount. As the user types, results render with
 * a 300ms debounce. The "Create new customer" row stays pinned at the
 * bottom so it's always reachable.
 *
 * The list shows three states:
 *   - `query.length < 2`: instructional helper + just the Create-new row
 *   - loading: spinner + last results (no flicker)
 *   - results / no results: rows + Create-new
 */
export function CustomerSearchStep({
  selectedId,
  onSelect,
  onContinue,
  onCancel,
}: CustomerSearchStepProps) {
  const [query, setQuery] = useState("");
  const { results, isLoading } = useCustomerSearch(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    // Autofocus on mount; tiny delay so the dialog has rendered.
    const handle = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(handle);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, email, or postcode…"
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        {trimmed.length < 2 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            Type at least 2 characters to search.<br />
            Tip: try a name, mobile prefix like <code>07712</code>, or a postcode.
          </p>
        ) : results.length === 0 && !isLoading ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
            No matches for &ldquo;{trimmed}&rdquo;. Continue with a new customer below.
          </p>
        ) : (
          results.map((r) => (
            <CustomerResultRow
              key={r.customer.id}
              result={r}
              selected={selectedId === r.customer.id}
              onSelect={() => onSelect(r.customer, r.customer.id)}
              query={query}
            />
          ))
        )}

        <CreateNewCustomerRow
          selected={selectedId === "new"}
          onSelect={() => onSelect(null, "new")}
          query={query}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={selectedId === null}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
