import { mockReturns } from "@/lib/mock-data";
import type { UUID, VehicleReturn } from "@/lib/types";
import { delay } from "./_base";

export const returnService = {
  async getAll(companyId: UUID): Promise<VehicleReturn[]> {
    // TODO: Supabase: from('vehicle_returns').select('*').eq('company_id', companyId)
    await delay();
    return mockReturns.filter((r) => r.companyId === companyId);
  },

  async getById(id: UUID): Promise<VehicleReturn | null> {
    // TODO: Supabase: ... .eq('id', id).single()
    await delay(150);
    return mockReturns.find((r) => r.id === id) ?? null;
  },
};
