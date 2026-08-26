import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { LocationMovement, UUID, VehicleLocation } from "@/lib/types";
import { activityService } from "./activity-service";
import { deriveCurrentState } from "@/lib/location-history";

const NS = "locations:";

const SELECT = `
  id,
  vehicleId:vehicle_id,
  fromLocation:from_location,
  toLocation:to_location,
  externalVendorId:external_vendor_id,
  staffUserId:staff_user_id,
  expectedReturnAt:expected_return_at,
  actualReturnAt:actual_return_at,
  notes,
  createdBy:created_by,
  createdAt:created_at
`;

export interface CreateMovementInput {
  vehicleId: UUID;
  toLocation: VehicleLocation;
  /** Required when `toLocation === 'garage'`. */
  externalVendorId?: UUID | null;
  /** Required when `toLocation === 'staff'`. */
  staffUserId?: UUID | null;
  /** Required (UI-enforced) for garage / staff destinations. */
  expectedReturnAt?: string | null;
  notes?: string | null;
}

interface VehicleAtLocationRow {
  id: UUID;
  registration: string;
  stockId: string;
  make: string;
  model: string;
  status: string;
  currentLocation: VehicleLocation;
  locationSince: string;
  outForTestDrive: boolean;
  testDriveExpectedBackAt: string | null;
  externalVendorId?: UUID | null;
  staffUserId?: UUID | null;
  expectedReturnAt?: string | null;
}

export type LocationCounts = Record<VehicleLocation, number>;

/**
 * Module A — Vehicle Locations (Spec v3.0).
 *
 * Owns reads of `vehicles.current_location` slices plus the full
 * `location_movements` audit, and provides the single atomic `move()`
 * mutation that:
 *   1. inserts a movement row,
 *   2. updates the vehicle's current_location + location_since,
 *   3. writes an activity-log entry (`vehicle_moved`).
 *
 * Garage and staff destinations enforce their FK requirement at the DB
 * level (CHECK constraint in migration 0010); this service surfaces the
 * same check client-side so the UI shows a tidy error before round-trip.
 *
 * `location_movements` was added in migration 0010 — Supabase types are
 * regenerated separately. Until that runs, the client is cast loose.
 */
