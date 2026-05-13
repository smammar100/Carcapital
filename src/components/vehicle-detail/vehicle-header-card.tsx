"use client";

import Link from "next/link";
import {
  Calendar,
  ClipboardCheck,
  Download,
  EyeOff,
  Loader2,
  Megaphone,
} from "lucide-react";
import type { Vehicle, VehicleStatus } from "@/lib/types";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { RegPlate } from "@/components/shared/reg-plate";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VEHICLE_STATUSES } from "@/lib/constants";
import { Pill } from "./primitives";
import { formatDate } from "@/lib/utils";

interface VehicleHeaderCardProps {
  vehicle: Vehicle;
  exporting: boolean;
  onOpenInspection: () => void;
  onStatusChange: (status: VehicleStatus) => void;
  onRemoveFromWebsite: () => void;
  onExportPdf: () => void;
}

/**
 * The vehicle hero card at the top of `/vehicles/[id]`. Matches the v5
 * demo's three-column layout: photo · meta · actions, with the status
 * dropdown wrapped behind the status pill so the dealership can change
 * status without leaving the page.
 *
 * Days-in-stock tone:
 *   < 60  → neutral
 *   60-90 → warn
 *   90+   → bad
 */
export function VehicleHeaderCard({
  vehicle,
  exporting,
  onOpenInspection,
  onStatusChange,
  onRemoveFromWebsite,
  onExportPdf,
}: VehicleHeaderCardProps) {
  const statusMeta = VEHICLE_STATUSES.find((s) => s.value === vehicle.status);
  const statusTone = statusToneFor(vehicle.status);
  const daysTone =
    vehicle.daysInStock >= 90
      ? "bad"
      : vehicle.daysInStock >= 60
        ? "warn"
        : "neutral";

  return (
    <div className="mb-3.5 grid grid-cols-1 items-center gap-5 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[132px_1fr_auto]">
      <VehicleImage
        vehicle={vehicle}
        variant="card"
        className="h-[92px] w-[132px] shrink-0 rounded-lg"
      />

      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-3">
          <RegPlate registration={vehicle.registration} size="lg" />
          <h2 className="truncate text-[19px] font-semibold tracking-tight">
            {vehicle.year} {vehicle.make} {vehicle.model.toUpperCase()}
          </h2>
        </div>
        <p className="mb-2.5 text-[13px] leading-snug text-muted-foreground">
          {vehicle.variantCode ?? "—"} · {vehicle.stockId}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Change status"
              >
                <Pill tone={statusTone}>{statusMeta?.label ?? vehicle.status}</Pill>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Change status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {VEHICLE_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  onSelect={() => onStatusChange(s.value)}
                >
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Pill tone={daysTone}>{vehicle.daysInStock}d</Pill>
          <span className="text-[12px] text-muted-foreground">
            Received {formatDate(vehicle.receivedDate)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onOpenInspection}>
          <ClipboardCheck className="mr-1.5 h-4 w-4" />
          Open Inspection
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/advert/work-list">
            <Megaphone className="mr-1.5 h-4 w-4" />
            Listing
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/sales/appointments">
            <Calendar className="mr-1.5 h-4 w-4" />
            Book Appt.
          </Link>
        </Button>
        {vehicle.status === "sold" && vehicle.removedFromWebsiteAt === null && (
          <Button size="sm" variant="outline" onClick={onRemoveFromWebsite}>
            <EyeOff className="mr-1.5 h-4 w-4" />
            Remove from Website
          </Button>
        )}
        <Button size="sm" disabled={exporting} onClick={onExportPdf}>
          {exporting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4 text-[#F5C518]" />
          )}
          Job Card PDF
        </Button>
      </div>
    </div>
  );
}

/** Map VehicleStatus to the v5 pill tone palette. */
function statusToneFor(status: VehicleStatus): React.ComponentProps<typeof Pill>["tone"] {
  switch (status) {
    case "listed":
      return "purple";
    case "ready":
      return "good";
    case "sold":
      return "info";
    case "received":
    case "inspection_pending":
      return "neutral";
    case "being_prepared":
    case "photos_pending":
      return "warn";
    default:
      return "neutral";
  }
}
