/**
 * Fan out a "new lead" notification to everyone who works leads.
 *
 * Leads are created client-side (lead-service.ts), but RLS forbids clients
 * writing notifications for OTHER users (migration 0034) — so the service
 * calls this route fire-and-forget after a successful insert. The
 * notification content is derived SERVER-SIDE from the lead row (never from
 * client-supplied text), so the worst a malicious caller can do is re-announce
 * a lead that already exists in their own company.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUsersWithCapability } from "@/lib/server/notify";
import {
  requireUser,
  authErrorResponse,
} from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const limit = rateLimit(`notify-lead:${actor.id}`, {
    max: 30,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { leadId?: string };
  try {
    body = (await request.json()) as { leadId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const leadId = body.leadId?.trim();
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  // Load the lead server-side and verify it belongs to the caller's company.
  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("leads")
    .select("id, company_id, customer_name, vehicle_interest")
    .eq("id", leadId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
  if (!lead || (lead as { company_id: string }).company_id !== actor.companyId) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { customer_name, vehicle_interest } = lead as {
    customer_name: string | null;
    vehicle_interest: string | null;
  };

  const notified = await notifyUsersWithCapability({
    companyId: actor.companyId,
    capability: "sales:edit_lead",
    exceptUserId: actor.id,
    notification: {
      type: "lead_created",
      title: `New lead: ${customer_name ?? "Unknown"}`,
      body: vehicle_interest
        ? `Interested in ${vehicle_interest}`
        : undefined,
      link: "/sales/leads",
    },
  });

  return NextResponse.json({ ok: true, notified });
}
