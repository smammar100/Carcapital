import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type {
  UUID,
  Warranty,
  WarrantyClaim,
  WarrantyStatus,
  WarrantyType,
} from "@/lib/types";
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
  amountPaid:amount_paid,
  status,
  purchaseStatus:purchase_status,
  purchasedAt:purchased_at,
  purchasedBy:purchased_by,
  providerReference:provider_reference,
  certificateGenerated:certificate_generated,
  createdAt:created_at
`;

const CLAIM_SELECT = `
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

interface MarkPurchasedInput {
  purchaseDate?: string;
  purchasedBy: UUID;
  providerReference?: string | null;
  amountPaid?: number;
  notes?: string;
}

export interface WarrantyWithClaims extends Warranty {
  claims: WarrantyClaim[];
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

  /** Per-type list — drives the In-House / External tabs. */
  async getByType(
    type: WarrantyType,
    companyId: UUID,
  ): Promise<Warranty[]> {
    return withCache(`${NS}by-type:${companyId}:${type}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warranties")
        .select(SELECT)
        .eq("company_id", companyId)
        .eq("type", type)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Warranty[];
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

  /** Single warranty with its claims joined in one round-trip. */
  async getWithClaims(id: UUID): Promise<WarrantyWithClaims | null> {
    return withCache(`${NS}with-claims:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warranties")
        .select(`${SELECT}, claims:warranty_claims(${CLAIM_SELECT})`)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as WarrantyWithClaims | null;
    });
  },

  /** Count of external warranties still awaiting purchase from the provider. */
  async getPendingPurchaseCount(companyId: UUID): Promise<number> {
    return withCache(`${NS}pending-purchase-count:${companyId}`, async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("warranties")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("purchase_status", "pending");
      if (error) throw error;
      return count ?? 0;
    });
  },

  /** Active counts split by type — drives the sidebar badges + KPIs. */
  async getActiveCount(
    companyId: UUID,
  ): Promise<{ inHouse: number; external: number }> {
    return withCache(`${NS}active-count:${companyId}`, async () => {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const [{ count: inHouse }, { count: external }] = await Promise.all([
        supabase
          .from("warranties")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("type", "in_house")
          .eq("status", "active")
          .gte("end_date", today),
        supabase
          .from("warranties")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("type", "external")
          .eq("status", "active")
          .gte("end_date", today),
      ]);
      return { inHouse: inHouse ?? 0, external: external ?? 0 };
    });
  },

  /** Count by type irrespective of status — for the sidebar nav badges. */
  async getTotalCountByType(companyId: UUID): Promise<{ inHouse: number; external: number }> {
    return withCache(`${NS}total-count:${companyId}`, async () => {
      const supabase = createClient();
      const [{ count: inHouse }, { count: external }] = await Promise.all([
        supabase
          .from("warranties")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("type", "in_house"),
        supabase
          .from("warranties")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("type", "external"),
      ]);
      return { inHouse: inHouse ?? 0, external: external ?? 0 };
    });
  },

  /** Warranties ending within `days` (default 30). For the Expiring Soon KPI. */
  async getExpiringSoon(
    companyId: UUID,
    days = 30,
  ): Promise<Warranty[]> {
    return withCache(`${NS}expiring:${companyId}:${days}`, async () => {
      const supabase = createClient();
      // Local-midnight basis so the KPI agrees with the per-row daysRemaining
      // (0 <= daysRemaining <= days), rather than drifting by the UTC offset.
      const toLocalISODate = (d: Date) => {
        const local = new Date(d);
        local.setHours(0, 0, 0, 0);
        const tzOffsetMs = local.getTimezoneOffset() * 60_000;
        return new Date(local.getTime() - tzOffsetMs).toISOString().slice(0, 10);
      };
      const today = toLocalISODate(new Date());
      const cutoff = toLocalISODate(new Date(Date.now() + days * 86_400_000));
      const { data, error } = await supabase
        .from("warranties")
        .select(SELECT)
        .eq("company_id", companyId)
        .eq("status", "active")
        .gte("end_date", today)
        .lte("end_date", cutoff)
        .order("end_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Warranty[];
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<Warranty> {
    const supabase = createClient();
    // External warranties start in `pending` (need to be purchased from the
    // provider). In-house warranties are `n_a` — Car Capital is the provider.
    const isExternal = input.type === "external";
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
        provider: isExternal ? input.provider : "Car Capital",
        coverage_details: input.coverageDetails,
        start_date: input.startDate,
        end_date: input.endDate,
        cost_to_dealership: input.costToDealership,
        cost_to_customer: input.costToCustomer,
        status: "active",
        purchase_status: isExternal ? "pending" : "n_a",
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
        description: `${isExternal ? input.provider ?? "External" : "In-house"} warranty for ${v.registration}`,
        metadata: {
          warrantyId: w.id,
          type: w.type,
          provider: w.provider,
          customerName: w.customerName,
          vehicleReg: v.registration,
        },
      });
    }
    return w;
  },

  /** Flip an external warranty from `pending` to `purchased`. */
  async markPurchased(
    id: UUID,
    input: MarkPurchasedInput,
  ): Promise<Warranty> {
    const supabase = createClient();
    const updates: TableUpdate<"warranties"> = {
      purchase_status: "purchased",
      purchased_at: input.purchaseDate
        ? new Date(input.purchaseDate).toISOString()
        : new Date().toISOString(),
      purchased_by: input.purchasedBy,
      provider_reference: input.providerReference ?? null,
      // The actual amount paid to the provider — recorded in its own column so
      // it never overwrites cost_to_dealership (the margin cost basis).
      amount_paid: input.amountPaid ?? null,
    };
    const { data, error } = await supabase
      .from("warranties")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const w = data as unknown as Warranty;
    invalidate(NS);
    await activityService.log({
      companyId: w.companyId,
      userId: input.purchasedBy,
      vehicleId: w.vehicleId,
      actionType: "warranty_purchased",
      description: `Marked ${w.provider ?? "external"} warranty purchased for ${w.customerName}`,
      metadata: {
        warrantyId: w.id,
        provider: w.provider,
        providerReference: w.providerReference,
        amountPaid: input.amountPaid ?? w.costToDealership,
        notes: input.notes ?? null,
        event: "warranty_purchased",
      },
    });
    return w;
  },

  async cancel(id: UUID, actorId: UUID, reason?: string): Promise<Warranty> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("warranties")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const w = data as unknown as Warranty;
    invalidate(NS);
    await activityService.log({
      companyId: w.companyId,
      userId: actorId,
      vehicleId: w.vehicleId,
      actionType: "warranty_cancelled",
      description: `Cancelled warranty for ${w.customerName}${reason ? ` — ${reason}` : ""}`,
      metadata: { warrantyId: w.id, reason: reason ?? null, event: "warranty_cancelled" },
    });
    return w;
  },

  async update(
    id: UUID,
    patch: Partial<
      Pick<
        Warranty,
        | "coverageDetails"
        | "startDate"
        | "endDate"
        | "costToDealership"
        | "costToCustomer"
        | "provider"
      >
    >,
  ): Promise<Warranty> {
    const supabase = createClient();
    const updates: TableUpdate<"warranties"> = {};
    if (patch.coverageDetails !== undefined) updates.coverage_details = patch.coverageDetails;
    if (patch.startDate !== undefined) updates.start_date = patch.startDate;
    if (patch.endDate !== undefined) updates.end_date = patch.endDate;
    if (patch.costToDealership !== undefined)
      updates.cost_to_dealership = patch.costToDealership;
    if (patch.costToCustomer !== undefined)
      updates.cost_to_customer = patch.costToCustomer;
    if (patch.provider !== undefined) updates.provider = patch.provider;
    const { data, error } = await supabase
      .from("warranties")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as Warranty;
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
