"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateNewCustomerRowProps {
  selected: boolean;
  onSelect: () => void;
  query: string;
}

/**
 * The always-pinned "create new customer" row that lives at the bottom of
 * the search results. Picking it sets `selectedCustomer = null` upstream,
 * which means the form layer will run the new-customer path on submit.
 */
export function CreateNewCustomerRow({
  selected,
  onSelect,
  query,
}: CreateNewCustomerRowProps) {
  const trimmed = query.trim();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md border border-dashed p-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-border",
        )}
      >
        {selected && (
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        )}
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <Plus className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">Create new customer</span>
        <p className="truncate text-xs text-muted-foreground">
          {trimmed
            ? `No good match for "${trimmed}", capture a fresh record.`
            : "Capture a brand-new customer record."}
        </p>
      </div>
    </button>
  );
}
