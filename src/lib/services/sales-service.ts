import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { SalesDeal, SalesStage, UUID } from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

const NS = "sales:";

const SELECT = `
  id,
  companyId:company_id,
  vehicleId:vehicle_id,
  leadId:lead_id,
  customerName:customer_name,
  customerPhone:customer_phone,
  customerEmail:customer_email,
  stage,
  offerPrice:offer_price,
  agreedPrice:agreed_price,
  depositAmount:deposit_amount,
  depositDate:deposit_date,
  collectionDate:collection_date,
  completionDate:completion_date,
  sellingAgent:selling_agent,
  notes,
  createdAt:created_at,
  updatedAt:updated_at
`;

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
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales_deals")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SalesDeal[];
    });
  },

  async getById(id: UUID): Promise<SalesDeal | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales_deals")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SalesDeal | null;
    });
  },

  async create(input: CreateInput): Promise<SalesDeal> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sales_deals")
      .insert({
        company_id: input.companyId,
        vehicle_id: input.vehicleId,
        lead_id: input.leadId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail,
        stage: "new_lead",
        selling_agent: input.sellingAgent,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as SalesDeal;
  },

  async updateStage(
    id: UUID,
    stage: SalesStage,
    actorId: UUID,
  ): Promise<SalesDeal> {
    const supabase = createClient();
    const updates: TableUpdate<"sales_deals"> = { stage };
    if (stage === "completed_sale") {
      updates.completion_date = new Date().toISOString().slice(0, 10);
    }
    const { data, error } = await supabase
      .from("sales_deals")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const deal = data as unknown as SalesDeal;
    invalidate(NS);
    const v = await vehicleService.getById(deal.vehicleId);
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
          description: `${v.registration} sold to ${deal.customerName}`,
          metadata: { dealId: id },
        });
      }
    }
    return deal;
  },
};
