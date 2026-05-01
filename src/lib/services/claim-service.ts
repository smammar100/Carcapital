import { mockClaims } from "@/lib/mock-data";
import type { UUID, WarrantyClaim } from "@/lib/types";
import { delay } from "./_base";

export const claimService = {
  async getAll(companyId: UUID): Promise<WarrantyClaim[]> {
    // TODO: Supabase: from('warranty_claims').select('*').eq('company_id', companyId)
    await delay();
    return mockClaims.filter((c) => c.companyId === companyId);
  },

  async getForWarranty(warrantyId: UUID): Promise<WarrantyClaim[]> {
    // TODO: Supabase: ... .eq('warranty_id', warrantyId)
    await delay();
    return mockClaims.filter((c) => c.warrantyId === warrantyId);
  },
};
