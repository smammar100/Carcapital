import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { TodoItem, TodoStatus, TodoSource, UUID } from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

const NS = "todos:";

const SELECT = `
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
`;

interface AddInput {
  vehicleId: UUID;
  description: string;
  vendorId: UUID | null;
  cost: number | null;
  source: TodoSource;
  createdBy: UUID;
  /**
   * Status to file the item under. Defaults to `pending`. Adding straight into
   * the target status matters: the old add-then-promote pair could leave a
   * stray pending row behind if the second call failed (GEN-64).
   */
  status?: TodoStatus;
}

/** Work that still blocks the car: cancelled items are closed, not outstanding. */
const OPEN_STATUSES: TodoStatus[] = ["pending", "in_progress"];

interface UpdateInput {
  description?: string;
  vendorId?: UUID | null;
  status?: TodoStatus;
  cost?: number | null;
}

async function nextSerial(supabase: ReturnType<typeof createClient>, vehicleId: UUID): Promise<number> {
  const { data } = await supabase
    .from("todo_items")
    .select("serial_number")
    .eq("vehicle_id", vehicleId)
    .order("serial_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { serial_number: number } | null)?.serial_number ?? 0) + 1;
}

export const todoService = {
  async getForVehicle(vehicleId: UUID): Promise<TodoItem[]> {
    return withCache(`${NS}vehicle:${vehicleId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("todo_items")
        .select(SELECT)
        .eq("vehicle_id", vehicleId)
        .order("serial_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TodoItem[];
    });
  },

  async add(input: AddInput): Promise<TodoItem> {
    const supabase = createClient();
    const serial = await nextSerial(supabase, input.vehicleId);
    const { data, error } = await supabase
      .from("todo_items")
      .insert({
        vehicle_id: input.vehicleId,
        serial_number: serial,
        description: input.description,
        vendor_id: input.vendorId,
        status: input.status ?? "pending",
        cost: input.cost,
        source: input.source,
        created_by: input.createdBy,
        ...(input.status === "completed"
          ? {
              completed_by: input.createdBy,
              completed_at: new Date().toISOString(),
            }
          : {}),
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const todo = data as unknown as TodoItem;
    invalidate(NS);
    const v = await vehicleService.getById(input.vehicleId);
    if (v) {
      await activityService.log({
        companyId: v.companyId,
        userId: input.createdBy,
        vehicleId: v.id,
        actionType: "todo_added",
        description: `Added: ${input.description}`,
        metadata: { todoId: todo.id, source: input.source },
      });
    }
    await todoService.recomputeReadiness(input.vehicleId, input.createdBy);
    return todo;
  },

  async update(
    id: UUID,
    patch: UpdateInput,
    actorId: UUID,
  ): Promise<TodoItem> {
    const supabase = createClient();
    const { data: prev } = await supabase
      .from("todo_items")
      .select(SELECT)
      .eq("id", id)
      .single();
    if (!prev) throw new Error("Todo not found");
    const previous = prev as unknown as TodoItem;
    const becomesCompleted =
      patch.status === "completed" && previous.status !== "completed";

    const updates: TableUpdate<"todo_items"> = {};
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.vendorId !== undefined) updates.vendor_id = patch.vendorId;
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.cost !== undefined) updates.cost = patch.cost;
    if (becomesCompleted) {
      updates.completed_by = actorId;
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("todo_items")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const todo = data as unknown as TodoItem;
    invalidate(NS);
    if (becomesCompleted) {
      const v = await vehicleService.getById(todo.vehicleId);
      if (v) {
        await activityService.log({
          companyId: v.companyId,
          userId: actorId,
          vehicleId: v.id,
          actionType: "todo_completed",
          description: `Marked completed: ${todo.description}`,
          metadata: { todoId: id },
        });
      }
    }
    if (patch.status !== undefined) {
      await todoService.recomputeReadiness(todo.vehicleId, actorId);
    }
    return todo;
  },

  async remove(id: UUID, actorId?: UUID): Promise<void> {
    const supabase = createClient();
    // Read the row first — after the delete there's no way back to its vehicle,
    // and the readiness roll-up needs it (deleting the last open item is one of
    // the ways a car finishes prep).
    const { data: existing } = await supabase
      .from("todo_items")
      .select("vehicle_id")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase.from("todo_items").delete().eq("id", id);
    if (error) throw error;
    invalidate(NS);
    const vehicleId = (existing as { vehicle_id: string } | null)?.vehicle_id;
    if (vehicleId && actorId) {
      await todoService.recomputeReadiness(vehicleId, actorId);
    }
  },

  /** Open (still-blocking) items for a vehicle, plus the done/total split. */
  async getProgress(vehicleId: UUID): Promise<{
    open: number;
    done: number;
    total: number;
    complete: boolean;
  }> {
    const todos = await todoService.getForVehicle(vehicleId);
    const open = todos.filter((t) => OPEN_STATUSES.includes(t.status)).length;
    const done = todos.filter((t) => t.status === "completed").length;
    return {
      open,
      done,
      total: todos.length,
      // A car with no items at all has nothing outstanding — it is complete.
      complete: open === 0,
    };
  },

  /**
   * Roll the car's status up from its Things to Do list (GEN-64 / GEN-63).
   *
   * Clearing the last outstanding item is what finishes prep, so a car sitting
   * in `being_prepared` becomes `ready` — i.e. eligible for the sales pipeline.
   * Deliberately advance-only: never drag a car that has already moved on
   * (photos, listed, reserved, sold) backwards because someone logged a job.
   */
  async recomputeReadiness(vehicleId: UUID, actorId: UUID): Promise<void> {
    const { complete } = await todoService.getProgress(vehicleId);
    if (!complete) return;
    const v = await vehicleService.getById(vehicleId);
    if (v?.status === "being_prepared") {
      await vehicleService.changeStatus(vehicleId, "ready", actorId);
    }
  },

  async getGrandTotal(vehicleId: UUID): Promise<number> {
    return withCache(`${NS}total:${vehicleId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("todo_items")
        .select("cost")
        .eq("vehicle_id", vehicleId);
      if (error) throw error;
      return ((data ?? []) as Array<{ cost: number | null }>).reduce(
        (sum, t) => sum + (t.cost ?? 0),
        0,
      );
    });
  },
};
