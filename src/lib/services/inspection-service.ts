import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import { NEGATIVE_INSPECTION_STATUSES } from "@/lib/constants";
import type { InspectionCheck, UUID, VehicleStatus } from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";
import { todoService } from "./todo-service";
import { maintenanceService } from "./maintenance-service";
import { inspectionChecklistService } from "./inspection-checklist-service";

const NS = "inspections:";

const SELECT = `
  id,
  vehicleId:vehicle_id,
  checkNumber:check_number,
  checkItem:check_item,
  status,
  actionRequired:action_required,
  carriedOutBy:carried_out_by,
  carriedOutDate:carried_out_date,
  createdAt:created_at
`;

/**
 * Does this check still need work? True for an explicitly negative result, an
 * unanswered check, or one deliberately parked as "Pending".
 */
export function isOutstandingCheck(status: string): boolean {
  const s = status.trim();
  if (!s) return true;
  if (s.toLowerCase() === "pending") return true;
  return NEGATIVE_INSPECTION_STATUSES.has(s);
}

/** How far through its 20-point inspection a vehicle is (GEN-72). */
export interface InspectionProgress {
  done: number;
  total: number;
  /** Names of the checks still needing attention, in checklist order. */
  outstanding: string[];
  complete: boolean;
  /**
   * Whether an inspection was ever raised for this vehicle.
   *
   * Matters more than it sounds: most imported stock has no inspection rows at
   * all. "Never inspected in this app" is a different claim from "inspection
   * under way and unfinished", and conflating them fires a warning on nearly
   * every car — which trains everyone to ignore it.
   */
  started: boolean;
}

interface SaveInput {
  vehicleId: UUID;
  checkNumber: number;
  status: string;
  actionRequired: string | null;
  carriedOutBy: UUID;
}

