import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { SalesDeal, SalesStage, UUID } from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";
import { listingService } from "./listing-service";

const NS = "sales:";

// A listing is "publishable" (publicly visible) once it's live or already
// tracking the sale lifecycle (reserved). Drafts and archived adverts were
// never on the forecourt, so the sale lifecycle must not stamp them.
function isPublishableStatus(status: string): boolean {
  return status === "live" || status === "reserved";
}

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

  async create(
    input: CreateInput,
  ): Promise<{ deal: SalesDeal; existing: boolean }> {
    const supabase = createClient();
    // Dedupe: never open a second ACTIVE (non-lost) deal for the same vehicle
    // (or the same lead). Return the existing deal so the caller can still
    // navigate to it — prevents duplicate pipeline cards / two leads on one car.
    const orFilter = input.leadId
      ? `vehicle_id.eq.${input.vehicleId},lead_id.eq.${input.leadId}`
      : `vehicle_id.eq.${input.vehicleId}`;
    // Select an array (not maybeSingle) so >1 active deal never throws — just
    // take the most recently updated existing deal.
    const { data: existingRows } = await supabase
      .from("sales_deals")
      .select(SELECT)
      .eq("company_id", input.companyId)
      .neq("stage", "lost")
      .or(orFilter)
      .order("updated_at", { ascending: false })
      .limit(1);
    const existing = (existingRows ?? [])[0];
    if (existing)
      return { deal: existing as unknown as SalesDeal, existing: true };

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
    const deal = data as unknown as SalesDeal;
    invalidate(NS);
    await activityService.log({
      companyId: input.companyId,
      userId: input.sellingAgent,
      vehicleId: input.vehicleId,
      actionType: "lead_converted",
      description: `Deal opened for ${input.customerName}`,
      metadata: { dealId: deal.id, leadId: input.leadId },
    });
    return { deal, existing: false };
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
        // Only stamp "sold" on a listing that's actually published/live —
        // never promote a draft or archived advert into the sold lifecycle.
        const soldListing = await listingService.getForVehicle(v.id);
        if (soldListing && isPublishableStatus(soldListing.status)) {
          await listingService.setStatusForVehicle(v.id, "sold");
        }
        await activityService.log({
          companyId: v.companyId,
          userId: actorId,
          vehicleId: v.id,
          actionType: "sale_completed",
          description: `${v.registration} sold to ${deal.customerName}`,
          metadata: { dealId: id },
        });
      } else if (
        stage === "deposit_taken" ||
        stage === "collection_delivery"
      ) {
        // Reserve the car so it stops showing as available everywhere.
        if (v.status !== "reserved" && v.status !== "sold") {
          await vehicleService.changeStatus(v.id, "reserved", actorId);
        }
        // Only flip a live/publishable advert to "reserved" — leave drafts
        // and archived listings untouched (they were never publicly visible).
        const reserveListing = await listingService.getForVehicle(v.id);
        if (reserveListing && isPublishableStatus(reserveListing.status)) {
          await listingService.setStatusForVehicle(v.id, "reserved");
        }
      } else if (stage === "lost") {
        // Deal fell through — release the reservation back to the forecourt.
        if (v.status === "reserved") {
          await vehicleService.changeStatus(v.id, "listed", actorId);
          // Revert the listing to what it was before the deal reserved it,
          // without silently publishing. A "reserved" advert was live before
          // the deal (reservation only stamps publishable listings), so it
          // goes back live. Any non-reserved listing (e.g. a draft) reverts to
          // draft rather than being promoted to live without a publish step.
          const lostListing = await listingService.getForVehicle(v.id);
          if (lostListing) {
            await listingService.setStatusForVehicle(
              v.id,
              lostListing.status === "reserved" ? "live" : "draft",
            );
          }
        }
      }
    }
    return deal;
  },
};
