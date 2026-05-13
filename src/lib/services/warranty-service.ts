import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { UUID, Warranty, WarrantyStatus, WarrantyType } from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

const NS = "warranties:";

const SELECT = `
  id,
  companyId:company_id,
  vehicleId:vehicle_id,
  saleDealId:sale_deal_id,
  customerName:customer_name,
  customerPhone:customer_phone,
  customerEmail:customer_email,
  type,
  provider,
  coverageDetails:coverage_details,
  startDate:start_date,
  endDate:end_date,
  costToDealership:cost_to_dealership,
  costToCustomer:cost_to_customer,
  status,
  certificateGenerated:certificate_generated,
  createdAt:created_at
`;

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
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warranties")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Warranty[];
    });
  },

  async getById(id: UUID): Promise<Warranty | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warranties")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Warranty | null;
    });
  },

  async getByStatus(
    companyId: UUID,
    statuses: WarrantyStatus[],
  ): Promise<Warranty[]> {
    return withCache(`${NS}by-status:${companyId}:${statuses.join(",")}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warranties")
        .select(SELECT)
        .eq("company_id", companyId)
        .in("status", statuses);
      if (error) throw error;
      return (data ?? []) as unknown as Warranty[];
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<Warranty> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("warranties")
      .insert({
        company_id: input.companyId,
        vehicle_id: input.vehicleId,
        sale_deal_id: input.saleDealId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail,
        type: input.type,
        provider: input.provider,
        coverage_details: input.coverageDetails,
        start_date: input.startDate,
        end_date: input.endDate,
        cost_to_dealership: input.costToDealership,
        cost_to_customer: input.costToCustomer,
        status: "active",
        certificate_generated: false,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const w = data as unknown as Warranty;
    invalidate(NS);
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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("warranties")
      .update({ certificate_generated: true })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as Warranty;
  },
};
