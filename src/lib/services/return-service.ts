import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type {
  ActivityActionType,
  ReturnResolutionPath,
  ReturnStatus,
  UUID,
  VehicleReturn,
} from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";
import { listingService } from "./listing-service";

const NS = "returns:";

// The columns that exist in every project. Reads NEVER select beyond these
// without the graceful fallback below, so an un-applied migration 0001
// cannot break the returns list.
const BASE_SELECT = `
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

// BASE + the migration-0001 columns. Used first; on a missing-column error
// (PostgREST 42703 — migration not applied yet) we fall back to BASE_SELECT
// and the normalizer fills the new fields with null.
const SELECT = `
  ${BASE_SELECT},
  originalInvoiceId:original_invoice_id,
  refundBankAccountName:refund_bank_account_name,
  refundSortCode:refund_sort_code,
  refundAccountNumber:refund_account_number,
  refundBankName:refund_bank_name,
  reasonCode:reason_code
`;

/** PostgREST undefined_column → migration 0001 not applied yet. */
function isMissingColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    e?.code === "42703" ||
    /column .* does not exist/i.test(e?.message ?? "")
  );
}

/** Always return a fully-shaped VehicleReturn even from a BASE_SELECT row. */
function normalizeReturn(row: unknown): VehicleReturn {
  const r = row as Record<string, unknown>;
  return {
    ...(r as unknown as VehicleReturn),
    originalInvoiceId: (r.originalInvoiceId as UUID | null) ?? null,
    refundBankAccountName: (r.refundBankAccountName as string | null) ?? null,
    refundSortCode: (r.refundSortCode as string | null) ?? null,
    refundAccountNumber: (r.refundAccountNumber as string | null) ?? null,
    refundBankName: (r.refundBankName as string | null) ?? null,
    reasonCode: (r.reasonCode as VehicleReturn["reasonCode"]) ?? null,
  };
}

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
  /** SPEC Point 3 — structured reason (migration 0006). */
  reasonCode?: string | null;
  /** Migration-0001 fields — persisted via a guarded follow-up update. */
  originalInvoiceId?: UUID | null;
  refundBankAccountName?: string | null;
  refundSortCode?: string | null;
  refundAccountNumber?: string | null;
  refundBankName?: string | null;
}

export const returnService = {
  async getAll(companyId: UUID): Promise<VehicleReturn[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const run = (sel: string) =>
        supabase
          .from("vehicle_returns")
          .select(sel)
          .eq("company_id", companyId)
          .order("return_date", { ascending: false });
      let { data, error } = await run(SELECT);
      if (error && isMissingColumn(error)) {
        ({ data, error } = await run(BASE_SELECT));
      }
      if (error) throw error;
      return (data ?? []).map(normalizeReturn);
    });
  },

  async getById(id: UUID): Promise<VehicleReturn | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const run = (sel: string) =>
        supabase
          .from("vehicle_returns")
          .select(sel)
          .eq("id", id)
          .maybeSingle();
      let { data, error } = await run(SELECT);
      if (error && isMissingColumn(error)) {
        ({ data, error } = await run(BASE_SELECT));
      }
      if (error) throw error;
      return data ? normalizeReturn(data) : null;
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
      .select(BASE_SELECT)
      .single();
    if (error) throw error;
    const baseRet = normalizeReturn(data);

    // Persist the migration-0001 fields in a guarded follow-up update so a
    // not-yet-applied migration degrades gracefully (bank details simply
    // don't save) instead of failing the whole return.
    const enrich: Record<string, unknown> = {};
    if (input.originalInvoiceId !== undefined)
      enrich.original_invoice_id = input.originalInvoiceId;
    if (input.refundBankAccountName !== undefined)
      enrich.refund_bank_account_name = input.refundBankAccountName;
    if (input.refundSortCode !== undefined)
      enrich.refund_sort_code = input.refundSortCode;
    if (input.refundAccountNumber !== undefined)
      enrich.refund_account_number = input.refundAccountNumber;
    if (input.refundBankName !== undefined)
      enrich.refund_bank_name = input.refundBankName;
    if (input.reasonCode !== undefined)
      enrich.reason_code = input.reasonCode;
    let ret = baseRet;
    if (Object.keys(enrich).length > 0) {
      const { data: upd, error: updErr } = await supabase
        .from("vehicle_returns")
        // Cast: migration-0001 columns aren't in the generated DB types
        // until the user regenerates them post-migration.
        .update(enrich as unknown as TableUpdate<"vehicle_returns">)
        .eq("id", baseRet.id)
        .select(SELECT)
        .single();
      if (updErr && !isMissingColumn(updErr)) throw updErr;
      if (!updErr && upd) ret = normalizeReturn(upd);
    }

    invalidate(NS);
    await vehicleService.changeStatus(input.vehicleId, "returned", actorId);
    // A returned car must not keep advertising — pull its listing off-live.
    await listingService.setStatusForVehicle(input.vehicleId, "archived");
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

  /**
   * Move a return through its lifecycle. On `resolved` we stamp resolvedAt;
   * the consumer (vehicle-returns page) generates the refund invoice after
   * this resolves. Optionally patch resolutionNotes / refundAmount at the
   * same time (the resolve dialog collects them).
   */
  async setStatus(
    id: UUID,
    status: ReturnStatus,
    actorId: UUID,
    patch?: { resolutionNotes?: string | null; refundAmount?: number | null },
  ): Promise<VehicleReturn> {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status };
    if (status === "resolved")
      updates.resolved_at = new Date().toISOString();
    if (patch?.resolutionNotes !== undefined)
      updates.resolution_notes = patch.resolutionNotes;
    if (patch?.refundAmount !== undefined)
      updates.refund_amount = patch.refundAmount;

    const run = (sel: string) =>
      supabase
        .from("vehicle_returns")
        .update(updates as unknown as TableUpdate<"vehicle_returns">)
        .eq("id", id)
        .select(sel)
        .single();
    let { data, error } = await run(SELECT);
    if (error && isMissingColumn(error)) {
      ({ data, error } = await run(BASE_SELECT));
    }
    if (error) throw error;
    const ret = normalizeReturn(data);
    invalidate(NS);
    const v = await vehicleService.getById(ret.vehicleId);
    // Move the vehicle out of the 'returned' dead-end once the case closes:
    // rejected → customer keeps it (back to sold); resolved → dealer took it
    // back, re-enters prep for resale.
    if (v && v.status === "returned") {
      if (status === "rejected") {
        await vehicleService.changeStatus(ret.vehicleId, "sold", actorId);
      } else if (status === "resolved") {
        await vehicleService.changeStatus(
          ret.vehicleId,
          "being_prepared",
          actorId,
        );
      }
    }
    // Distinguish the resolution outcome in the audit trail with first-class
    // action types so the Activity Log can filter resolutions/rejections apart
    // from the original return. Non-terminal updates keep vehicle_returned.
    const actionType: ActivityActionType =
      status === "resolved"
        ? "return_resolved"
        : status === "rejected"
          ? "return_rejected"
          : "vehicle_returned";
    await activityService.log({
      companyId: ret.companyId,
      userId: actorId,
      vehicleId: ret.vehicleId,
      actionType,
      description: `Return ${v ? v.registration : ret.id} → ${status.replace("_", " ")}`,
      metadata: { returnId: ret.id, status },
    });
    return ret;
  },
};
