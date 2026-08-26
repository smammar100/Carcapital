"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  ParkingSquare,
  Pencil,
  Trash2,
  UserRound,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  VEHICLE_LOCATIONS,
  VEHICLE_LOCATION_LABELS,
  type LocationMovement,
  type UUID,
  type User,
  type Vehicle,
  type VehicleLocation,
  type Vendor,
} from "@/lib/types";
import { locationService } from "@/lib/services/location-service";
import { vendorService } from "@/lib/services/vendor-service";
import { teamService } from "@/lib/services/team-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { MoveDialog } from "@/components/locations/move-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { MovementEditDialog } from "@/components/locations/movement-edit-dialog";
import { planMovementDeletion } from "@/lib/location-history";
import {
  Timeline,
  TimelineItem,
  type TimelineTone,
} from "@/components/shared/timeline";

const LOCATION_ICON: Record<VehicleLocation, LucideIcon> = {
  forecourt: Warehouse,
  yard: ParkingSquare,
  garage: Wrench,
  staff: UserRound,
};

const OFF_SITE: Record<VehicleLocation, boolean> = {
  forecourt: false,
  yard: false,
  garage: true,
  staff: true,
};

const TO_LOCATION_TONE: Record<VehicleLocation, TimelineTone> = {
  forecourt: "emerald",
  yard: "slate",
  garage: "rose",
  staff: "amber",
};

interface LocationTabProps {
  vehicle: Vehicle;
}

const LOCATION_TONE: Record<
  VehicleLocation,
  { dot: string; surface: string; ring: string; text: string }
> = {
  forecourt: {
    dot: "bg-emerald-500",
    surface: "bg-emerald-50 dark:bg-emerald-950/20",
    ring: "ring-emerald-200 dark:ring-emerald-900/30",
    text: "text-emerald-900 dark:text-emerald-100",
  },
  yard: {
    dot: "bg-slate-500",
    surface: "bg-slate-50 dark:bg-slate-900/30",
    ring: "ring-slate-200 dark:ring-slate-800",
    text: "text-slate-900 dark:text-slate-100",
  },
  garage: {
    dot: "bg-red-500",
    surface: "bg-red-50 dark:bg-red-950/20",
    ring: "ring-red-200 dark:ring-red-900/30",
    text: "text-red-900 dark:text-red-100",
  },
  staff: {
    dot: "bg-amber-500",
    surface: "bg-amber-50 dark:bg-amber-950/20",
    ring: "ring-amber-200 dark:ring-amber-900/30",
    text: "text-amber-900 dark:text-amber-100",
  },
};

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
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

/**
 * Vehicle Detail · Location tab (Spec v3.0 · Module A).
 *
 * A dedicated, full-page view of where this car has been: hero card up
 * top, full chronological timeline beneath. Reuses the shared
 * MoveDialog for the move action and locationService.markReturned for
 * stamping garage/staff entries closed. The right-column LocationCard
 * on the Overview tab stays as the quick-glance summary; this tab is
 * the deep dive.
 */
