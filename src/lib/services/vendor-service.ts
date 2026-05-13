import { createClient } from "@/lib/supabase/client";
import type { UUID, Vendor, VendorSpeciality } from "@/lib/types";

const SELECT = `
  id,
  companyId:company_id,
  name,
  phone,
  speciality,
  active
`;

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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vendors")
      .select(SELECT)
      .eq("company_id", companyId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as Vendor[];
  },

  async getById(id: UUID): Promise<Vendor | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vendors")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as Vendor | null;
  },

  async upsert(input: UpsertInput): Promise<Vendor> {
    const supabase = createClient();
    if (input.id) {
      const { data, error } = await supabase
        .from("vendors")
        .update({
          name: input.name,
          phone: input.phone,
          speciality: input.speciality,
          active: input.active,
        })
        .eq("id", input.id)
        .select(SELECT)
        .single();
      if (error) throw error;
      return data as unknown as Vendor;
    }
    const { data, error } = await supabase
      .from("vendors")
      .insert({
        company_id: input.companyId,
        name: input.name,
        phone: input.phone,
        speciality: input.speciality,
        active: input.active,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as unknown as Vendor;
  },
};
