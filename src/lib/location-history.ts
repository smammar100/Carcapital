import type { LocationMovement, VehicleLocation } from "@/lib/types";

/**
 * Rules for editing a vehicle's location history (GEN-101).
 *
 * The movement timeline is not just a log — the vehicle's `currentLocation`
 * and `locationSince` columns are derived from its most recent entry. So
 * correcting or deleting a movement can silently leave a car recorded at a
 * place no movement supports. These helpers keep the chain consistent, and
 * live here (framework-free) so the ordering rules are unit-testable.
 */

/** Oldest first. Ties break on id so the order is deterministic. */
export function sortMovements(movements: LocationMovement[]): LocationMovement[] {
  return [...movements].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

export interface DerivedLocationState {
  currentLocation: VehicleLocation | null;
  locationSince: string | null;
}

/**
 * The location the history actually supports. Returns nulls for an empty
 * history so the caller can fall back to the vehicle's default rather than
 * inventing a location.
 */
export function deriveCurrentState(
  movements: LocationMovement[],
): DerivedLocationState {
  const ordered = sortMovements(movements);
  const latest = ordered[ordered.length - 1];
  if (!latest) return { currentLocation: null, locationSince: null };
  return {
    currentLocation: latest.toLocation,
    locationSince: latest.createdAt,
  };
}

/** A garage/staff movement the car has not yet come back from. */
export function isOutstanding(m: LocationMovement): boolean {
  return (
    (m.toLocation === "garage" || m.toLocation === "staff") &&
    m.actualReturnAt === null
  );
}

export interface MovementEditPatch {
  toLocation?: VehicleLocation;
  createdAt?: string;
  expectedReturnAt?: string | null;
  actualReturnAt?: string | null;
  notes?: string | null;
}

/**
 * Validates an edit against the rest of the timeline.
 *
 * The important rule is chronological: a movement may not be dragged past its
 * neighbours, because the timeline's order *is* the vehicle's history. Moving
 * one entry across another would silently rewrite where the car was on a given
 * day (GEN-101 UAT 4).
 */
export function validateMovementEdit(
  movements: LocationMovement[],
  movementId: string,
  patch: MovementEditPatch,
): string | null {
  const ordered = sortMovements(movements);
  const index = ordered.findIndex((m) => m.id === movementId);
  if (index === -1) return "That movement no longer exists.";

  if (patch.createdAt !== undefined) {
    const when = new Date(patch.createdAt).getTime();
    if (Number.isNaN(when)) return "Movement date is not a valid date.";

    const prev = ordered[index - 1];
    const next = ordered[index + 1];
    if (prev && when < new Date(prev.createdAt).getTime()) {
      return "This movement cannot be dated before the one that precedes it.";
    }
    if (next && when > new Date(next.createdAt).getTime()) {
      return "This movement cannot be dated after the one that follows it.";
    }
  }

  const target = ordered[index];
  const expected = patch.expectedReturnAt ?? target.expectedReturnAt;
  const actual =
    patch.actualReturnAt !== undefined
      ? patch.actualReturnAt
      : target.actualReturnAt;
  const movedAt = patch.createdAt ?? target.createdAt;

  if (expected && new Date(expected).getTime() < new Date(movedAt).getTime()) {
    return "Expected return cannot be before the movement itself.";
  }
  if (actual && new Date(actual).getTime() < new Date(movedAt).getTime()) {
    return "Return date cannot be before the movement itself.";
  }

  const toLocation = patch.toLocation ?? target.toLocation;
  if (actual && toLocation !== "garage" && toLocation !== "staff") {
    return "Only garage and staff movements can be marked returned.";
  }

  return null;
}

/**
 * Whether deleting a movement is safe, and what the vehicle's location
 * becomes afterwards. Deleting the newest entry hands the car back to the
 * previous one; deleting the only entry leaves nothing to derive from.
 */
export interface DeletionOutcome {
  allowed: boolean;
  reason?: string;
  /** State to write onto the vehicle after the delete. */
  nextState: DerivedLocationState;
}

export function planMovementDeletion(
  movements: LocationMovement[],
  movementId: string,
): DeletionOutcome {
  const ordered = sortMovements(movements);
  if (!ordered.some((m) => m.id === movementId)) {
    return {
      allowed: false,
      reason: "That movement no longer exists.",
      nextState: deriveCurrentState(ordered),
    };
  }

  const remaining = ordered.filter((m) => m.id !== movementId);
  if (remaining.length === 0) {
    return {
      allowed: false,
      reason:
        "This is the only movement on record — deleting it would leave the vehicle with no location history.",
      nextState: deriveCurrentState(ordered),
    };
  }

  return { allowed: true, nextState: deriveCurrentState(remaining) };
}

/** Whole days between a movement and now, floored at zero. */
export function daysAtLocation(since: string, now: Date = new Date()): number {
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / 86_400_000));
}
