"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials, cn } from "@/lib/utils";
import type { CustomerSearchResult } from "@/lib/services/customer-service";

interface CustomerResultRowProps {
  result: CustomerSearchResult;
  selected: boolean;
  onSelect: () => void;
  /** What the user typed — used to highlight matched substrings. */
  query: string;
}

const MATCH_BADGE_STYLES: Record<string, string> = {
  phone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  email: "border-sky-200 bg-sky-50 text-sky-700",
  postcode: "border-violet-200 bg-violet-50 text-violet-700",
  name: "border-amber-200 bg-amber-50 text-amber-800",
};

const MATCH_LABELS: Record<string, string> = {
  phone: "Phone match",
  email: "Email match",
  postcode: "Postcode match",
  name: "Name match",
};

/**
 * One row in the search results list. Picking it acts like a radio —
 * parent tracks the selected customer id and re-renders all rows.
 */
export function CustomerResultRow({
  result,
  selected,
  onSelect,
  query,
}: CustomerResultRowProps) {
  const { customer, matchType } = result;
  const fullName = `${customer.firstName} ${customer.lastName}`;
  const company = customer.companyName;
  const contactBits = [
    customer.mobilePhone,
    customer.email,
    customer.postcode,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
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
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="text-xs">
          {getInitials(fullName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            <Highlight text={fullName} query={query} />
          </span>
          {company && (
            <span className="truncate text-xs text-muted-foreground">
              · <Highlight text={company} query={query} />
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          <Highlight text={contactBits || "—"} query={query} />
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn("shrink-0 text-[10px]", MATCH_BADGE_STYLES[matchType])}
      >
        {MATCH_LABELS[matchType] ?? matchType}
      </Badge>
    </button>
  );
}

/** Wraps each query-substring occurrence in <mark>. Falls back to plain text. */
function Highlight({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = trimmed.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-amber-200/80 px-0.5 text-foreground">
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </>
  );
}
