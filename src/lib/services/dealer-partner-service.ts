import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { DealerPartner, UUID, Vehicle } from "@/lib/types";
import { vehicleService } from "./vehicle-service";

const NS = "dealer-partners:";

const SELECT = `
  id,
  companyId:company_id,
  name,
  phone,
  companyName:company_name,
  email,
  companyAddress:company_address,
  vatNumber:vat_number,
  notes,
  active,
  createdAt:created_at,
  updatedAt:updated_at
`;

// A vehicle counts as "active stock" for a partner unless it has left the
// lot. Sold / returned vehicles are excluded from the partner's count.
const INACTIVE_STATUSES = new Set(["sold", "returned"]);

/**
 * `dealer_partners` and `vehicles.supplier_id` only exist after the
 * user applies migration 0002. They aren't in the generated `Database`
 * types, so we talk to them through an untyped client view. Every call
 * is wrapped so a not-yet-applied migration degrades to an empty result
 * instead of throwing into the UI.
 */
function looseClient(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}

/**
 * True when the error means migration 0002 hasn't been applied yet, so the
 * feature can safely degrade to empty instead of throwing into the UI.
 *
 * Covers both shapes:
 *  • raw Postgres — 42P01 (undefined_table) / 42703 (undefined_column)
 *  • PostgREST schema-cache — PGRST205 (table not in schema cache) /
 *    PGRST204 (column not in schema cache), message "Could not find the
 *    table/column '…' in the schema cache". This is what Supabase actually
 *    returns for a not-yet-created table, so matching it is essential.
 */
function isMigrationMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const msg = e?.message ?? "";
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    /relation .* does not exist|column .* does not exist|does not exist on/i.test(
      msg,
    ) ||
    /could not find the .* in the schema cache/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

interface UpsertInput {
  id?: UUID;
  companyId: UUID;
  name: string;
  phone: string | null;
  companyName: string | null;
  email: string | null;
  companyAddress: string | null;
  vatNumber: string | null;
  notes: string | null;
  active: boolean;
}

export const dealerPartnerService = {
  /** All partners for a company. Empty list if migration 0002 isn't applied. */
  async getAll(companyId: UUID): Promise<DealerPartner[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const sb = looseClient();
      const { data, error } = await sb
        .from("dealer_partners")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      if (error) {
        if (isMigrationMissing(error)) return [];
        throw error;
      }
      return (data ?? []) as unknown as DealerPartner[];
    });
  },

  /**
   * Active-stock count per partner id. Reads `vehicles.supplier_id`
   * directly (lightweight) and tolerates the column not existing yet.
   */
  async activeStockCounts(companyId: UUID): Promise<Map<string, number>> {
    const sb = looseClient();
    const { data, error } = await sb
      .from("vehicles")
      .select("id, supplier_id, status")
      .eq("company_id", companyId);
    const counts = new Map<string, number>();
    if (error) {
      if (isMigrationMissing(error)) return counts;
      throw error;
    }
    for (const row of (data ?? []) as unknown as Array<{
      supplier_id: string | null;
      status: string;
    }>) {
      if (!row.supplier_id) continue;
      if (INACTIVE_STATUSES.has(row.status)) continue;
      counts.set(row.supplier_id, (counts.get(row.supplier_id) ?? 0) + 1);
    }
    return counts;
  },

  /**
   * The active vehicles supplied by one partner. Reuses the hardened
   * vehicleService for the full Vehicle rows, intersected with a
   * lightweight supplier_id lookup so we don't have to widen the core
   * vehicle SELECT (which many pages depend on).
   */
  async activeStock(companyId: UUID, partnerId: UUID): Promise<Vehicle[]> {
    const sb = looseClient();
    const { data, error } = await sb
      .from("vehicles")
      .select("id, supplier_id, status")
      .eq("company_id", companyId);
    if (error) {
      if (isMigrationMissing(error)) return [];
      throw error;
    }
    const ids = new Set(
      ((data ?? []) as unknown as Array<{
        id: string;
        supplier_id: string | null;
        status: string;
      }>)
        .filter(
          (r) =>
            r.supplier_id === partnerId && !INACTIVE_STATUSES.has(r.status),
        )
        .map((r) => r.id),
    );
    if (ids.size === 0) return [];
    const all = await vehicleService.getAll(companyId);
    return all.filter((v) => ids.has(v.id));
  },

  async upsert(input: UpsertInput): Promise<DealerPartner | null> {
    const sb = looseClient();
    const now = new Date().toISOString();
    if (input.id) {
      const { data, error } = await sb
        .from("dealer_partners")
        .update({
          name: input.name,
          phone: input.phone,
          company_name: input.companyName,
          email: input.email,
          company_address: input.companyAddress,
          vat_number: input.vatNumber,
          notes: input.notes,
          active: input.active,
          updated_at: now,
        })
        .eq("id", input.id)
        .select(SELECT)
        .single();
      if (error) {
        if (isMigrationMissing(error)) return null;
        throw error;
      }
      invalidate(NS);
      return data as unknown as DealerPartner;
    }
    const { data, error } = await sb
      .from("dealer_partners")
      .insert({
        company_id: input.companyId,
        name: input.name,
        phone: input.phone,
        company_name: input.companyName,
        email: input.email,
        company_address: input.companyAddress,
        vat_number: input.vatNumber,
        notes: input.notes,
        active: input.active,
      })
      .select(SELECT)
      .single();
    if (error) {
      if (isMigrationMissing(error)) return null;
      throw error;
    }
    invalidate(NS);
    return data as unknown as DealerPartner;
  },

  /**
   * Point a vehicle at a dealer partner (or clear it with null). Guarded:
   * silently no-ops if `vehicles.supplier_id` isn't there yet.
   */
  async assignSupplier(
    vehicleId: UUID,
    supplierId: UUID | null,
  ): Promise<boolean> {
    const sb = looseClient();
    const { error } = await sb
      .from("vehicles")
      .update({ supplier_id: supplierId })
      .eq("id", vehicleId);
    if (error) {
      if (isMigrationMissing(error)) return false;
      throw error;
    }
    invalidate("vehicles:");
    return true;
  },

  /** One partner by id. Null if not found / migration 0002 absent. */
  async getById(id: UUID): Promise<DealerPartner | null> {
    const sb = looseClient();
    const { data, error } = await sb
      .from("dealer_partners")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      if (isMigrationMissing(error)) return null;
      throw error;
    }
    return (data as unknown as DealerPartner) ?? null;
  },

  /**
   * SPEC Point 7 — every vehicle ever sourced from this partner,
   * INCLUDING sold/returned (the "Historical Stock" section).
   */
  async historicalStock(
    companyId: UUID,
    partnerId: UUID,
  ): Promise<Vehicle[]> {
    const sb = looseClient();
    const { data, error } = await sb
      .from("vehicles")
      .select("id, supplier_id")
      .eq("company_id", companyId);
    if (error) {
      if (isMigrationMissing(error)) return [];
      throw error;
    }
    const ids = new Set(
      ((data ?? []) as unknown as Array<{
        id: string;
        supplier_id: string | null;
      }>)
        .filter((r) => r.supplier_id === partnerId)
        .map((r) => r.id),
    );
    if (ids.size === 0) return [];
    const all = await vehicleService.getAll(companyId);
    return all.filter((v) => ids.has(v.id));
  },
};
