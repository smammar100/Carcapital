"use client";

import type { ReactNode } from "react";
import { Car, FileText, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Pill } from "./primitives";

interface DetailsTabProps {
  vehicle: Vehicle;
}

type Row = { label: string; value: ReactNode };

/**
 * Details tab — the full vehicle spec sheet (Variation D). Four grouped
 * cards (Identity / Acquisition / Documentation / Registration & Compliance),
 * each a compact label-left / value-right list. Compliance statuses render as
 * tone-coded pills so MOT / Tax read at a glance.
 */
export function DetailsTab({ vehicle }: DetailsTabProps) {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const identity: Row[] = [
    { label: "Make / Model", value: `${vehicle.make} ${vehicle.model}` },
    {
      label: "Variant",
      value:
        vehicle.derivative ??
        vehicle.variantName ??
        vehicle.variantCode ??
        "—",
    },
    { label: "Year", value: vehicle.year },
    { label: "Colour", value: vehicle.colour || "—" },
    { label: "Mileage", value: `${vehicle.mileage.toLocaleString()} mi` },
    {
      label: "Engine",
      value: vehicle.engineSizeCC
        ? `${vehicle.engineSizeCC.toLocaleString()} cc`
        : "—",
    },
    { label: "Body", value: cap(vehicle.bodyType) },
    { label: "Fuel", value: cap(vehicle.fuelType) },
    { label: "Transmission", value: cap(vehicle.transmission) },
  ];

  const acquisition: Row[] = [
    { label: "Stock ID", value: vehicle.stockId },
    { label: "Received", value: formatDate(vehicle.receivedDate) },
    {
      label: "Seller",
      value:
        [vehicle.sellerName, vehicle.sellerPhone].filter(Boolean).join(" · ") ||
        "—",
    },
    {
      label: "Purchase Source",
      value: `${cap(vehicle.purchaseSource.replace("_", " "))}${
        vehicle.auctionHouse ? ` (${vehicle.auctionHouse})` : ""
      }`,
    },
    { label: "Service History", value: cap(vehicle.serviceHistory) },
  ];

  const docs: Row[] = [
    { label: "V5 Received", value: vehicle.v5Received ? "Yes" : "No" },
    { label: "Keys", value: vehicle.numKeys },
    { label: "Lock Nut", value: vehicle.lockNut ? "Present" : "Missing" },
    {
      label: "MOT Expiry",
      value: vehicle.motExpiry ? formatDate(vehicle.motExpiry) : "—",
    },
  ];

  const compliance: Row[] = [
    {
      label: "MOT Status",
      value: vehicle.motStatus ? (
        <Pill tone={vehicle.motStatus === "Valid" ? "good" : "bad"}>
          {vehicle.motStatus}
        </Pill>
      ) : (
        "—"
      ),
    },
    {
      label: "Tax Status",
      value: vehicle.taxStatus ? (
        <Pill tone={vehicle.taxStatus === "Taxed" ? "good" : "warn"}>
          {vehicle.taxStatus}
        </Pill>
      ) : (
        "—"
      ),
    },
    {
      label: "Tax Due",
      value: vehicle.taxDueDate ? formatDate(vehicle.taxDueDate) : "—",
    },
    {
      label: "CO₂ Emissions",
      value: vehicle.co2Emissions != null ? `${vehicle.co2Emissions} g/km` : "—",
    },
    { label: "Euro Status", value: vehicle.euroStatus ?? "—" },
    { label: "Wheelplan", value: vehicle.wheelplan ?? "—" },
    {
      label: "First Registered",
      value: vehicle.firstRegisteredDate
        ? formatDate(vehicle.firstRegisteredDate)
        : "—",
    },
    {
      label: "Last V5C Issued",
      value: vehicle.dateOfLastV5CIssued
        ? formatDate(vehicle.dateOfLastV5CIssued)
        : "—",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DetailCard title="Identity" icon={Car} rows={identity} />
      <DetailCard title="Acquisition" icon={Truck} rows={acquisition} />
      <DetailCard title="Documentation" icon={FileText} rows={docs} />
      <DetailCard
        title="Registration & Compliance"
        icon={ShieldCheck}
        rows={compliance}
      />
    </div>
  );
}

function DetailCard({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: LucideIcon;
  rows: Row[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className={cn("flex items-center justify-between gap-3")}
          >
            <span className="shrink-0 text-xs text-muted-foreground">
              {r.label}
            </span>
            <span className="text-right text-sm tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
