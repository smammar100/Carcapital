"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
  ComboboxPopup,
  ComboboxPrimitive,
} from "@/components/ui/combobox";
import { RegPlate } from "@/components/shared/reg-plate";
import { cn } from "@/lib/utils";

/**
 * Strip everything that isn't a letter or digit.
 *
 * A registration is written "NA66 XGM" on the car, "NA66XGM" in the database
 * and "na66 xgm" by someone in a hurry. Comparing on alphanumerics only means
 * all three find it.
 */
const squash = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Does this vehicle match what's been typed? */
export function vehicleMatches(v: Vehicle, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  // Reg and stock ID are identifiers — match them ignoring spacing entirely.
  const squashed = squash(q);
  if (squashed && squash(v.registration).includes(squashed)) return true;
  if (squashed && squash(v.stockId).includes(squashed)) return true;
  // Make/model/variant are prose — plain case-insensitive contains.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${v.make} ${v.model} ${v.variantName ?? ""}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/**
 * What the input shows once a vehicle is picked.
 *
 * Display only — matching is done by `vehicleMatches` via the `filter={null}`
 * below, so this no longer has to carry every searchable form of the reg. It
 * used to append the space-stripped plate ("L400 JCM L400JCM · …") to keep the
 * built-in matcher happy, which read as a typo in the selected field.
 */
function displayLabel(v: Vehicle): string {
  return `${v.registration} · ${v.make} ${v.model} (${v.stockId})`;
}

interface VehiclePickerProps {
  vehicles: Vehicle[];
  value: Vehicle | null;
  onChange: (vehicle: Vehicle | null) => void;
  placeholder?: string;
  /** Rendered above the list when nothing is selected (e.g. "None / free text"). */
  emptyOptionLabel?: string;
  id?: string;
  className?: string;
  /** Extra detail per row, e.g. an inspection-progress hint. */
  renderMeta?: (vehicle: Vehicle) => React.ReactNode;
}

/**
 * Search a vehicle by registration.
 *
 * Stock can run past a hundred cars, and a plain dropdown of that is a scroll
 * hunt for a plate you already know (GEN-79). Type the reg — with or without
 * its space — or the stock ID, make or model.
 */
export function VehiclePicker({
  vehicles,
  value,
  onChange,
  placeholder = "Search by reg, stock ID or model…",
  emptyOptionLabel,
  id,
  className,
  renderMeta,
}: VehiclePickerProps) {
  const [query, setQuery] = useState("");

  /**
   * Only what the user actually types is a search query.
   *
   * On selection the combobox writes the chosen vehicle's label back into the
   * input, which arrives here as another input-value change. Treating that as a
   * query would filter the list down to nothing — so the next time the popup
   * opened it would claim no vehicle matched. Anything that isn't typing
   * (selecting, clearing, blurring) resets to the unfiltered list.
   */
  const handleInputValueChange = (
    next: string,
    details: ComboboxPrimitive.Root.ChangeEventDetails,
  ): void => {
    setQuery(details.reason === "input-change" ? next : "");
  };

  // Filtered here rather than by the combobox's built-in matcher, which only
  // compares against the displayed label — so "NA66 XGM" wouldn't find
  // "NA66XGM", and the stock ID wouldn't match at all.
  const filtered = useMemo(
    () => vehicles.filter((v) => vehicleMatches(v, query)),
    [vehicles, query],
  );

  return (
    <Combobox
      items={filtered}
      value={value}
      onValueChange={onChange}
      onInputValueChange={handleInputValueChange}
      itemToStringLabel={displayLabel}
      // `vehicleMatches` above is the only matcher. The built-in one compares
      // against the displayed label, so it would re-filter out rows we mean to
      // show — a stock-ID or space-stripped reg hit that the label doesn't
      // spell out.
      filter={null}
      // Type a reg, press Enter. Without this the top match isn't highlighted
      // and Enter does nothing, which reads as a broken field.
      autoHighlight
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        startAddon={<Search />}
        showClear={value !== null}
        className={cn("w-full", className)}
      />
      {/*
       * The shared ComboboxPopup only sets a *min* width against the trigger,
       * so wide rows (reg + make/model + stock ID) push it past the input's
       * own width — and past the edge of whatever dialog it's opened inside
       * (GEN-85). Pin it to the trigger's exact width instead.
       */}
      <ComboboxPopup className="w-(--anchor-width) max-w-(--anchor-width)">
        <ComboboxEmpty>
          {emptyOptionLabel
            ? "No vehicle matches, leave blank to use free text."
            : "No vehicle matches that reg."}
        </ComboboxEmpty>
        <ComboboxList>
          {(v: Vehicle) => (
            // Not the shared ComboboxItem: it reserves a leading indicator
            // column on every row for a checkmark this list doesn't need,
            // which reads as an unexplained dead gutter (GEN-85). Selection
            // is marked with a trailing check instead, so unselected rows
            // stay flush with the search icon above them.
            <ComboboxPrimitive.Item
              key={v.id}
              value={v}
              className="relative grid min-h-8 cursor-default items-center rounded-sm py-1 ps-3 pe-7 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <RegPlate registration={v.registration} size="sm" />
                <span className="truncate">
                  {v.make} {v.model}
                </span>
                <span className="shrink-0 text-2xs text-muted-foreground">
                  {v.stockId}
                </span>
                {renderMeta?.(v)}
              </span>
              <ComboboxPrimitive.ItemIndicator className="absolute end-2 top-1/2 -translate-y-1/2">
                <Check className="size-4" />
              </ComboboxPrimitive.ItemIndicator>
            </ComboboxPrimitive.Item>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
