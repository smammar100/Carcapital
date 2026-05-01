import { mockVendors } from "@/lib/mock-data";
import type { UUID, Vendor } from "@/lib/types";
import { delay } from "./_base";

export const vendorService = {
  async getAll(companyId: UUID): Promise<Vendor[]> {
    // TODO: Supabase: from('vendors').select('*').eq('company_id', companyId)
    await delay();
    return mockVendors.filter((v) => v.companyId === companyId);
  },

  async getById(id: UUID): Promise<Vendor | null> {
    // TODO: Supabase: ... .eq('id', id).single()
    await delay(150);
    return mockVendors.find((v) => v.id === id) ?? null;
  },
};