export function LocationTab({ vehicle: vehicleProp }: LocationTabProps) {
  const { company, user } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const { confirm, confirmDialog } = useConfirm();
  const canMove = isSuperUser || can("locations:move");

  // Mirror the vehicle into local state so we can re-fetch the live
  // `currentLocation / locationSince / outForTestDrive` after every
  // move or mark-returned without waiting on a parent re-render.
  const [vehicle, setVehicle] = useState<Vehicle>(vehicleProp);
  const [movements, setMovements] = useState<LocationMovement[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  /** Movement currently open in the edit dialog (GEN-101). */
  const [editing, setEditing] = useState<LocationMovement | null>(null);

  const canEditHistory = isSuperUser || can("locations:edit_history");
  const canDeleteHistory = isSuperUser || can("locations:delete");

  /**
   * Delete a movement, but only when the timeline can survive it. Removing
   * the sole entry would leave the vehicle recorded at a location no movement
   * supports, so that case is refused rather than silently corrupting history.
   */
  async function handleDelete(movement: LocationMovement) {
    if (!user?.id || !movements) return;

    const plan = planMovementDeletion(movements, movement.id);
    if (!plan.allowed) {
      toast.error(plan.reason ?? "That movement cannot be deleted.");
      return;
    }

    const ok = await confirm({
      title: "Delete this movement?",
      description:
        plan.nextState.currentLocation &&
        plan.nextState.currentLocation !== vehicle.currentLocation
          ? `This is the latest movement, so the vehicle will revert to ${VEHICLE_LOCATION_LABELS[plan.nextState.currentLocation]}.`
          : "The movement is removed from the vehicle's history. This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;

    try {
      await locationService.deleteMovement(movement.id, user.id);
      toast.success("Movement deleted");
      setRefreshToken((t) => t + 1);
    } catch {
      toast.error("Could not delete that movement.");
    }
  }

  // Re-sync if the parent ever passes a new vehicle id.
  useEffect(() => {
    setVehicle(vehicleProp);
  }, [vehicleProp]);

  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    Promise.all([
      // Re-pull the vehicle alongside the movements so the hero card
      // stays in sync with the timeline after each refresh.
      vehicleService.getById(vehicleProp.id),
      locationService.getMovementsForVehicle(vehicleProp.id),
      vendorService.getAll(company.id),
      teamService.getAll(company.id),
    ])
      .then(([fresh, m, v, u]) => {
        if (cancelled) return;
        if (fresh) setVehicle(fresh);
        setMovements(m);
        setVendors(v);
        setUsers(u);
      })
      .catch(() => {
        if (!cancelled) setMovements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [company?.id, vehicleProp.id, refreshToken]);

  const vendorNames = useMemo<Record<UUID, string>>(
    () => Object.fromEntries(vendors.map((v) => [v.id, v.name])),
    [vendors],
  );
  const staffNames = useMemo<Record<UUID, string>>(
    () => Object.fromEntries(users.map((u) => [u.id, u.name])),
    [users],
  );

  const tone = LOCATION_TONE[vehicle.currentLocation];
  const days = daysSince(vehicle.locationSince);
  const totalMoves = movements?.length ?? null;

  async function handleMarkReturned(movement: LocationMovement) {
    if (!user?.id) return;
    try {
      await locationService.markReturned(movement.id, user.id, company?.id);
      toast.success("Marked returned");
      // Bumping the token re-runs the load effect which also re-pulls
      // the vehicle, so the hero card refreshes alongside the timeline.
      setRefreshToken((t) => t + 1);
    } catch (err) {
      const obj = err as { message?: string; hint?: string };
      toast.error(obj?.message ?? obj?.hint ?? "Could not mark returned");
    }
  }

  if (!company?.id || !user?.id) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero card — current location at a glance */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ring-1",
          tone.surface,
          tone.ring,
        )}
      >
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-full bg-white shadow-sm",
              tone.text,
            )}
          >
            <MapPin className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("text-base font-semibold", tone.text)}>
                {VEHICLE_LOCATION_LABELS[vehicle.currentLocation]}
              </span>
              <span className={cn("size-2 rounded-full", tone.dot)} aria-hidden />
              {vehicle.outForTestDrive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium text-foreground/80">
                  <Clock className="size-3" /> Out for test drive
                </span>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              Since {shortDate(vehicle.locationSince)} · {days} day{days === 1 ? "" : "s"}
              {totalMoves != null
                ? ` · ${totalMoves} movement${totalMoves === 1 ? "" : "s"} on record`
                : ""}
            </div>
            {vehicle.outForTestDrive && vehicle.testDriveExpectedBackAt ? (
              <div className="text-xs text-muted-foreground">
                Back at {fullDateTime(vehicle.testDriveExpectedBackAt)}
              </div>
            ) : null}
          </div>
        </div>

        {canMove ? (
          <Button
            type="button"
            size="sm"
            className="gap-1"
            onClick={() => setMoveOpen(true)}
          >
            Move <ArrowRight className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {/* Presence strip — the 4 locations, current marked "Here now" */}
      <div className="flex flex-wrap gap-2">
        {VEHICLE_LOCATIONS.map((loc) => {
          const meta = LOCATION_TONE[loc];
          const Icon = LOCATION_ICON[loc];
          const on = loc === vehicle.currentLocation;
          return (
            <div
              key={loc}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                on
                  ? cn("border-transparent ring-1", meta.surface, meta.ring, meta.text)
                  : "border-border text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {VEHICLE_LOCATION_LABELS[loc]}
              {on ? (
                <span className="rounded-full bg-background/70 px-1.5 text-2xs font-medium">
                  Here now
                </span>
              ) : OFF_SITE[loc] ? (
                <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Full chronological timeline — always anchored by the arrival node */}
      <section>
        <h3 className="mb-3 text-sm font-medium">Movement history</h3>

        {movements === null ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <Timeline>
            {movements.map((m) => {
              const fromLabel = m.fromLocation
                ? VEHICLE_LOCATION_LABELS[m.fromLocation]
                : "Arrival";
              const toLabel = VEHICLE_LOCATION_LABELS[m.toLocation];
              const isOpenStay =
                (m.toLocation === "garage" || m.toLocation === "staff") &&
                !m.actualReturnAt;
              const context =
                m.toLocation === "garage" && m.externalVendorId
                  ? `Workshop · ${vendorNames[m.externalVendorId] ?? "Unknown vendor"}`
                  : m.toLocation === "staff" && m.staffUserId
                    ? `With · ${staffNames[m.staffUserId] ?? "Unknown staff"}`
                    : null;
              const actor = staffNames[m.createdBy];
              const overdue =
                isOpenStay &&
                m.expectedReturnAt != null &&
                new Date(m.expectedReturnAt).getTime() < Date.now();
              const hasBody =
                !!context ||
                !!m.expectedReturnAt ||
                !!m.notes ||
                (isOpenStay && canMove) ||
                // The edit / delete actions live in the body, so a bare
                // movement still needs one for them to be reachable.
                canEditHistory ||
                canDeleteHistory;
              return (
                <TimelineItem
                  key={m.id}
                  icon={MapPin}
                  tone={TO_LOCATION_TONE[m.toLocation]}
                  timestamp={
                    <>
                      {fullDateTime(m.createdAt)}
                      {actor ? ` · ${actor}` : ""}
                    </>
                  }
                  body={
                    hasBody ? (
                      <div className="space-y-2">
                        {context ? (
                          <div className="text-xs text-muted-foreground">
                            {context}
                          </div>
                        ) : null}
                        {m.expectedReturnAt ? (
                          <div
                            className={cn(
                              "text-xs",
                              overdue
                                ? "text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            Expected back: {fullDateTime(m.expectedReturnAt)}
                            {m.actualReturnAt ? (
                              <> · returned {fullDateTime(m.actualReturnAt)}</>
                            ) : overdue ? (
                              <> · overdue</>
                            ) : null}
                          </div>
                        ) : null}
                        {m.notes ? (
                          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                            {m.notes}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          {isOpenStay && canMove ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkReturned(m)}
                            >
                              Mark returned
                            </Button>
                          ) : null}

                          {/* GEN-101 — a movement logged to the wrong site or
                              on the wrong date was previously uncorrectable. */}
                          {canEditHistory ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditing(m)}
                              aria-label={`Edit movement ${fullDateTime(m.createdAt)}`}
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </Button>
                          ) : null}

                          {canDeleteHistory ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive-outline"
                              onClick={() => void handleDelete(m)}
                              aria-label={`Delete movement ${fullDateTime(m.createdAt)}`}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </Button>
                          ) : null}
                        </div>
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

            {/* Arrival anchor — always the origin of the timeline, so the
                tab never reads as empty even before the first move. */}
            <TimelineItem
              icon={CheckCircle2}
              tone="slate"
              timestamp={
                <>
                  {new Date(vehicle.receivedDate).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {staffNames[vehicle.receivedBy]
                    ? ` · ${staffNames[vehicle.receivedBy]}`
                    : ""}
                </>
              }
            >
              <span className="font-medium">Arrived in stock</span>
            </TimelineItem>
          </Timeline>
        )}
      </section>

      {/* Move dialog */}
      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        vehicle={vehicle}
        vendors={vendors}
        users={users}
        actorId={user.id}
        companyId={company.id}
        onSuccess={() => setRefreshToken((t) => t + 1)}
      />

      {/* Correct a historical movement (GEN-101) */}
      <MovementEditDialog
        movement={editing}
        movements={movements ?? []}
        onOpenChange={(open) => !open && setEditing(null)}
        actorId={user.id}
        companyId={company.id}
        onSaved={() => setRefreshToken((t) => t + 1)}
      />

      {confirmDialog}
    </div>
  );
}
