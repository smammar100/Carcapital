import { mockCompanies, mockUsers } from "@/lib/mock-data";
import type { Company, User, UUID } from "@/lib/types";
import { delay } from "./_base";

export const authService = {
  async getUser(id: UUID): Promise<User | null> {
    // TODO: Supabase: from('users').select('*').eq('id', id).single()
    await delay(150);
    return mockUsers.find((u) => u.id === id) ?? null;
  },

  async getAllUsers(): Promise<User[]> {
    // TODO: Supabase: from('users').select('*')
    await delay();
    return [...mockUsers];
  },

  async getUsersForCompany(companyId: UUID): Promise<User[]> {
    // TODO: Supabase: ... .eq('company_id', companyId)
    await delay();
    return mockUsers.filter((u) => u.companyId === companyId);
  },

  async getCompany(id: UUID): Promise<Company | null> {
    // TODO: Supabase: from('companies').select('*').eq('id', id).single()
    await delay(150);
    return mockCompanies.find((c) => c.id === id) ?? null;
  },

  async getAllCompanies(): Promise<Company[]> {
    // TODO: Supabase: from('companies').select('*')
    await delay();
    return [...mockCompanies];
  },
};
