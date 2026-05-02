import { mockLeads } from "@/lib/mock-data";
import type { Lead, LeadSource, LeadStatus, UUID } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";

interface CreateInput {
  companyId: UUID;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  vehicleInterest: string;
  vehicleId: UUID | null;
  source: LeadSource;
  assignedTo: UUID;
  notes: string | null;
}

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

  async create(input: CreateInput, actorId: UUID): Promise<Lead> {
    // TODO: Supabase: insert + log
    await delay();
    const lead: Lead = {
      id: newId("lead"),
      ...input,
      status: "new",
      appointmentId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    mockLeads.push(lead);
    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: input.vehicleId,
      actionType: "lead_created",
      description: `Lead from ${input.source.replace("_", " ")} — ${input.customerName} interested in ${input.vehicleInterest}`,
      metadata: { leadId: lead.id },
    });
    return lead;
  },

  async update(
    id: UUID,
    patch: Partial<Pick<Lead, "status" | "notes" | "assignedTo" | "appointmentId">>,
  ): Promise<Lead> {
    // TODO: Supabase: update + log
    await delay();
    const idx = mockLeads.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error("Lead not found");
    mockLeads[idx] = { ...mockLeads[idx], ...patch, updatedAt: nowIso() };
    return mockLeads[idx];
  },
};