export const locationService = {
  /** Full movement history for one vehicle, newest first. */
  async getMovementsForVehicle(vehicleId: UUID): Promise<LocationMovement[]> {
    return withCache(`${NS}vehicle:${vehicleId}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("location_movements")
        .select(SELECT)
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LocationMovement[];
    });
  },

  /** Last `limit` movements for a vehicle (for the LocationCard preview). */
  async getRecentMovements(
    vehicleId: UUID,
    limit = 3,
  ): Promise<LocationMovement[]> {
    return withCache(
      `${NS}vehicle:${vehicleId}:recent:${limit}`,
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createClient() as any;
        const { data, error } = await supabase
          .from("location_movements")
          .select(SELECT)
          .eq("vehicle_id", vehicleId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return (data ?? []) as LocationMovement[];
      },
    );
  },

  /**
   * Vehicles currently at a given location. Returns enough columns to
   * render the tab table (Stock ID / Reg / Make / Model / status / since
   * + the optional vendor / staff context for garage / staff tabs).
   */
  async getByLocation(
    companyId: UUID,
    location: VehicleLocation,
  ): Promise<VehicleAtLocationRow[]> {
    return withCache(`${NS}by:${companyId}:${location}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("vehicles")
        .select(
          `id, registration, stockId:stock_id, make, model, status,
           currentLocation:current_location,
           locationSince:location_since,
           outForTestDrive:out_for_test_drive,
           testDriveExpectedBackAt:test_drive_expected_back_at`,
        )
        .eq("company_id", companyId)
        .eq("current_location", location);
      if (error) throw error;
      const rows = (data ?? []) as VehicleAtLocationRow[];
      // For garage / staff we also want the latest movement's vendor /
      // staff / expected-return; one extra query per vehicle is fine for
      // tab counts in the low hundreds and matches the existing service
      // patterns (no N+1 caching tricks yet).
      if (location !== "garage" && location !== "staff") return rows;
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) return rows;
      const { data: moves, error: mErr } = await supabase
        .from("location_movements")
        .select(
          `vehicle_id, external_vendor_id, staff_user_id, expected_return_at, created_at`,
        )
        .in("vehicle_id", ids)
        .eq("to_location", location)
        // Ignore movements already marked returned so the resolved current
        // vendor / staff reflects the live placement, not a closed-out one.
        .is("actual_return_at", null)
        .order("created_at", { ascending: false });
      if (mErr) throw mErr;
      const latest = new Map<
        UUID,
        {
          external_vendor_id: UUID | null;
          staff_user_id: UUID | null;
          expected_return_at: string | null;
        }
      >();
      for (const m of moves ?? []) {
        if (!latest.has(m.vehicle_id)) {
          latest.set(m.vehicle_id, {
            external_vendor_id: m.external_vendor_id,
            staff_user_id: m.staff_user_id,
            expected_return_at: m.expected_return_at,
          });
        }
      }
      return rows.map((r) => {
        const m = latest.get(r.id);
        if (!m) return r;
        return {
          ...r,
          externalVendorId: m.external_vendor_id,
          staffUserId: m.staff_user_id,
          expectedReturnAt: m.expected_return_at,
        };
      });
    });
  },

  /** Tab-header counts for the four locations. */
  async getCounts(companyId: UUID): Promise<LocationCounts> {
    return withCache(`${NS}counts:${companyId}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("vehicles")
        .select("current_location, status")
        .eq("company_id", companyId);
      if (error) throw error;
      const counts: LocationCounts = {
        forecourt: 0,
        yard: 0,
        garage: 0,
        staff: 0,
      };
      // Exclude terminal statuses (sold / returned) so the tab counts and the
      // "total active" header reflect vehicles still on the books, matching
      // the dealer-partner active-stock logic.
      for (const row of (data ?? []) as {
        current_location: VehicleLocation;
        status: string;
      }[]) {
        if (row.status === "sold" || row.status === "returned") continue;
        counts[row.current_location] = (counts[row.current_location] ?? 0) + 1;
      }
      return counts;
    });
  },

  /**
   * The one atomic mutation: insert the movement row, update the vehicle's
   * current_location + location_since, log activity. No client-side TX
   * (Supabase JS doesn't expose one); each step is idempotent on retry.
   */
  async createMovement(
    companyId: UUID,
    input: CreateMovementInput,
    actorId: UUID,
  ): Promise<LocationMovement> {
    if (input.toLocation === "garage" && !input.externalVendorId) {
      throw new Error("Garage moves require an external vendor.");
    }
    if (input.toLocation === "staff" && !input.staffUserId) {
      throw new Error("Staff moves require a staff member.");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    // 1. Read current location so we can populate from_location.
    const { data: vehicleRow, error: vErr } = await supabase
      .from("vehicles")
      .select(
        "registration, current_location, current_location_label:current_location",
      )
      .eq("id", input.vehicleId)
      .single();
    if (vErr) throw vErr;
    const from: VehicleLocation = vehicleRow.current_location;
    if (from === input.toLocation) {
      throw new Error(`Vehicle is already at ${input.toLocation}.`);
    }

    // 2. Insert the movement row.
    const { data: movement, error: mErr } = await supabase
      .from("location_movements")
      .insert({
        vehicle_id: input.vehicleId,
        from_location: from,
        to_location: input.toLocation,
        external_vendor_id:
          input.toLocation === "garage" ? input.externalVendorId : null,
        staff_user_id:
          input.toLocation === "staff" ? input.staffUserId : null,
        expected_return_at: input.expectedReturnAt ?? null,
        notes: input.notes ?? null,
        created_by: actorId,
      })
      .select(SELECT)
      .single();
    if (mErr) throw mErr;

    // 3. Bump the vehicle's pointer. No client-side transaction is available,
    // so if this fails we compensate by deleting the movement row we just
    // inserted — otherwise the audit log and the vehicle pointer would
    // diverge (a phantom move with no matching current_location).
    const { error: uErr } = await supabase
      .from("vehicles")
      .update({
        current_location: input.toLocation,
        location_since: new Date().toISOString(),
      })
      .eq("id", input.vehicleId);
    if (uErr) {
      await supabase
        .from("location_movements")
        .delete()
        .eq("id", (movement as { id: string }).id);
      throw uErr;
    }

    invalidate(NS);
    invalidate("vehicles:");

    await activityService.log({
      companyId,
      userId: actorId,
      vehicleId: input.vehicleId,
      actionType: "vehicle_moved",
      description: `${vehicleRow.registration}: ${from} → ${input.toLocation}`,
      metadata: {
        movementId: (movement as { id: string }).id,
        from,
        to: input.toLocation,
        externalVendorId: input.externalVendorId ?? null,
        staffUserId: input.staffUserId ?? null,
      },
    });

    return movement as LocationMovement;
  },

  /**
   * Stamp a garage / staff movement as returned (sets actual_return_at).
   *
   * `companyId` scopes the activity-log entry. When a caller already has it
   * (e.g. the locations page), pass it through; otherwise it's resolved from
   * the movement's vehicle so the log is never written with an empty company.
   */
  async markReturned(
    movementId: UUID,
    actorId: UUID,
    companyId?: UUID,
  ): Promise<LocationMovement> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { data, error } = await supabase
      .from("location_movements")
      .update({ actual_return_at: new Date().toISOString() })
      .eq("id", movementId)
      .select(SELECT)
      .single();
    if (error) throw error;
    const movement = data as LocationMovement;
    invalidate(NS);
    // Resolve the company from the vehicle when the caller didn't supply it,
    // so the activity log stays company-scoped instead of orphaned ("").
    let resolvedCompanyId = companyId ?? "";
    if (!resolvedCompanyId) {
      const { data: vehicleRow } = await supabase
        .from("vehicles")
        .select("company_id")
        .eq("id", movement.vehicleId)
        .single();
      resolvedCompanyId = (vehicleRow?.company_id as UUID | undefined) ?? "";
    }
    await activityService.log({
      companyId: resolvedCompanyId,
      userId: actorId,
      vehicleId: movement.vehicleId,
      actionType: "vehicle_moved",
      description: `Marked returned from ${movement.toLocation}`,
      metadata: { movementId, returned: true },
    });
    return movement;
  },

  /**
   * Super-user only — edit notes on a historical movement (UI gates this
   * behind `can("locations:edit_history")`).
   */
  async updateMovementNotes(
    movementId: UUID,
    notes: string,
  ): Promise<LocationMovement> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { data, error } = await supabase
      .from("location_movements")
      .update({ notes })
      .eq("id", movementId)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as LocationMovement;
  },

  /**
   * Edit a historical movement (GEN-101). Gated in the UI behind
   * `can("locations:edit_history")`.
   *
   * After writing, the vehicle's derived `current_location` / `location_since`
   * are re-synced from whatever the timeline now says. Without that, editing
   * the newest movement leaves the car recorded at a location no movement
   * supports — the grid and the timeline would disagree.
   */
  async updateMovement(
    movementId: UUID,
    patch: {
      toLocation?: VehicleLocation;
      createdAt?: string;
      expectedReturnAt?: string | null;
      actualReturnAt?: string | null;
      notes?: string | null;
    },
    actorId: UUID,
    companyId?: UUID,
  ): Promise<LocationMovement> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    const row: Record<string, unknown> = {};
    if (patch.toLocation !== undefined) row.to_location = patch.toLocation;
    if (patch.createdAt !== undefined) row.created_at = patch.createdAt;
    if (patch.expectedReturnAt !== undefined)
      row.expected_return_at = patch.expectedReturnAt;
    if (patch.actualReturnAt !== undefined)
      row.actual_return_at = patch.actualReturnAt;
    if (patch.notes !== undefined) row.notes = patch.notes;

    const { data, error } = await supabase
      .from("location_movements")
      .update(row)
      .eq("id", movementId)
      .select(SELECT)
      .single();
    if (error) throw error;
    const movement = data as LocationMovement;
    invalidate(NS);

    await syncVehicleLocation(supabase, movement.vehicleId);

    await activityService.log({
      companyId: companyId ?? (await resolveCompanyId(supabase, movement.vehicleId)),
      userId: actorId,
      vehicleId: movement.vehicleId,
      actionType: "vehicle_moved",
      description: `Location history edited — now ${movement.toLocation}`,
      metadata: { movementId, edited: Object.keys(row) },
    });
    return movement;
  },

  /** Super-user only — hard-delete a movement (`can("locations:delete")`). */
  async deleteMovement(movementId: UUID, actorId?: UUID): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    // Read the owning vehicle first — after the delete there is no row to ask.
    const { data: existing } = await supabase
      .from("location_movements")
      .select("vehicle_id")
      .eq("id", movementId)
      .single();
    const vehicleId = existing?.vehicle_id as UUID | undefined;

    const { error } = await supabase
      .from("location_movements")
      .delete()
      .eq("id", movementId);
    if (error) throw error;
    invalidate(NS);

    // The deleted entry may have been the one defining where the car is.
    if (vehicleId) {
      await syncVehicleLocation(supabase, vehicleId);
      if (actorId) {
        await activityService.log({
          companyId: await resolveCompanyId(supabase, vehicleId),
          userId: actorId,
          vehicleId,
          actionType: "vehicle_moved",
          description: "Location movement deleted from history",
          metadata: { movementId, deleted: true },
        });
      }
    }
  },
};

/**
 * Re-derive `current_location` / `location_since` on the vehicle from its
 * remaining movement history. A no-op when no movements are left — the
 * vehicle keeps whatever it had rather than being blanked.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncVehicleLocation(supabase: any, vehicleId: UUID): Promise<void> {
  const { data } = await supabase
    .from("location_movements")
    .select(SELECT)
    .eq("vehicle_id", vehicleId);

  const { currentLocation, locationSince } = deriveCurrentState(
    (data ?? []) as LocationMovement[],
  );
  if (!currentLocation || !locationSince) return;

  await supabase
    .from("vehicles")
    .update({ current_location: currentLocation, location_since: locationSince })
    .eq("id", vehicleId);
  invalidate("vehicles:");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveCompanyId(supabase: any, vehicleId: UUID): Promise<UUID> {
  const { data } = await supabase
    .from("vehicles")
    .select("company_id")
    .eq("id", vehicleId)
    .single();
  return (data?.company_id as UUID | undefined) ?? ("" as UUID);
}
