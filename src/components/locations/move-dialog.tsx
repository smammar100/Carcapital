"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  VEHICLE_LOCATION_LABELS,
  VEHICLE_LOCATIONS,
  type LocationMovement,
  type UUID,
  type User,
  type Vehicle,
  type VehicleLocation,
  type Vendor,
} from "@/lib/types";
import { locationService } from "@/lib/services/location-service";

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
  vendors: Vendor[];
  users: User[];
  actorId: UUID;
  companyId: UUID;
  onSuccess?: (movement: LocationMovement) => void;
}

function plusHoursLocal(hours: number): string {
  // Default expected return = now + N hours, formatted for <input type="datetime-local">.
  const d = new Date(Date.now() + hours * 3600_000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
 * Move dialog (Spec v3.0 · Module A · Chunk 2.4 / 2.5).
 *
 * Single dialog covering all 4 destinations. Garage and Staff destinations
 * reveal their branch fields (vendor / staff user) and enforce a required
 * `expected_return_at`. The current location is disabled in the radio
 * group so users can't move "to here". On submit:
 *
 *   1. `locationService.createMovement` (inserts movement, updates vehicle,
 *      logs activity) — DB-level CHECKs guard the vendor/staff invariants.
 *   2. Toast.
 *   3. `onSuccess` callback so the page can refresh its list.
 */
export function MoveDialog({
  open,
  onOpenChange,
  vehicle,
  vendors,
  users,
  actorId,
  companyId,
  onSuccess,
}: MoveDialogProps) {
  const [destination, setDestination] = useState<VehicleLocation | null>(null);
  const [vendorId, setVendorId] = useState<UUID | "">("");
  const [staffUserId, setStaffUserId] = useState<UUID | "">("");
  const [expectedReturn, setExpectedReturn] = useState<string>(plusHoursLocal(48));
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset when re-opened.
  useEffect(() => {
    if (open) {
      setDestination(null);
      setVendorId("");
      setStaffUserId("");
      setExpectedReturn(plusHoursLocal(48));
      setNotes("");
      setSubmitting(false);
    }
  }, [open]);

  const activeVendors = useMemo(() => vendors.filter((v) => v.active), [vendors]);
  const activeUsers = useMemo(() => users.filter((u) => u.active), [users]);

  const needsBranch = destination === "garage" || destination === "staff";
  const errors: string[] = [];
  if (!destination) errors.push("Pick a destination");
  if (destination === vehicle.currentLocation)
    errors.push("Already at this location");
  if (destination === "garage" && !vendorId) errors.push("Pick a vendor");
  if (destination === "staff" && !staffUserId) errors.push("Pick a staff member");
  if (needsBranch && !expectedReturn) errors.push("Expected-back time required");

  const canSubmit = errors.length === 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !destination) return;
    setSubmitting(true);
    try {
      const movement = await locationService.createMovement(
        companyId,
        {
          vehicleId: vehicle.id,
          toLocation: destination,
          externalVendorId: destination === "garage" ? (vendorId as UUID) : null,
          staffUserId: destination === "staff" ? (staffUserId as UUID) : null,
          expectedReturnAt: needsBranch
            ? new Date(expectedReturn).toISOString()
            : null,
          notes: notes.trim() || null,
        },
        actorId,
      );
      toast.success(
        `Moved to ${VEHICLE_LOCATION_LABELS[destination]}`,
      );
      onSuccess?.(movement);
      onOpenChange(false);
    } catch (err) {
      // Supabase PostgrestError isn't an `Error` instance — it's a plain
      // {code, message, hint, details} object. Reach into it explicitly
      // so we surface the real reason (RLS denied / CHECK constraint /
      // FK violation) instead of a generic "try again".
      const obj = err as { message?: string; hint?: string; details?: string };
      const msg =
        (err instanceof Error && err.message) ||
        obj?.message ||
        obj?.hint ||
        obj?.details ||
        "Move failed — try again";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Move {vehicle.stockId} — {vehicle.make} {vehicle.model}{" "}
            <span className="font-mono text-sm text-muted-foreground">
              {vehicle.registration}
            </span>
          </DialogTitle>
          <DialogDescription>
            Currently at:{" "}
            <span className="font-medium text-foreground">
              {VEHICLE_LOCATION_LABELS[vehicle.currentLocation]}
            </span>{" "}
            (since {shortDate(vehicle.locationSince)})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Destination radio group */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Move to</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {VEHICLE_LOCATIONS.map((loc) => {
                const isCurrent = loc === vehicle.currentLocation;
                const isActive = destination === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => setDestination(loc)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border-foreground/40 bg-muted text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/60",
                      isCurrent && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                  >
                    {VEHICLE_LOCATION_LABELS[loc]}
                    {isCurrent ? " (current)" : ""}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Garage branch — vendor */}
          {destination === "garage" ? (
            <div className="space-y-1.5">
              <Label htmlFor="move-vendor">
                Workshop <span className="text-destructive">*</span>
              </Label>
              <Select value={vendorId} onValueChange={(v) => setVendorId(v as UUID)}>
                <SelectTrigger id="move-vendor" className="h-10 w-full">
                  <SelectValue placeholder="Select workshop" />
                </SelectTrigger>
                <SelectContent>
                  {activeVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {v.speciality ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {v.speciality}
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Staff branch — user */}
          {destination === "staff" ? (
            <div className="space-y-1.5">
              <Label htmlFor="move-staff">
                Staff member <span className="text-destructive">*</span>
              </Label>
              <Select
                value={staffUserId}
                onValueChange={(v) => setStaffUserId(v as UUID)}
              >
                <SelectTrigger id="move-staff" className="h-10 w-full">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Expected return — only for garage/staff */}
          {needsBranch ? (
            <div className="space-y-1.5">
              <Label htmlFor="move-expected">
                Expected back <span className="text-destructive">*</span>
              </Label>
              <Input
                id="move-expected"
                type="datetime-local"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
                className="h-10"
              />
            </div>
          ) : null}

          {/* Notes — always optional */}
          <div className="space-y-1.5">
            <Label htmlFor="move-notes">Notes</Label>
            <Textarea
              id="move-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for the move (optional)…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? "Moving…" : "Move →"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
