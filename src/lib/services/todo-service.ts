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
}

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
        status: "pending",
        cost: input.cost,
        source: input.source,
        created_by: input.createdBy,
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
    return todo;
  },

  async remove(id: UUID): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("todo_items").delete().eq("id", id);
    if (error) throw error;
    invalidate(NS);
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
