import { mockListings } from "@/lib/mock-data";
import type { Listing, UUID } from "@/lib/types";
import { delay } from "./_base";

export const listingService = {
  async getAll(companyId: UUID): Promise<Listing[]> {
    // TODO: Supabase: from('listings').select('*').eq('company_id', companyId)
    await delay();
    return mockListings.filter((l) => l.companyId === companyId);
  },

  async getForVehicle(vehicleId: UUID): Promise<Listing | null> {
    // TODO: Supabase: ... .eq('vehicle_id', vehicleId).maybeSingle()
    await delay(150);
    return mockListings.find((l) => l.vehicleId === vehicleId) ?? null;
  },
};
