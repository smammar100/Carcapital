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

  /**
   * Single-tenant in v1: returns all users since they all belong to Car Capital UK.
   * Kept for forward-compatibility — the Supabase migration will reintroduce
   * companyId filtering here.
   */
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

  /** Single-tenant helper: returns the Car Capital UK company. */
  async getCurrentCompany(): Promise<Company> {
    // TODO: Supabase: from('companies').select('*').limit(1).single()
    await delay(150);
    const company = mockCompanies[0];
    if (!company) throw new Error("Car Capital UK company not seeded");
    return company;
  },
};
