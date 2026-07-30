"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  ClipboardList,
  EyeOff,
  Megaphone,
  PoundSterling,
  Undo2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Vehicle, VehicleStatus } from "@/lib/types";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { vehiclePhotoService } from "@/lib/services/vehicle-photo-service";
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
  onStatusChange: (status: VehicleStatus) => void;
  onRemoveFromWebsite: () => void;
  /** Jump to a detail tab (the primary CTA opens where the next work happens). */
  onNavigate: (tab: string) => void;
}

/**
 * The vehicle's next logical step in the prep → sale lifecycle. The header's
 * primary CTA reflects the current stage and, when clicked, jumps to the tab
 * where that work is done — so the most useful destination is always one click
 * away. `null` = a terminal state (sold) with no outstanding step.
 */
const NEXT_STEP: Record<VehicleStatus, { label: string; tab: string; icon: LucideIcon } | null> = {
  received: { label: "Start Inspection", tab: "inspection", icon: ClipboardList },
  inspection_pending: { label: "Open Inspection", tab: "inspection", icon: ClipboardList },
  being_prepared: { label: "Prep & Repairs", tab: "todo", icon: Wrench },
  photos_pending: { label: "Add Photos", tab: "photos", icon: Camera },
  photos_ready: { label: "Build Advert", tab: "listing", icon: Megaphone },
  ready: { label: "Publish Listing", tab: "listing", icon: Megaphone },
  listed: { label: "View Enquiries", tab: "appointments", icon: Users },
  reserved: { label: "Complete Sale", tab: "financials", icon: PoundSterling },
  sold: null,
  returned: { label: "Re-prep Vehicle", tab: "todo", icon: Undo2 },
};

/**
 * Vehicle hero card. Reuses the app's existing shared components
 * (`RegPlate`, `VehicleStatusBadge`, `DaysInStockChip`, `VehicleImage`)
 * so styling stays consistent with `/vehicles` and the dashboard.
 *
 * Actions: a single state-aware primary CTA (advance the lifecycle) plus a
 * ⋯ menu for the genuine non-tab actions (Job Card PDF, remove from website).
 * The status pill is itself a dropdown to jump to any status directly.
 */
export function VehicleHeaderCard({
  vehicle,
  onStatusChange,
  onRemoveFromWebsite,
  onNavigate,
}: VehicleHeaderCardProps) {
  // Prefer the chosen cover photo (vehicle.heroImageUrl, the same source the
  // Photos tab cover uses) so the header and Photos tab never disagree; fall
  // back to the first uploaded photo, then to the AI/placeholder VehicleImage.
  const [firstPhotoUrl, setFirstPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    vehiclePhotoService
      .list(vehicle.id)
      .then((p) => active && setFirstPhotoUrl(p[0]?.url ?? null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [vehicle.id]);
  const heroUrl = vehicle.heroImageUrl ?? firstPhotoUrl;

  const nextStep = NEXT_STEP[vehicle.status];
  const canRemoveFromWebsite =
    vehicle.status === "sold" && vehicle.removedFromWebsiteAt === null;

  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-0">
        <div className="flex flex-wrap items-start gap-4">
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroUrl}
              alt={`${vehicle.make} ${vehicle.model}`}
              // Pure black/white inset outline, matching the VehicleImage
              // fallback rendered directly below. `border` here was the tinted
              // --border token, which picks up whatever surface sits behind the
              // photo and reads as grime along the edge rather than a boundary.
              className="-outline-offset-1 h-28 w-44 shrink-0 rounded-md object-cover outline-1 outline-black/10 dark:outline-white/10"
            />
          ) : (
            <VehicleImage
              vehicle={vehicle}
              variant="card"
              className="h-28 w-44 shrink-0 rounded-md"
            />
          )}
          <div className="flex flex-col items-start gap-1">
            <RegPlate registration={vehicle.registration} size="lg" />
            <h1 className="text-2xl font-semibold leading-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            <p className="text-xs text-muted-foreground">
              {vehicle.derivative ?? vehicle.variantCode ?? "—"} ·{" "}
              {vehicle.stockId}
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
          {nextStep && (
            <Button size="sm" onClick={() => onNavigate(nextStep.tab)}>
              <nextStep.icon className="mr-1.5 h-4 w-4" />
              {nextStep.label}
            </Button>
          )}
          {canRemoveFromWebsite && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRemoveFromWebsite}
            >
              <EyeOff className="mr-1.5 h-4 w-4" />
              Remove from Website
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
