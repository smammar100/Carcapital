/**
 * Liveness + dependency probe for uptime monitoring. Unauthenticated by
 * design (returns no data beyond up/down), so external pingers can hit it.
 * Checks Supabase reachability with a trivial head-count query.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .limit(1);
    db = !error;
    if (error) logger.error("health", "supabase probe failed", { error });
  } catch (e) {
    logger.error("health", "supabase probe threw", { error: e as Error });
  }

  return NextResponse.json(
    { ok: db, db, ts: new Date().toISOString() },
    { status: db ? 200 : 503 },
  );
}
