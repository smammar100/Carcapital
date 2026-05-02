import { mockTodos } from "@/lib/mock-data";
import type { TodoItem, TodoStatus, TodoSource, UUID } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

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

function nextSerial(vehicleId: UUID): number {
  const existing = mockTodos.filter((t) => t.vehicleId === vehicleId);
  if (existing.length === 0) return 1;
  return Math.max(...existing.map((t) => t.serialNumber)) + 1;
}

export const todoService = {
  async getForVehicle(vehicleId: UUID): Promise<TodoItem[]> {
    // TODO: Supabase: from('todos').select('*').eq('vehicle_id', vehicleId).order('serial_number')
    await delay();
    return mockTodos
      .filter((t) => t.vehicleId === vehicleId)
      .sort((a, b) => a.serialNumber - b.serialNumber);
  },

  async add(input: AddInput): Promise<TodoItem> {
    // TODO: Supabase: insert + log activity
    await delay();
    const todo: TodoItem = {
      id: newId("todo"),
      vehicleId: input.vehicleId,
      serialNumber: nextSerial(input.vehicleId),
      description: input.description,
      vendorId: input.vendorId,
      status: "pending",
      cost: input.cost,
      source: input.source,
      createdBy: input.createdBy,
      completedBy: null,
      completedAt: null,
      createdAt: nowIso(),
    };
    mockTodos.push(todo);
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

  async update(id: UUID, patch: UpdateInput, actorId: UUID): Promise<TodoItem> {
    // TODO: Supabase: update + log
    await delay();
    const idx = mockTodos.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Todo not found");
    const wasCompleted = mockTodos[idx].status === "completed";
    const becomesCompleted =
      patch.status === "completed" && !wasCompleted;
    const completedFields = becomesCompleted
      ? { completedBy: actorId, completedAt: nowIso() }
      : {};
    mockTodos[idx] = { ...mockTodos[idx], ...patch, ...completedFields };
    if (becomesCompleted) {
      const v = await vehicleService.getById(mockTodos[idx].vehicleId);
      if (v) {
        await activityService.log({
          companyId: v.companyId,
          userId: actorId,
          vehicleId: v.id,
          actionType: "todo_completed",
          description: `Marked completed: ${mockTodos[idx].description}`,
          metadata: { todoId: id },
        });
      }
    }
    return mockTodos[idx];
  },

  async remove(id: UUID): Promise<void> {
    // TODO: Supabase: delete().eq('id', id)
    await delay();
    const idx = mockTodos.findIndex((t) => t.id === id);
    if (idx !== -1) mockTodos.splice(idx, 1);
  },

  async getGrandTotal(vehicleId: UUID): Promise<number> {
    // TODO: Supabase: aggregation query
    await delay(100);
    return mockTodos
      .filter((t) => t.vehicleId === vehicleId)
      .reduce((sum, t) => sum + (t.cost ?? 0), 0);
  },
};
