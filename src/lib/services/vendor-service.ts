import { mockVendors } from "@/lib/mock-data";
import type { UUID, Vendor, VendorSpeciality } from "@/lib/types";
import { delay, newId } from "./_base";

interface UpsertInput {
  id?: UUID;
  companyId: UUID;
  name: string;
  phone: string;
  speciality: VendorSpeciality;
  active: boolean;
}

export const vendorService = {
  async getAll(companyId: UUID): Promise<Vendor[]> {
    // TODO: Supabase: from('vendors').select('*').eq('company_id', companyId)
    await delay();
    return mockVendors
      .filter((v) => v.companyId === companyId)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: UUID): Promise<Vendor | null> {
    // TODO: Supabase: ... .eq('id', id).single()
    await delay(150);
    return mockVendors.find((v) => v.id === id) ?? null;
  },

  async upsert(input: UpsertInput): Promise<Vendor> {
    // TODO: Supabase: upsert
    await delay();
    if (input.id) {
      const idx = mockVendors.findIndex((v) => v.id === input.id);
      if (idx === -1) throw new Error("Vendor not found");
      mockVendors[idx] = {
        ...mockVendors[idx],
        name: input.name,
        phone: input.phone,
        speciality: input.speciality,
        active: input.active,
      };
      return mockVendors[idx];
    }
    const v: Vendor = {
      id: newId("vendor"),
      companyId: input.companyId,
      name: input.name,
      phone: input.phone,
      speciality: input.speciality,
      active: input.active,
    };
    mockVendors.push(v);
    return v;
  },
};
