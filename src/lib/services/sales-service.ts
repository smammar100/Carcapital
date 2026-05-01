import { mockSalesDeals } from "@/lib/mock-data";
import type { SalesDeal, UUID } from "@/lib/types";
import { delay } from "./_base";

export const salesService = {
  async getAll(companyId: UUID): Promise<SalesDeal[]> {
    // TODO: Supabase: from('sales_deals').select('*').eq('company_id', companyId)
    await delay();
    return mockSalesDeals.filter((d) => d.companyId === companyId);
  },

  async getById(id: UUID): Promise<SalesDeal | null> {
    // TODO: Supabase: ... .eq('id', id).single()
    await delay(150);
    return mockSalesDeals.find((d) => d.id === id) ?? null;
  },
};
