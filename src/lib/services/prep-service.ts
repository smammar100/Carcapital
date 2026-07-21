import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { TodoItem, UUID, Vehicle } from "@/lib/types";
import { activityService } from "./activity-service";
import { todoService } from "./todo-service";
import { vehicleService } from "./vehicle-service";

const NS = "prep:";

/**
 * Where a car sits in Prep & Repair.
 *
 * `unassigned` is where every car lands the moment its inspection completes —
 * nobody has picked it up yet. `ready` means there is no outstanding work left,
 * which is what makes the car eligible for Sales.
 */
export type PrepStatus = "unassigned" | "in_progress" | "ready";

export const PREP_STATUSES: { value: PrepStatus; label: string; subtitle: string }[] = [
  { value: "unassigned", label: "Unassigned", subtitle: "Waiting for someone to pick up" },
  { value: "in_progress", label: "In Progress", subtitle: "Prep work under way" },
  { value: "ready", label: "Ready for Sales", subtitle: "All items done" },
];

export interface PrepCar {
  vehicle: Vehicle;
  status: PrepStatus;
  todos: TodoItem[];
  /** Items still blocking the car (pending + in progress). */
  open: number;
  done: number;
  total: number;
  /** Sum of every item's cost — what prep has cost so far. */
  cost: number;
  /** Days since the car arrived, for the "waiting too long" nudge. */
  daysWaiting: number;
}

/**
 * A car is in the prep queue while it's `being_prepared`, and stays visible one
 * step longer at `ready` so the person who finished it can see it land in the
 * Ready lane and hand it on. Anything further down the lifecycle (photos
 * onward) has left prep behind.
 */
const QUEUE_STATUSES = ["being_prepared", "ready"] as const;

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function deriveStatus(vehicle: Vehicle, open: number): PrepStatus {
  if (open === 0) return "ready";
  return vehicle.prepAssignedTo ? "in_progress" : "unassigned";
}

export const prepService = {
  /**
   * The Prep & Repair queue: every car currently in prep, each with its Things
   * to Do rolled up. One query for the cars, one for all their todos — not one
   * per card.
   */
  async getQueue(companyId: UUID): Promise<PrepCar[]> {
    return withCache(`${NS}queue:${companyId}`, async () => {
      const vehicles = (await vehicleService.getAll(companyId)).filter((v) =>
        (QUEUE_STATUSES as readonly string[]).includes(v.status),
      );
      if (vehicles.length === 0) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from("todo_items")
        .select(
          `
          id,
          vehicleId:vehicle_id,
          serialNumber:serial_number,
          description,
          vendorId:vendor_id,
          status,
          cost,
          source,
          createdBy:created_by,
          completedBy:completed_by,
          completedAt:completed_at,
          createdAt:created_at
        `,
        )
        .in(
          "vehicle_id",
          vehicles.map((v) => v.id),
        )
        .order("serial_number", { ascending: true });
      if (error) throw error;

      const byVehicle = new Map<string, TodoItem[]>();
      for (const t of (data ?? []) as unknown as TodoItem[]) {
        const list = byVehicle.get(t.vehicleId);
        if (list) list.push(t);
        else byVehicle.set(t.vehicleId, [t]);
      }

      return vehicles
        .map((vehicle) => {
          const todos = byVehicle.get(vehicle.id) ?? [];
          const open = todos.filter(
            (t) => t.status === "pending" || t.status === "in_progress",
          ).length;
          return {
            vehicle,
            status: deriveStatus(vehicle, open),
            todos,
            open,
            done: todos.filter((t) => t.status === "completed").length,
            total: todos.length,
            cost: todos.reduce((sum, t) => sum + (t.cost ?? 0), 0),
            daysWaiting: daysSince(vehicle.receivedDate),
          };
        })
        // A `ready` car with no prep history never went through this queue —
        // it passed its inspection clean. Don't clutter the board with it.
        .filter((c) => c.vehicle.status === "being_prepared" || c.total > 0)
        .sort((a, b) => b.daysWaiting - a.daysWaiting);
    });
  },

  /**
   * Hand a car in prep to someone (or back to Unassigned with `null`).
   *
   * Written directly rather than through `vehicleService.update` so the hand-off
   * logs as `prep_assigned` instead of the generic `cost_updated` that a blanket
   * vehicle update stamps.
   */
  async assign(
    vehicleId: UUID,
    userId: UUID | null,
    actorId: UUID,
  ): Promise<Vehicle> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .update({ prep_assigned_to: userId })
      .eq("id", vehicleId)
      .select("id, companyId:company_id, registration, prepAssignedTo:prep_assigned_to")
      .single();
    if (error) throw error;
    const vehicle = data as unknown as Vehicle;
    invalidate(NS);
    invalidate("vehicles:");
    await activityService.log({
      companyId: vehicle.companyId,
      userId: actorId,
      vehicleId,
      actionType: "prep_assigned",
      description: userId
        ? `${vehicle.registration} assigned for prep`
        : `${vehicle.registration} returned to unassigned prep`,
      metadata: { prepAssignedTo: userId },
    });
    return vehicle;
  },

  /** Drop the cached queue — call after editing a car's Things to Do. */
  invalidate(): void {
    invalidate(NS);
  },

  /** Re-read one car's roll-up after its list changed, without refetching all. */
  async refreshCar(vehicleId: UUID): Promise<{
    open: number;
    done: number;
    total: number;
    complete: boolean;
  }> {
    invalidate(NS);
    return todoService.getProgress(vehicleId);
  },
};
