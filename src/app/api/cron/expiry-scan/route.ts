/**
 * Daily compliance scan — MOT and tax expiry alerts across in-stock vehicles.
 *
 * An unexpired MOT is a legal requirement to sell or test-drive a vehicle;
 * the data has been on the vehicle row since the DVLA integration, but until
 * now nobody was told BEFORE a date lapsed. Runs daily via Vercel Cron
 * (vercel.json) and writes bell notifications through the capability
 * fan-out, targeting everyone who can edit inventory.
 *
 * Idempotent: each (vehicle, kind, threshold) alert is keyed by a stable
 * `type` + `link` pair — re-runs (or overlapping deploys) skip alerts that
 * already exist, so a vehicle gets at most one notification per threshold.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` — Vercel Cron sends this
 * automatically when the env var is set. 401 otherwise.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUsersWithCapability } from "@/lib/server/notify";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Days-to-expiry thresholds, most urgent first. */
const THRESHOLDS = [3, 14, 30] as const;

/** Vehicle statuses that no longer need compliance alerts. */
const INACTIVE_STATUSES = ["sold", "returned"];

interface VehicleRow {
  id: string;
  company_id: string;
  registration: string;
  make: string | null;
  model: string | null;
  status: string;
  mot_expiry: string | null;
  tax_due_date: string | null;
}

function daysUntil(dateIso: string, now: Date): number {
  const target = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  const today = new Date(
    `${now.toISOString().slice(0, 10)}T00:00:00Z`,
  );
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Smallest threshold that `days` has crossed (3 beats 14 beats 30). */
function thresholdFor(days: number): number | null {
  for (const t of THRESHOLDS) {
    if (days <= t) return t;
  }
  return null;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error("expiry-scan", "CRON_SECRET not set");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: vehicles, error } = await admin
    .from("vehicles")
    .select(
      "id, company_id, registration, make, model, status, mot_expiry, tax_due_date",
    )
    .not("status", "in", `(${INACTIVE_STATUSES.join(",")})`);
  if (error) {
    logger.error("expiry-scan", "vehicle fetch failed", { error });
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }

  // Existing alert keys — (type, link) pairs already in the bell — so re-runs
  // are idempotent. One query, filtered to our alert types.
  const { data: existing, error: exErr } = await admin
    .from("notifications" as never)
    .select("type, link")
    .like("type", "expiry_%");
  if (exErr) {
    logger.error("expiry-scan", "existing-alerts fetch failed", { error: exErr });
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
  const seen = new Set(
    ((existing ?? []) as Array<{ type: string; link: string | null }>).map(
      (n) => `${n.type}|${n.link ?? ""}`,
    ),
  );

  let created = 0;
  let skipped = 0;

  for (const v of (vehicles ?? []) as unknown as VehicleRow[]) {
    const checks: Array<{ kind: "mot" | "tax"; date: string | null; label: string }> = [
      { kind: "mot", date: v.mot_expiry, label: "MOT expires" },
      { kind: "tax", date: v.tax_due_date, label: "Tax due" },
    ];

    for (const check of checks) {
      if (!check.date) continue;
      const days = daysUntil(check.date, now);
      // Already lapsed by more than a week → stale data, not an actionable
      // countdown; and far-future dates haven't crossed a threshold yet.
      if (days < -7) continue;
      const threshold = thresholdFor(Math.max(days, 0));
      if (threshold === null) continue;

      const type = `expiry_${check.kind}_${threshold}d`;
      const link = `/vehicles/${v.id}`;
      if (seen.has(`${type}|${link}`)) {
        skipped++;
        continue;
      }

      const name = [v.make, v.model].filter(Boolean).join(" ") || "vehicle";
      const when =
        days < 0
          ? `expired ${-days} day${days === -1 ? "" : "s"} ago`
          : days === 0
            ? "today"
            : `in ${days} day${days === 1 ? "" : "s"}`;
      const notified = await notifyUsersWithCapability({
        companyId: v.company_id,
        capability: "inventory:edit",
        notification: {
          type,
          title: `${check.label} ${when}: ${v.registration}`,
          body: `${name} (${v.registration}): ${check.label.toLowerCase()} ${check.date.slice(0, 10)}.`,
          link,
        },
      });
      if (notified > 0) {
        created++;
        seen.add(`${type}|${link}`);
      }
    }
  }

  logger.info("expiry-scan", "run complete", {
    vehiclesScanned: vehicles?.length ?? 0,
    alertsCreated: created,
    alertsSkipped: skipped,
  });
  return NextResponse.json({
    ok: true,
    scanned: vehicles?.length ?? 0,
    created,
    skipped,
  });
}
