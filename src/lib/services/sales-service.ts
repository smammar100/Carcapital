import { mockSalesDeals } from "@/lib/mock-data";
import type { SalesDeal, SalesStage, UUID } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

interface CreateInput {
  companyId: UUID;
  vehicleId: UUID;
  leadId: UUID | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  sellingAgent: UUID;
}

export const salesService = {
  async getAll(companyId: UUID): Promise<SalesDeal[]> {
    // TODO: Supabase: from('sales_deals').select('*').eq('company_id', companyId)
    await delay();
    return mockSalesDeals
      .filter((d) => d.companyId === companyId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getById(id: UUID): Promise<SalesDeal | null> {
    // TODO: Supabase: ... .eq('id', id).single()
    await delay(150);
    return mockSalesDeals.find((d) => d.id === id) ?? null;
  },

  async create(input: CreateInput): Promise<SalesDeal> {
    // TODO: Supabase: insert + log
    await delay();
    const deal: SalesDeal = {
      id: newId("deal"),
      companyId: input.companyId,
      vehicleId: input.vehicleId,
      leadId: input.leadId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      stage: "new_lead",
      offerPrice: null,
      agreedPrice: null,
      depositAmount: null,
      depositDate: null,
      collectionDate: null,
      completionDate: null,
      sellingAgent: input.sellingAgent,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    mockSalesDeals.push(deal);
    return deal;
  },

  async updateStage(
    id: UUID,
    stage: SalesStage,
    actorId: UUID,
  ): Promise<SalesDeal> {
    // TODO: Supabase: update + log
    await delay();
    const idx = mockSalesDeals.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error("Deal not found");
    mockSalesDeals[idx] = {
      ...mockSalesDeals[idx],
      stage,
      updatedAt: nowIso(),
      completionDate:
        stage === "completed_sale"
          ? nowIso().slice(0, 10)
          : mockSalesDeals[idx].completionDate,
    };
    const v = await vehicleService.getById(mockSalesDeals[idx].vehicleId);
    if (v) {
      await activityService.log({
        companyId: v.companyId,
        userId: actorId,
        vehicleId: v.id,
        actionType: "sale_stage_changed",
        description: `${v.registration} → ${stage.replace("_", " ")}`,
        metadata: { dealId: id, stage },
      });
      if (stage === "completed_sale") {
        await vehicleService.changeStatus(v.id, "sold", actorId);
        await activityService.log({
          companyId: v.companyId,
          userId: actorId,
          vehicleId: v.id,
          actionType: "sale_completed",
          description: `${v.registration} sold to ${mockSalesDeals[idx].customerName}`,
          metadata: { dealId: id },
        });
      }
    }
    return mockSalesDeals[idx];
  },
};
