import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import {
  decodeCursor,
  keysetFilterDesc,
  toPage,
  type Page,
  type PageParams,
} from "./_base";
import type { Json } from "@/lib/supabase/database.types";
import type {
  ActivityActionType,
  ActivityLogEntry,
  UUID,
} from "@/lib/types";

const NS = "activity:";

const SELECT = `
  id,
  companyId:company_id,
  userId:user_id,
  vehicleId:vehicle_id,
  actionType:action_type,
  description,
  metadata,
  createdAt:created_at
`;

interface LogInput {
  companyId: UUID;
  userId: UUID;
  vehicleId: UUID | null;
  actionType: ActivityActionType;
  description: string;
  metadata?: Record<string, unknown>;
}

export const activityService = {
  /**
   * @deprecated Loads the ENTIRE audit trail — the fastest-growing table in
   * the schema. Use `getPage()`; kept while existing callers migrate (A4).
   */
  async getAll(companyId: UUID): Promise<ActivityLogEntry[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("activity_log")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ActivityLogEntry[];
    });
  },

  /** Keyset-paginated read in (created_at DESC, id DESC) order. */
  async getPage(
    companyId: UUID,
    params: PageParams,
  ): Promise<Page<ActivityLogEntry>> {
    const limit = Math.min(Math.max(params.limit, 1), 200);
    const cacheKey = `${NS}page:${companyId}:${params.cursor ?? "first"}:${limit}`;
    return withCache(cacheKey, async () => {
      const supabase = createClient();
      let q = supabase
        .from("activity_log")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (params.cursor) {
        const c = decodeCursor(params.cursor);
        if (c) q = q.or(keysetFilterDesc(c));
      }
      const { data, error } = await q;
      if (error) throw error;
      return toPage((data ?? []) as unknown as ActivityLogEntry[], limit);
    });
  },

  async getForVehicle(vehicleId: UUID): Promise<ActivityLogEntry[]> {
    return withCache(`${NS}vehicle:${vehicleId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("activity_log")
        .select(SELECT)
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ActivityLogEntry[];
    });
  },

  async log(input: LogInput): Promise<ActivityLogEntry> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("activity_log")
      .insert({
        company_id: input.companyId,
        user_id: input.userId,
        vehicle_id: input.vehicleId,
        action_type: input.actionType,
        description: input.description,
        metadata: (input.metadata ?? {}) as Json,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as ActivityLogEntry;
  },
};
