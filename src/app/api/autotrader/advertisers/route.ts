/**
 * AutoTrader Advertisers — GET (list mirror) + POST (sync from API).
 *
 * GET  /api/autotrader/advertisers?page&pageSize
 *   Reads the local `at_advertisers` mirror (capability `advertiser:read`).
 *
 * POST /api/autotrader/advertisers
 *   Pages through the AutoTrader Advertisers API and upserts every advertiser
 *   into the mirror (capability `advertiser:sync`). Returns how many were
 *   synced. Always sends `page` + `pageSize` (Go-Live pagination requirement).
 *
 * Errors from AutoTrader are mapped to HTTP per the Go-Live fundamentals and
 * the CF-RAY id is echoed back so support issues can be traced.
 */

import { NextResponse } from "next/server";
import {
  AutotraderError,
  listAdvertisers,
  autotraderAdvertiserId,
} from "@/lib/services/autotrader-service";
import {
  listAdvertiserRecords,
  upsertSyncedAdvertisers,
} from "@/lib/services/advertiser-service";
import {
  requireUser,
  requireCapability,
  authErrorResponse,
} from "@/lib/auth/require-user";

export const runtime = "nodejs";

// Safety cap so a misbehaving API can't loop us forever.
const MAX_SYNC_PAGES = 50;
const SYNC_PAGE_SIZE = 50;

/** Map an AutotraderError to an HTTP response (carries CF-RAY for support). */
function autotraderErrorResponse(e: unknown): NextResponse {
  if (!(e instanceof AutotraderError)) {
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
  // 429/503 → retryable (Fair Usage); 400 → bad input; 403 → access; else 502.
  const status =
    e.code === "rate_limited" || e.code === "service_unavailable"
      ? 503
      : e.code === "bad_request"
        ? 400
        : e.code === "forbidden_advertiser" || e.code === "forbidden_product"
          ? 403
          : e.code === "unauthorized" || e.code === "auth_failed"
            ? 401
            : e.code === "missing_credentials"
              ? 502
              : 502;
  return NextResponse.json(
    { error: e.code, detail: e.message, cfRayId: e.cfRayId },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    requireCapability(actor, "advertiser:read");
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;
  const pageSize = Number(url.searchParams.get("pageSize")) || 20;

  try {
    const result = await listAdvertiserRecords({ page, pageSize });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "db_read_failed" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const actor = await requireUser();
    requireCapability(actor, "advertiser:sync");
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  if (!autotraderAdvertiserId() || !process.env.AUTOTRADER_KEY) {
    return NextResponse.json(
      { error: "autotrader_not_configured" },
      { status: 502 },
    );
  }

  const syncedAt = new Date().toISOString();
  let synced = 0;

  try {
    // Page through the Advertisers API until a short/empty page (Go-Live: we
    // always send page + pageSize).
    for (let page = 1; page <= MAX_SYNC_PAGES; page++) {
      const { advertisers } = await listAdvertisers({
        page,
        pageSize: SYNC_PAGE_SIZE,
      });
      if (advertisers.length === 0) break;
      synced += await upsertSyncedAdvertisers(advertisers, syncedAt);
      if (advertisers.length < SYNC_PAGE_SIZE) break;
    }
  } catch (e) {
    if (e instanceof AutotraderError) {
      console.warn(
        `[autotrader-advertisers] sync failed: ${e.code}: ${e.message} cf-ray=${e.cfRayId ?? "(none)"}`,
      );
      return autotraderErrorResponse(e);
    }
    console.warn(`[autotrader-advertisers] sync db error: ${String(e)}`);
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }

  return NextResponse.json({ synced, syncedAt });
}
