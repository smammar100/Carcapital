import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type {
  ReturnResolutionPath,
  UUID,
  VehicleReturn,
} from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

const NS = "returns:";

const SELECT = `
  id,
  companyId:company_id,
  vehicleId:vehicle_id,
  saleDealId:sale_deal_id,
  customerName:customer_name,
  customerPhone:customer_phone,
  returnDate:return_date,
  reason,
  resolutionPath:resolution_path,
  resolutionNotes:resolution_notes,
  refundAmount:refund_amount,
  status,
  createdAt:created_at,
  resolvedAt:resolved_at
`;

interface CreateInput {
  companyId: UUID;
  vehicleId: UUID;
  saleDealId: UUID | null;
  customerName: string;
  customerPhone: string;
  returnDate: string;
  reason: string;
  resolutionPath: ReturnResolutionPath;
  resolutionNotes: string | null;
  refundAmount: number | null;
}

export const returnService = {
  async getAll(companyId: UUID): Promise<VehicleReturn[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("vehicle_returns")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("return_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VehicleReturn[];
    });
  },

  async getById(id: UUID): Promise<VehicleReturn | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("vehicle_returns")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as VehicleReturn | null;
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<VehicleReturn> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vehicle_returns")
      .insert({
        company_id: input.companyId,
        vehicle_id: input.vehicleId,
        sale_deal_id: input.saleDealId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        return_date: input.returnDate,
        reason: input.reason,
        resolution_path: input.resolutionPath,
        resolution_notes: input.resolutionNotes,
        refund_amount: input.refundAmount,
        status: "pending",
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const ret = data as unknown as VehicleReturn;
    invalidate(NS);
    await vehicleService.changeStatus(input.vehicleId, "returned", actorId);
    const v = await vehicleService.getById(input.vehicleId);
    if (v) {
      await activityService.log({
        companyId: input.companyId,
        userId: actorId,
        vehicleId: v.id,
        actionType: "vehicle_returned",
        description: `${input.customerName} returned ${v.registration} — ${input.resolutionPath.replace("_", " ")}`,
        metadata: { returnId: ret.id, resolutionPath: input.resolutionPath },
      });
    }
    return ret;
  },
};
