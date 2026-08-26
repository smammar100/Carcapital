"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
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
import {
  VEHICLE_LOCATION_LABELS,
  VEHICLE_LOCATIONS,
  type LocationMovement,
  type UUID,
  type VehicleLocation,
} from "@/lib/types";
import { locationService } from "@/lib/services/location-service";
import { validateMovementEdit } from "@/lib/location-history";

interface MovementEditDialogProps {
  /** The movement being corrected; null closes the dialog. */
  movement: LocationMovement | null;
  /** Full history, needed to enforce chronology against neighbours. */
  movements: LocationMovement[];
  onOpenChange: (open: boolean) => void;
  actorId: UUID;
  companyId: UUID;
  onSaved: () => void;
}

/** ISO timestamp → the `YYYY-MM-DDTHH:mm` a datetime-local input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Local input value → ISO, or null when cleared. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Correct a historical location movement (GEN-101).
 *
 * Movements were previously append-only, so a car logged to the wrong garage
 * or on the wrong day stayed wrong forever. Editing is chronology-checked —
 * a movement cannot be dragged past its neighbours, because the order of the
 * timeline *is* the vehicle's history.
 */
export function MovementEditDialog({
  movement,
  movements,
  onOpenChange,
  actorId,
  companyId,
  onSaved,
}: MovementEditDialogProps) {
  if (!movement) return null;
  // Keyed on the movement so opening a different one remounts the form with
  // fresh initial state, rather than syncing it back through an effect.
  return (
    <MovementEditForm
      key={movement.id}
      movement={movement}
      movements={movements}
      onOpenChange={onOpenChange}
      actorId={actorId}
      companyId={companyId}
      onSaved={onSaved}
    />
  );
}

function MovementEditForm({
  movement,
  movements,
  onOpenChange,
  actorId,
  companyId,
  onSaved,
}: MovementEditDialogProps & { movement: LocationMovement }) {
  const [toLocation, setToLocation] = useState<VehicleLocation>(
    movement.toLocation,
  );
  const [movedAt, setMovedAt] = useState(() => toLocalInput(movement.createdAt));
  const [expectedReturn, setExpectedReturn] = useState(() =>
    toLocalInput(movement.expectedReturnAt),
  );
  const [actualReturn, setActualReturn] = useState(() =>
    toLocalInput(movement.actualReturnAt),
  );
  const [notes, setNotes] = useState(movement.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isStay = toLocation === "garage" || toLocation === "staff";

  async function handleSave() {
    const patch = {
      toLocation,
      createdAt: fromLocalInput(movedAt) ?? movement.createdAt,
      expectedReturnAt: fromLocalInput(expectedReturn),
      actualReturnAt: fromLocalInput(actualReturn),
      notes: notes.trim() === "" ? null : notes.trim(),
    };

    const problem = validateMovementEdit(movements, movement.id, patch);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      await locationService.updateMovement(movement.id, patch, actorId, companyId);
      toast.success("Movement updated");
      onSaved();
      onOpenChange(false);
    } catch {
      setError("Could not save that change. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={movement !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Edit movement</DialogTitle>
          <DialogDescription>
            Correct a movement recorded in error. The vehicle&apos;s current
            location is re-derived from the timeline after saving.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="movement-destination">Location</Label>
            <Select
              items={Object.fromEntries(
                VEHICLE_LOCATIONS.map((l) => [l, VEHICLE_LOCATION_LABELS[l]]),
              )}
              value={toLocation}
              onValueChange={(v) => setToLocation(v as VehicleLocation)}
            >
              <SelectTrigger id="movement-destination" aria-label="Location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {VEHICLE_LOCATION_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="movement-date">Moved at</Label>
            <Input
              id="movement-date"
              type="datetime-local"
              aria-label="Moved at"
              value={movedAt}
              onChange={(e) => setMovedAt(e.target.value)}
            />
          </div>

          {isStay && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="movement-expected">Expected back</Label>
                <Input
                  id="movement-expected"
                  type="datetime-local"
                  aria-label="Expected back"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="movement-actual">Returned at</Label>
                <Input
                  id="movement-actual"
                  type="datetime-local"
                  aria-label="Returned at"
                  value={actualReturn}
                  onChange={(e) => setActualReturn(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="movement-notes">Notes</Label>
            <Textarea
              id="movement-notes"
              aria-label="Notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </DialogPanel>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
