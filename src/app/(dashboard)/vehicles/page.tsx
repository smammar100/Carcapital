"use client";

import { Plus } from "lucide-react";
import {
  VehicleSheet,
  type ColDef,
  type FilterField,
} from "@/components/vehicles/vehicle-sheet";
import { AddVehicleButton } from "@/components/vehicles/add-vehicle-button";
import { DaysInStockChip } from "@/components/shared/days-in-stock-chip";
import { PageHelper } from "@/components/layout/page-helper";
import { cn, formatCurrency } from "@/lib/utils";
import { variantLabel } from "@/lib/vehicle-variant";

// All Vehicles renders the same module as the Master Sheet (sticky
// row-counter + Stock ID, full gridlines, chip-bar filter, inline edit,
// quick-add) — only the column set differs. This is the curated "at a
// glance" view used for historical analysis and reporting; the Master
// Sheet exposes the full ~44-field grid.
// Profit basis: for a sold vehicle use the actual selling price when known;
// otherwise fall back to the advertised web (listing) price.
function profitPrice(v: {
  status: string;
  sellingPrice: number | null;
  listingPrice: number | null;
}): number | null {
  if (v.status === "sold" && v.sellingPrice !== null) return v.sellingPrice;
  return v.listingPrice;
}

const COLS: ColDef[] = [
  { key: "stockId", label: "Stock ID", type: "stockId", width: 100, sticky: true },
  { key: "registration", label: "Vehicle", type: "vehicle", width: 180 },
  {
    key: "make",
    label: "Make / Model",
    type: "text",
    width: 180,
    format: (v) => `${v.make} ${v.model}`,
    render: (v) => (
      <div className="flex flex-col leading-tight">
        <span className="truncate font-medium">
          {v.make} {v.model}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {v.year}
        </span>
      </div>
    ),
  },
  {
    // GEN-91: keyed to the NAME, not the opaque AutoTrader code. Using
    // `format` alone (not `render`) keeps the column inline-editable — a
    // custom renderer would silently make it read-only.
    key: "derivative",
    label: "Variant",
    type: "text",
    width: 220,
    format: (v) => variantLabel(v, ""),
    mobileHide: true,
  },
  { key: "fuelType", label: "Fuel", type: "select", width: 100, mobileHide: true },
  { key: "bodyType", label: "Body", type: "select", width: 110, mobileHide: true },
  { key: "mileage", label: "Mileage", type: "number", width: 100, mobileHide: true },
  {
    key: "daysInStock",
    label: "Days",
    type: "custom",
    width: 80,
    mobileHide: true,
    render: (v) => <DaysInStockChip days={v.daysInStock} />,
  },
  { key: "status", label: "Status", type: "status", width: 140 },
  { key: "baseCost", label: "Total cost", type: "currency", width: 110, mobileHide: true },
  { key: "listingPrice", label: "Web price", type: "currency", width: 110 },
  {
    key: "profit",
    label: "Profit",
    type: "currency",
    width: 110,
    format: (v) => {
      const price = profitPrice(v);
      return price !== null ? String(Math.round(price - v.baseCost)) : "";
    },
    render: (v) => {
      const price = profitPrice(v);
      const profit = price !== null ? price - v.baseCost : null;
      if (profit === null)
        return <span className="text-muted-foreground/40">—</span>;
      return (
        <span
          className={cn(
            "font-medium tabular-nums",
            profit > 0 && "text-emerald-600",
            profit < 0 && "text-rose-600",
          )}
        >
          {formatCurrency(profit)}
        </span>
      );
    },
  },
  { key: "motExpiry", label: "MOT", type: "date", width: 120, mobileHide: true },
];

const FILTER_FIELDS: FilterField[] = [
  { key: "make", label: "Make", kind: "text" },
  { key: "model", label: "Model", kind: "text" },
  { key: "variantCode", label: "Variant", kind: "text" },
  { key: "year", label: "Year", kind: "num" },
  { key: "colour", label: "Colour", kind: "text" },
  { key: "fuelType", label: "Fuel", kind: "text" },
  { key: "bodyType", label: "Body", kind: "text" },
  { key: "mileage", label: "Mileage", kind: "num" },
  { key: "status", label: "Status", kind: "text" },
  { key: "baseCost", label: "Total cost", kind: "num" },
  { key: "listingPrice", label: "Web price", kind: "num" },
  { key: "daysInStock", label: "Days in stock", kind: "num" },
];

export default function VehiclesPage() {
  return (
    <VehicleSheet
      title="All Vehicles"
      helper={
        <PageHelper>
          Every vehicle you have taken in, sold or unsold, in one wide grid.
          Open any car to manage it end to end.
        </PageHelper>
      }
      cols={COLS}
      filterFields={FILTER_FIELDS}
      csvName="vehicles"
      enableQuickAdd={false}
      hideExport
      summary={(count) => (count === null ? "Loading inventory…" : `${count} matching`)}
      headerActions={
        <AddVehicleButton size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Vehicle
        </AddVehicleButton>
      }
    />
  );
}
