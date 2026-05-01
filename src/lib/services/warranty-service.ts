import { mockWarranties } from "@/lib/mock-data";
import type { UUID, Warranty } from "@/lib/types";
import { delay } from "./_base";

export const warrantyService = {
  async getAll(companyId: UUID): Promise<Warranty[]> {
    // TODO: Supabase: from('warranties').select('*').eq('company_id', companyId)
    await delay();
    return mockWarranties.filter((w) => w.companyId === companyId);
  },

  async getById(id: UUID): Promise<Warranty | null> {
    // TODO: Supabase: ... .eq('id', id).single()
    await delay(150);
    return mockWarranties.find((w) => w.id === id) ?? null;
  },
};
