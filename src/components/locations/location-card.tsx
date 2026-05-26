"use client";

import { useEffect, useState } from "react";
import { ArrowRight, History as HistoryIcon, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VEHICLE_LOCATION_LABELS,
  type LocationMovement,
  type UUID,
  type Vehicle,
  type VehicleLocation,
} from "@/lib/types";
import { locationService } from "@/lib/services/location-service";

interface LocationCardProps {
  vehicle: Vehicle;
  /**
   * Pre-loaded recent movements. If omitted, the card lazily fetches the
   * last 3 via `locationService.getRecentMovements`. Pass when the parent
   * already has them to skip the network round-trip.
   */
  recentMovements?: LocationMovement[];
  /** Pre-resolved vendor names keyed by `vendorId`. */
  vendorNames?: Record<UUID, string>;
  /** Pre-resolved user names keyed by `userId`. */
  staffNames?: Record<UUID, string>;
  onMove?: () => void;
  onViewHistory?: () => void;
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function describeMovement(
  m: LocationMovement,
  vendorNames: Record<UUID, string>,
  staffNames: Record<UUID, string>,
): string {
  const fromLabel = m.fromLocation
    ? VEHICLE_LOCATION_LABELS[m.fromLocation as VehicleLocation]
    : "Arrival";
  const toLabel = VEHICLE_LOCATION_LABELS[m.toLocation];
  let context = "";
  if (m.toLocation === "garage" && m.externalVendorId) {
    const v = vendorNames[m.externalVendorId];
    if (v) context = ` (${v})`;
  } else if (m.toLocation === "staff" && m.staffUserId) {
    const s = staffNames[m.staffUserId];
    if (s) context = ` (${s})`;
  }
  return `${fromLabel} → ${toLabel}${context}`;
}

/**
 * Vehicle Detail right-column card showing physical location state and
 * the 3 most recent movements. Mirrors the ASCII mockup in
 * `Module_A_Vehicle_Locations.md`. Move + history actions are wired by
 * the parent (it owns the MoveDialog state).
 */
export function LocationCard({
  vehicle,
  recentMovements,
  vendorNames = {},
  staffNames = {},
  onMove,
  onViewHistory,
}: LocationCardProps) {
  const [movements, setMovements] = useState<LocationMovement[] | null>(
    recentMovements ?? null,
  );

  useEffect(() => {
    if (recentMovements) {
      setMovements(recentMovements);
      return;
    }
    let cancelled = false;
    locationService
      .getRecentMovements(vehicle.id, 3)
      .then((rows) => {
        if (!cancelled) setMovements(rows);
      })
      .catch(() => {
        if (!cancelled) setMovements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle.id, recentMovements]);

  const days = daysSince(vehicle.locationSince);
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <MapPin className="size-3.5" /> Location
      </div>

      <div className="space-y-1">
        <div className="text-sm">
          Currently at:{" "}
          <span className="font-medium text-foreground">
            {VEHICLE_LOCATION_LABELS[vehicle.currentLocation]}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Since {shortDate(vehicle.locationSince)} · {days} day{days === 1 ? "" : "s"}
          {vehicle.outForTestDrive ? " · out for test drive" : ""}
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <div className="text-xs font-medium text-muted-foreground">Recent moves</div>
        {movements === null ? (
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        ) : movements.length === 0 ? (
          <div className="text-xs italic text-muted-foreground">
            No movements yet.
          </div>
        ) : (
          <ul className="space-y-1 text-xs">
            {movements.map((m) => (
              <li key={m.id} className="flex items-baseline gap-2">
                <span className="tabular-nums text-muted-foreground">
                  {shortDate(m.createdAt)}
                </span>
                <span>{describeMovement(m, vendorNames, staffNames)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onViewHistory ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={onViewHistory}
          >
            <HistoryIcon className="size-3.5" />
            View full history
          </Button>
        ) : null}
        {onMove ? (
          <Button type="button" size="sm" className="ml-auto gap-1" onClick={onMove}>
            Move <ArrowRight className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
