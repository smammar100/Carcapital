import { mockWarranties } from "@/lib/mock-data";
import type { UUID, Warranty, WarrantyStatus, WarrantyType } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

interface CreateInput {
  companyId: UUID;
  vehicleId: UUID;
  saleDealId: UUID | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  type: WarrantyType;
  provider: string | null;
  coverageDetails: string;
  startDate: string;
  endDate: string;
  costToDealership: number;
  costToCustomer: number;
}

export const warrantyService = {
  async getAll(companyId: UUID): Promise<Warranty[]> {
    // TODO: Supabase: from('warranties').select('*').eq('company_id', companyId)
    await delay();
    return mockWarranties
      .filter((w) => w.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getById(id: UUID): Promise<Warranty | null> {
    // TODO: Supabase: ... .eq('id', id).single()
    await delay(150);
    return mockWarranties.find((w) => w.id === id) ?? null;
  },

  async getByStatus(
    companyId: UUID,
    statuses: WarrantyStatus[],
  ): Promise<Warranty[]> {
    // TODO: Supabase: ... .in('status', statuses)
    await delay();
    return mockWarranties.filter(
      (w) => w.companyId === companyId && statuses.includes(w.status),
    );
  },

  async create(input: CreateInput, actorId: UUID): Promise<Warranty> {
    // TODO: Supabase: insert + log
    await delay();
    const w: Warranty = {
      id: newId("warranty"),
      ...input,
      status: "active",
      certificateGenerated: false,
      createdAt: nowIso(),
    };
    mockWarranties.push(w);
    const v = await vehicleService.getById(input.vehicleId);
    if (v) {
      await activityService.log({
        companyId: input.companyId,
        userId: actorId,
        vehicleId: v.id,
        actionType: "warranty_created",
        description: `${input.type === "third_party" ? input.provider ?? "Warranty" : "In-house"} warranty for ${v.registration}`,
        metadata: { warrantyId: w.id },
      });
    }
    return w;
  },

  async markCertificateGenerated(id: UUID): Promise<Warranty> {
    // TODO: Supabase: update
    await delay(100);
    const idx = mockWarranties.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error("Warranty not found");
    mockWarranties[idx] = { ...mockWarranties[idx], certificateGenerated: true };
    return mockWarranties[idx];
  },
};