export const inspectionService = {
  async getForVehicle(vehicleId: UUID): Promise<InspectionCheck[]> {
    return withCache(`${NS}vehicle:${vehicleId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("inspection_checks")
        .select(SELECT)
        .eq("vehicle_id", vehicleId)
        .order("check_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InspectionCheck[];
    });
  },

  /**
   * Inspection progress for many vehicles in one query (GEN-72).
   *
   * Sales needs to know a car's inspection state without waiting on 50 round
   * trips — a lead can now be raised against a car that's still being checked,
   * so the flag has to be cheap enough to render in a list.
   *
   * A vehicle with no rows at all hasn't started: 0 of the standard 20.
   */
  async getProgressForVehicles(
    vehicleIds: UUID[],
    companyId: UUID,
  ): Promise<Map<UUID, InspectionProgress>> {
    const result = new Map<UUID, InspectionProgress>();
    if (vehicleIds.length === 0) return result;

    const [rows, items] = await Promise.all([
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("inspection_checks")
          .select(SELECT)
          .in("vehicle_id", vehicleIds);
        if (error) throw error;
        return (data ?? []) as unknown as InspectionCheck[];
      })(),
      inspectionChecklistService.getAll(companyId),
    ]);

    const byVehicle = new Map<string, InspectionCheck[]>();
    for (const c of rows) {
      const list = byVehicle.get(c.vehicleId);
      if (list) list.push(c);
      else byVehicle.set(c.vehicleId, [c]);
    }

    for (const vehicleId of vehicleIds) {
      const checks = byVehicle.get(vehicleId) ?? [];
      const total = items.length;
      // Outstanding = anything not signed off clean, same rule the Things to
      // Do generation uses, plus the checks that were never created at all.
      const outstanding = checks
        .filter((c) => isOutstandingCheck(c.status))
        .map((c) => c.checkItem);
      const missing = items
        .filter((item) => !checks.some((c) => c.checkNumber === item.number))
        .map((item) => item.item);
      const all = [...outstanding, ...missing];
      result.set(vehicleId, {
        total,
        outstanding: all,
        done: Math.max(0, total - all.length),
        complete: all.length === 0,
        started: checks.length > 0,
      });
    }
    return result;
  },

  async start(vehicleId: UUID, actorId: UUID): Promise<InspectionCheck[]> {
    const supabase = createClient();
    const v = await vehicleService.getById(vehicleId);
    if (!v) throw new Error("Vehicle not found");
    // Clear any prior rows (re-start support) then bulk insert.
    await supabase.from("inspection_checks").delete().eq("vehicle_id", vehicleId);
    const today = new Date().toISOString().slice(0, 10);
    const items = await inspectionChecklistService.getAll(v.companyId);
    const rows = items.map((item) => ({
      vehicle_id: vehicleId,
      check_number: item.number,
      check_item: item.item,
      status: "",
      action_required: null as string | null,
      carried_out_by: actorId,
      carried_out_date: today,
    }));
    const { error } = await supabase.from("inspection_checks").insert(rows);
    if (error) throw error;
    invalidate(NS);

    await activityService.log({
      companyId: v.companyId,
      userId: actorId,
      vehicleId,
      actionType: "inspection_started",
      description: `Inspection started for ${v.registration}`,
      metadata: {},
    });
    return inspectionService.getForVehicle(vehicleId);
  },

  async saveCheck(input: SaveInput): Promise<InspectionCheck> {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    // Try update first.
    const { data: updated } = await supabase
      .from("inspection_checks")
      .update({
        status: input.status,
        action_required: input.actionRequired,
        carried_out_by: input.carriedOutBy,
        carried_out_date: today,
      })
      .eq("vehicle_id", input.vehicleId)
      .eq("check_number", input.checkNumber)
      .select(SELECT)
      .maybeSingle();
    if (updated) {
      invalidate(NS);
      return updated as unknown as InspectionCheck;
    }

    // Otherwise insert. No existing row means saveCheck was called before
    // start() ever ran for this vehicle (unusual, but not assumed away) —
    // resolve the company from the vehicle to look up its checklist label.
    const v = await vehicleService.getById(input.vehicleId);
    const items = v ? await inspectionChecklistService.getAll(v.companyId) : [];
    const item = items.find((i) => i.number === input.checkNumber);
    const { data, error } = await supabase
      .from("inspection_checks")
      .insert({
        vehicle_id: input.vehicleId,
        check_number: input.checkNumber,
        check_item: item?.item ?? `Check ${input.checkNumber}`,
        status: input.status,
        action_required: input.actionRequired,
        carried_out_by: input.carriedOutBy,
        carried_out_date: today,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as InspectionCheck;
  },

  async complete(
    vehicleId: UUID,
    actorId: UUID,
  ): Promise<{ flagged: number }> {
    const supabase = createClient();
    const { data: checks } = await supabase
      .from("inspection_checks")
      .select(SELECT)
      .eq("vehicle_id", vehicleId);
    // Anything not signed off clean is outstanding work: an explicitly bad
    // result, a check nobody answered (status ""), or one parked as "Pending"
    // (the Test Drive option). Previously only the first counted, so an
    // inspection submitted half-finished produced no Things to Do at all and
    // the car sailed through to "ready" (GEN-64).
    const failing = ((checks ?? []) as unknown as InspectionCheck[]).filter(
      (c) => isOutstandingCheck(c.status),
    );
    const v = await vehicleService.getById(vehicleId);
    if (!v) throw new Error("Vehicle not found");

    // Idempotency: re-completing an inspection (or re-inspecting after Reset)
    // must not pile up duplicate todos/jobs. Clear the previously auto-generated
    // items that are still PENDING (anything already started/completed is kept),
    // then recreate from the current failing checks below.
    await supabase
      .from("todo_items")
      .delete()
      .eq("vehicle_id", vehicleId)
      .eq("source", "inspection")
      .eq("status", "pending");
    await supabase
      .from("maintenance_jobs")
      .delete()
      .eq("vehicle_id", vehicleId)
      .eq("status", "pending")
      .like("notes", "Auto-created from 20-point inspection%");
    invalidate("todos:");
    invalidate("maintenance:");

    for (const check of failing) {
      const description = check.actionRequired
        ? `${check.checkItem}: ${check.actionRequired}`
        : check.status.trim()
          ? `${check.checkItem}: needs attention (${check.status})`
          : `${check.checkItem}: not checked`;
      await todoService.add({
        vehicleId,
        description,
        vendorId: null,
        cost: null,
        source: "inspection",
        createdBy: actorId,
      });
      await maintenanceService.create(
        {
          companyId: v.companyId,
          vehicleId,
          description,
          assignedTo: null,
          vendorId: null,
          estimatedCost: null,
          estimatedDurationHours: null,
          startDate: null,
          dueDate: null,
          notes: `Auto-created from 20-point inspection (item #${check.checkNumber})`,
        },
        actorId,
      );
    }

    // Lifecycle order — used to avoid dragging a vehicle backwards.
    const LIFECYCLE: VehicleStatus[] = [
      "received",
      "inspection_pending",
      "being_prepared",
      "photos_pending",
      "photos_ready",
      "ready",
      "listed",
      "reserved",
      "sold",
      "returned",
    ];
    const rank = (s: VehicleStatus) => LIFECYCLE.indexOf(s);

    // A vehicle may only become "ready" if there are no open inspection-sourced
    // maintenance jobs left (pending ones were just cleared above, but any
    // in-progress/stalled auto-jobs still count as open work).
    const { data: openJobs } = await supabase
      .from("maintenance_jobs")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .neq("status", "completed")
      .like("notes", "Auto-created from 20-point inspection%");
    const hasOpenInspectionJobs =
      failing.length > 0 || (openJobs?.length ?? 0) > 0;

    const targetStatus: VehicleStatus = hasOpenInspectionJobs
      ? "being_prepared"
      : "ready";
    // Only move forward to the target stage — never downgrade a vehicle that has
    // already progressed past it (e.g. photos_ready, listed, sold, reserved).
    if (v.status !== targetStatus && rank(v.status) < rank(targetStatus)) {
      await vehicleService.changeStatus(vehicleId, targetStatus, actorId);
    }

    await activityService.log({
      companyId: v.companyId,
      userId: actorId,
      vehicleId,
      actionType: "inspection_completed",
      description:
        failing.length > 0
          ? `Inspection completed for ${v.registration}: ${failing.length} items need attention`
          : `Inspection completed for ${v.registration}, all clear`,
      metadata: { flagged: failing.length },
    });
    return { flagged: failing.length };
  },
};
