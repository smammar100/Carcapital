import { mockClaims, mockWarranties } from "@/lib/mock-data";
import type { ClaimStatus, UUID, WarrantyClaim } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";

interface CreateInput {
  warrantyId: UUID;
  vehicleId: UUID;
  companyId: UUID;
  customerName: string;
  issueDescription: string;
  isComplaint: boolean;
  estimatedCost: number | null;
}

export const claimService = {
  async getAll(companyId: UUID): Promise<WarrantyClaim[]> {
    // TODO: Supabase: from('warranty_claims').select('*').eq('company_id', companyId)
    await delay();
    return mockClaims
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getForWarranty(warrantyId: UUID): Promise<WarrantyClaim[]> {
    // TODO: Supabase: ... .eq('warranty_id', warrantyId)
    await delay();
    return mockClaims.filter((c) => c.warrantyId === warrantyId);
  },

  async create(input: CreateInput, actorId: UUID): Promise<WarrantyClaim> {
    // TODO: Supabase: insert + log
    await delay();
    const claim: WarrantyClaim = {
      id: newId("claim"),
      warrantyId: input.warrantyId,
      vehicleId: input.vehicleId,
      companyId: input.companyId,
      customerName: input.customerName,
      issueDescription: input.issueDescription,
      isComplaint: input.isComplaint,
      estimatedCost: input.estimatedCost,
      actualCost: null,
      status: "open",
      resolution: null,
      createdAt: nowIso(),
      resolvedAt: null,
    };
    mockClaims.push(claim);
    // Mark warranty as claimed
    const widx = mockWarranties.findIndex((w) => w.id === input.warrantyId);
    if (widx !== -1) {
      mockWarranties[widx] = {
        ...mockWarranties[widx],
        status: "claimed",
      };
    }
    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: input.vehicleId,
      actionType: "warranty_claim_opened",
      description: `Warranty claim: ${input.issueDescription}`,
      metadata: { claimId: claim.id, isComplaint: input.isComplaint },
    });
    return claim;
  },

  async updateStatus(id: UUID, status: ClaimStatus): Promise<WarrantyClaim> {
    // TODO: Supabase: update
    await delay();
    const idx = mockClaims.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Claim not found");
    mockClaims[idx] = {
      ...mockClaims[idx],
      status,
      resolvedAt:
        status === "resolved" || status === "rejected"
          ? nowIso()
          : mockClaims[idx].resolvedAt,
    };
    return mockClaims[idx];
  },
};
