import { mockLeads } from "@/lib/mock-data";
import type { Lead, LeadStatus, UUID } from "@/lib/types";
import { delay } from "./_base";

export const leadService = {
  async getAll(companyId: UUID): Promise<Lead[]> {
    // TODO: Supabase: from('leads').select('*').eq('company_id', companyId)
    await delay();
    return mockLeads
      .filter((l) => l.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getById(id: UUID): Promise<Lead | null> {
    // TODO: Supabase: from('leads').select('*').eq('id', id).single()
    await delay(150);
    return mockLeads.find((l) => l.id === id) ?? null;
  },

  async getByStatus(
    companyId: UUID,
    statuses: LeadStatus[],
  ): Promise<Lead[]> {
    // TODO: Supabase: ... .in('status', statuses)
    await delay();
    return mockLeads.filter(
      (l) => l.companyId === companyId && statuses.includes(l.status),
    );
  },

  async getRecent(companyId: UUID, days: number): Promise<Lead[]> {
    // TODO: Supabase: ... .gte('created_at', cutoff)
    await delay();
    const cutoff = Date.now() - days * 86400000;
    return mockLeads.filter(
      (l) =>
        l.companyId === companyId &&
        new Date(l.createdAt).getTime() >= cutoff,
    );
  },
};
