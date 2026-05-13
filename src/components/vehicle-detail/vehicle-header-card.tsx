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
import { VehicleStatusBadge } from "@/components/shared/status-badge";
import { DaysInStockChip } from "@/components/shared/days-in-stock-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VEHICLE_STATUSES } from "@/lib/constants";
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
 * Vehicle hero card. Reuses the app's existing shared components
 * (`RegPlate`, `VehicleStatusBadge`, `DaysInStockChip`, `VehicleImage`)
 * so styling stays consistent with `/vehicles` and the dashboard.
 *
 * Status pill doubles as a dropdown to change vehicle status without
 * leaving the page.
 */
export function VehicleHeaderCard({
  vehicle,
  exporting,
  onOpenInspection,
  onStatusChange,
  onRemoveFromWebsite,
  onExportPdf,
}: VehicleHeaderCardProps) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-start gap-4">
          <VehicleImage
            vehicle={vehicle}
            variant="card"
            className="h-28 w-44 shrink-0 rounded-md"
          />
          <div className="flex flex-col items-start gap-1">
            <RegPlate registration={vehicle.registration} size="lg" />
            <h1 className="text-xl font-semibold leading-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            <p className="text-xs text-muted-foreground">
              {vehicle.variantCode ?? "—"} · {vehicle.stockId}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="appearance-none rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Change status"
                  >
                    <VehicleStatusBadge status={vehicle.status} />
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
              <DaysInStockChip days={vehicle.daysInStock} />
              <span className="text-muted-foreground">
                Received {formatDate(vehicle.receivedDate)}
              </span>
            </div>
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
          {vehicle.status === "sold" &&
            vehicle.removedFromWebsiteAt === null && (
              <Button size="sm" variant="outline" onClick={onRemoveFromWebsite}>
                <EyeOff className="mr-1.5 h-4 w-4" />
                Remove from Website
              </Button>
            )}
          <Button size="sm" disabled={exporting} onClick={onExportPdf}>
            {exporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Job Card PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
