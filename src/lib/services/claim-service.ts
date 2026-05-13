import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { ClaimStatus, UUID, WarrantyClaim } from "@/lib/types";
import { activityService } from "./activity-service";

const NS = "claims:";

const SELECT = `
  id,
  warrantyId:warranty_id,
  vehicleId:vehicle_id,
  companyId:company_id,
  customerName:customer_name,
  issueDescription:issue_description,
  isComplaint:is_complaint,
  estimatedCost:estimated_cost,
  actualCost:actual_cost,
  status,
  resolution,
  createdAt:created_at,
  resolvedAt:resolved_at
`;

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
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warranty_claims")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WarrantyClaim[];
    });
  },

  async getForWarranty(warrantyId: UUID): Promise<WarrantyClaim[]> {
    return withCache(`${NS}warranty:${warrantyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warranty_claims")
        .select(SELECT)
        .eq("warranty_id", warrantyId);
      if (error) throw error;
      return (data ?? []) as unknown as WarrantyClaim[];
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<WarrantyClaim> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("warranty_claims")
      .insert({
        warranty_id: input.warrantyId,
        vehicle_id: input.vehicleId,
        company_id: input.companyId,
        customer_name: input.customerName,
        issue_description: input.issueDescription,
        is_complaint: input.isComplaint,
        estimated_cost: input.estimatedCost,
        status: "open",
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const claim = data as unknown as WarrantyClaim;
    invalidate(NS);
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
    const supabase = createClient();
    const updates: TableUpdate<"warranty_claims"> = { status };
    if (status === "resolved" || status === "rejected") {
      updates.resolved_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from("warranty_claims")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as WarrantyClaim;
  },
};
