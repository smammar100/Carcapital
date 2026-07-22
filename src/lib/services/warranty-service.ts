import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type {
  Invoice,
  UUID,
  Warranty,
  WarrantyClaim,
  WarrantyDeclaration,
  WarrantyStatus,
  WarrantyType,
} from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

const NS = "warranties:";

const WARRANTY_DURATION_MONTHS: Record<
  WarrantyDeclaration["duration"],
  number
> = {
  "1 Month": 1,
  "3 Months": 3,
  "6 Months": 6,
  "12 Months": 12,
};

/**
 * Add whole months to an ISO date, clamping to the end of a shorter month —
 * 3 months from 31 Jan is 30 Apr, not 1 May. Date-only maths (no timezone
 * shifting) so a warranty never expires a day early in BST.
 */
function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Human-readable cover summary stored on the warranty record. */
function describeCover(d: WarrantyDeclaration): string {
  const parts = [
    `${d.coverType} cover`,
    `${d.duration}`,
    `£${d.claimLimit.toLocaleString("en-GB")} claim limit`,
  ];
  if (d.diagnosticsCover > 0) parts.push(`£${d.diagnosticsCover} diagnostics`);
  if (d.excessPercent > 0) parts.push(`${d.excessPercent}% excess`);
  parts.push(d.wearTearCovered ? "wear & tear covered" : "wear & tear excluded");
  return parts.join(" · ");
}

const SELECT = `
  id,
  companyId:company_id,
  vehicleId:vehicle_id,
  saleDealId:sale_deal_id,
  invoiceId:invoice_id,
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
  invoiceId?: UUID | null;
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
        invoice_id: input.invoiceId ?? null,
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
      description: `Cancelled warranty for ${w.customerName}${reason ? ` (${reason})` : ""}`,
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

  /** The warranty a given sales invoice issued, if it issued one. */
  async getForInvoice(invoiceId: UUID): Promise<Warranty | null> {
    return withCache(`${NS}by-invoice:${invoiceId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warranties")
        .select(SELECT)
        .eq("invoice_id", invoiceId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Warranty | null;
    });
  },

  /**
   * Turn an invoice's Warranty Declaration into a real warranty record (GEN-66).
   *
   * Issuing an invoice is what sells the cover, so it's what has to create the
   * record — previously Section F only ever reached the PDF, and "in-house"
   * cover existed nowhere in the Warranties module.
   *
   * Keyed on `invoice_id`, so it is safe to call on every save:
   * - declaration present, no record yet → create
   * - declaration present, record exists → update it in place (no duplicate)
   * - declaration removed (Non-Warranty Disclaimer ticked) → cancel the record
   *
   * Returns the live warranty, or null when the invoice declares no cover.
   */
  async syncFromInvoice(
    invoice: Invoice,
    actorId: UUID,
    saleDealId: UUID | null = null,
  ): Promise<Warranty | null> {
    if (!invoice.vehicleId) return null;
    const existing = await warrantyService.getForInvoice(invoice.id);
    const declaration = invoice.warranty;

    // No cover on this invoice. Retract any warranty a previous save issued
    // rather than leaving a live policy behind an edited invoice.
    if (!declaration) {
      if (existing && existing.status === "active") {
        await warrantyService.cancel(
          existing.id,
          actorId,
          `warranty removed from invoice ${invoice.invoiceNumber}`,
        );
      }
      return null;
    }

    // Legacy invoices predate the in-house/external switch; they were in-house.
    const type: WarrantyType = declaration.type ?? "in_house";
    const isExternal = type === "external";
    const startDate = invoice.invoiceDate;
    const endDate = addMonthsIso(
      startDate,
      WARRANTY_DURATION_MONTHS[declaration.duration] ?? 3,
    );
    // What the buyer paid for cover — the warranty add-on lines on this very
    // invoice. Cover given away free (addon_free, total 0) still costs £0.
    const costToCustomer = invoice.lineItems
      .filter((l) => l.addonCategory === "warranty")
      .reduce((sum, l) => sum + (l.total ?? 0), 0);
    const provider = isExternal
      ? declaration.provider?.trim() || "External provider"
      : "Car Capital";

    if (existing) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warranties")
        .update({
          customer_name: invoice.buyerName ?? invoice.partyName,
          customer_phone: invoice.buyerPhone ?? invoice.partyPhone ?? "",
          customer_email: invoice.buyerEmail ?? invoice.partyEmail,
          type,
          provider,
          coverage_details: describeCover(declaration),
          start_date: startDate,
          end_date: endDate,
          cost_to_customer: costToCustomer,
          // Switching in-house ↔ external moves it between the two tabs, so the
          // purchase tracker has to follow. An already-purchased external
          // policy keeps its status — the money left the account regardless.
          purchase_status: isExternal
            ? existing.purchaseStatus === "purchased"
              ? "purchased"
              : "pending"
            : "n_a",
        })
        .eq("id", existing.id)
        .select(SELECT)
        .single();
      if (error) throw error;
      invalidate(NS);
      return data as unknown as Warranty;
    }

    return warrantyService.create(
      {
        companyId: invoice.companyId,
        vehicleId: invoice.vehicleId,
        saleDealId,
        invoiceId: invoice.id,
        customerName: invoice.buyerName ?? invoice.partyName,
        customerPhone: invoice.buyerPhone ?? invoice.partyPhone ?? "",
        customerEmail: invoice.buyerEmail ?? invoice.partyEmail,
        type,
        provider,
        coverageDetails: describeCover(declaration),
        startDate,
        endDate,
        // The dealership's cost for an external policy isn't known until it's
        // actually bought from the provider — that's what Mark Purchased logs.
        costToDealership: 0,
        costToCustomer,
      },
      actorId,
    );
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
