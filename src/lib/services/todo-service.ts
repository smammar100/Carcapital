import { mockTodos } from "@/lib/mock-data";
import type { TodoItem, UUID } from "@/lib/types";
import { delay } from "./_base";

export const todoService = {
  async getForVehicle(vehicleId: UUID): Promise<TodoItem[]> {
    // TODO: Supabase: from('todos').select('*').eq('vehicle_id', vehicleId).order('serial_number')
    await delay();
    return mockTodos
      .filter((t) => t.vehicleId === vehicleId)
      .sort((a, b) => a.serialNumber - b.serialNumber);
  },
};
