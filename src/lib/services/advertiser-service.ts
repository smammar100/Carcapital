/**
 * AutoTrader Advertisers — DB mirror (server-only).
 *
 * Read/upsert helpers over the `at_advertisers` table (migration 0032). The
 * AutoTrader *API* calls live in autotrader-service.ts; this module is the
 * persistence side: the sync route upserts what the API returns, the webhook
 * upserts a single advertiser from an ADVERTISER notification, and the admin
 * page reads paginated rows from here.
 *
 * Uses the service-role client — the table is integration-global and
 * RLS-denied to browser clients, so all access is server-side and gated by
 * the `advertiser:read` / `advertiser:sync` capabilities at the route.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { Advertiser, AdvertiserRecord } from "@/lib/types";

type AdvertiserRow = Database["public"]["Tables"]["at_advertisers"]["Row"];

function db() {
  return createAdminClient();
}

function mapRow(row: AdvertiserRow): AdvertiserRecord {
  return {
    advertiserId: row.advertiser_id,
    name: row.name ?? null,
    status: row.status ?? null,
    postcode: row.postcode ?? null,
    // `products` is a jsonb column; keep only the string entries we expect.
    products: Array.isArray(row.products)
      ? row.products.filter((p): p is string => typeof p === "string")
      : [],
    raw: (row.raw ?? {}) as Record<string, unknown>,
    syncedAt: row.synced_at ?? null,
    atUpdatedAt: row.at_updated_at ?? null,
  };
}

export interface AdvertiserPage {
  advertisers: AdvertiserRecord[];
  page: number;
  pageSize: number;
  totalResults: number;
}

/** Read a page of mirrored advertisers, newest-synced first. */
export async function listAdvertiserRecords(opts: {
  page?: number;
  pageSize?: number;
}): Promise<AdvertiserPage> {
  const page = opts.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  const pageSize =
    opts.pageSize && opts.pageSize > 0
      ? Math.min(Math.floor(opts.pageSize), 100)
      : 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await db()
    .from("at_advertisers")
    .select("*", { count: "exact" })
    .order("synced_at", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .range(from, to);
  if (error) throw error;

  return {
    advertisers: (data ?? []).map(mapRow),
    page,
    pageSize,
    totalResults: count ?? 0,
  };
}

/**
 * Upsert advertisers pulled from the Advertisers API (sync). Stamps
 * `synced_at`; leaves `at_updated_at` untouched.
 */
export async function upsertSyncedAdvertisers(
  advertisers: Advertiser[],
  syncedAt: string,
): Promise<number> {
  if (advertisers.length === 0) return 0;
  const rows = advertisers
    .filter((a) => a.advertiserId)
    .map((a) => ({
      advertiser_id: a.advertiserId,
      name: a.name,
      status: a.status,
      postcode: a.postcode,
      products: a.products,
      raw: a.raw as Json,
      synced_at: syncedAt,
      updated_at: syncedAt,
    }));
  const { error } = await db()
    .from("at_advertisers")
    .upsert(rows, { onConflict: "advertiser_id" });
  if (error) throw error;
  return rows.length;
}

/**
 * Upsert a single advertiser from an ADVERTISER update notification. Stamps
 * `at_updated_at` so the admin page can show "updated via notification".
 */
export async function upsertNotifiedAdvertiser(
  advertiser: Advertiser,
  updatedAt: string,
): Promise<void> {
  const { error } = await db()
    .from("at_advertisers")
    .upsert(
      {
        advertiser_id: advertiser.advertiserId,
        name: advertiser.name,
        status: advertiser.status,
        postcode: advertiser.postcode,
        products: advertiser.products,
        raw: advertiser.raw as Json,
        at_updated_at: updatedAt,
        updated_at: updatedAt,
      },
      { onConflict: "advertiser_id" },
    );
  if (error) throw error;
}
