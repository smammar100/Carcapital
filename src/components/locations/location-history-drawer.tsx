"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, MapPin } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { usePermissions } from "@/hooks/use-permissions";
import {
  Timeline,
  TimelineItem,
  type TimelineTone,
} from "@/components/shared/timeline";

const TO_LOCATION_TONE: Record<VehicleLocation, TimelineTone> = {
  forecourt: "emerald",
  yard: "slate",
  garage: "rose",
  staff: "amber",
};

interface LocationHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
  actorId: UUID;
  vendorNames?: Record<UUID, string>;
  staffNames?: Record<UUID, string>;
  /** Bumped after `markReturned` so the parent can re-fetch. */
  onChanged?: () => void;
}

function fullDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function describe(
  m: LocationMovement,
  vendorNames: Record<UUID, string>,
  staffNames: Record<UUID, string>,
): { headline: string; context: string | null } {
  const from = m.fromLocation
    ? VEHICLE_LOCATION_LABELS[m.fromLocation as VehicleLocation]
    : "Arrival";
  const to = VEHICLE_LOCATION_LABELS[m.toLocation];
  const headline = `${from} → ${to}`;
  let context: string | null = null;
  if (m.toLocation === "garage" && m.externalVendorId) {
    context = `Workshop: ${vendorNames[m.externalVendorId] ?? "Unknown"}`;
  } else if (m.toLocation === "staff" && m.staffUserId) {
    context = `With: ${staffNames[m.staffUserId] ?? "Unknown staff"}`;
  }
  return { headline, context };
}

/**
 * Full movement history for one vehicle, in a side sheet (Spec v3.0 ·
 * Module A · Chunk 2.3 — "View full history" button). For garage / staff
 * entries that haven't been marked returned, a Mark-returned button
 * gated by `locations:move` (super-user bypasses) stamps actual_return_at.
 */
export function LocationHistoryDrawer({
  open,
  onOpenChange,
  vehicle,
  actorId,
  vendorNames = {},
  staffNames = {},
  onChanged,
}: LocationHistoryDrawerProps) {
  const { can, isSuperUser } = usePermissions();
  const canMarkReturned = isSuperUser || can("locations:move");
  const [movements, setMovements] = useState<LocationMovement[] | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMovements(null);
    locationService
      .getMovementsForVehicle(vehicle.id)
      .then((rows) => {
        if (!cancelled) setMovements(rows);
      })
      .catch(() => {
        if (!cancelled) setMovements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, vehicle.id, refreshToken]);

  async function handleMarkReturned(movement: LocationMovement) {
    try {
      await locationService.markReturned(movement.id, actorId);
      toast.success("Marked returned");
      setRefreshToken((t) => t + 1);
      onChanged?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not mark returned",
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Location history</SheetTitle>
          <SheetDescription>
            {vehicle.stockId} · {vehicle.make} {vehicle.model}{" "}
            <span className="font-mono">{vehicle.registration}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {movements === null ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="text-sm italic text-muted-foreground">
              No movements recorded yet.
            </div>
          ) : (
            <Timeline>
              {movements.map((m) => {
                const { context } = describe(m, vendorNames, staffNames);
                const fromLabel = m.fromLocation
                  ? VEHICLE_LOCATION_LABELS[m.fromLocation as VehicleLocation]
                  : "Arrival";
                const toLabel = VEHICLE_LOCATION_LABELS[m.toLocation];
                const isOpenStaffOrGarage =
                  (m.toLocation === "garage" || m.toLocation === "staff") &&
                  !m.actualReturnAt;
                const hasBody =
                  !!context ||
                  !!m.expectedReturnAt ||
                  !!m.notes ||
                  (isOpenStaffOrGarage && canMarkReturned);
                return (
                  <TimelineItem
                    key={m.id}
                    icon={MapPin}
                    tone={TO_LOCATION_TONE[m.toLocation]}
                    timestamp={fullDateTime(m.createdAt)}
                    body={
                      hasBody ? (
                        <div className="space-y-2">
                          {context ? (
                            <div className="text-xs text-muted-foreground">
                              {context}
                            </div>
                          ) : null}
                          {m.expectedReturnAt ? (
                            <div className="text-xs text-muted-foreground">
                              Expected back: {fullDateTime(m.expectedReturnAt)}
                              {m.actualReturnAt ? (
                                <>
                                  {" "}· returned {fullDateTime(m.actualReturnAt)}
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          {m.notes ? (
                            <div className="rounded-md bg-muted/40 px-2 py-1 text-xs">
                              {m.notes}
                            </div>
                          ) : null}
                          {isOpenStaffOrGarage && canMarkReturned ? (
                            <div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkReturned(m)}
                              >
                                Mark returned
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : undefined
                    }
                  >
                    <span className="font-medium">
                      {fromLabel}{" "}
                      <ArrowRight className="inline size-3 align-baseline text-muted-foreground" />{" "}
                      {toLabel}
                    </span>
                  </TimelineItem>
                );
              })}
            </Timeline>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
