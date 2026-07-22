/**
 * Send a targeted single-use invite email to a specific staff member.
 *
 * Creates a row in team_invitations (single-use token, 7-day expiry) and
 * sends a branded email via Resend. The recipient clicks the link, lands on
 * /join/[token], sets their own password, and is added to the company.
 *
 * This replaces the old teamService.invite() stub which created a public.users
 * row in "invited" state but never sent any email.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_DEFS, type RoleValue } from "@/lib/roles";
import { sendStaffInviteEmail } from "@/lib/email/send-invite";
import {
  requireUser,
  requireCapability,
  authErrorResponse,
} from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Body {
  companyId?: string;
  recipientEmail?: string;
  recipientName?: string;
  roles?: RoleValue[];
  invitedByName?: string;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // AuthZ: only an admin who can manage users may invite. Invitations are
  // scoped to the CALLER's company; body companyId is ignored.
  let actor;
  try {
    actor = await requireUser();
    requireCapability(actor, "admin:manage_users");
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  // Per-actor limit: sends email + writes invitation rows.
  const limit = rateLimit(`send-invite:${actor.id}`, {
    max: 20,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many invitations at once, try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const companyId = actor.companyId;
  const recipientEmail = body.recipientEmail?.trim().toLowerCase();
  const roles = Array.isArray(body.roles) ? body.roles : [];
  const invitedByName = body.invitedByName?.trim() || "Your manager";
  const recipientName =
    body.recipientName?.trim() ||
    (recipientEmail ? nameFromEmail(recipientEmail) : "there");

  if (!recipientEmail || !EMAIL_RE.test(recipientEmail))
    return NextResponse.json(
      { error: "A valid recipient email address is required" },
      { status: 400 },
    );
  if (roles.length === 0)
    return NextResponse.json(
      { error: "Select at least one role" },
      { status: 400 },
    );

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Admin client unavailable (SUPABASE_SERVICE_ROLE_KEY missing)",
      },
      { status: 500 },
    );
  }

  // Resolve company name for the email.
  const { data: company, error: companyErr } = await admin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  if (companyErr || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // Create a single-use token in team_invitations.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { data: invitation, error: insertErr } = await admin
    .from("team_invitations" as never)
    .insert({
      company_id: companyId,
      recipient_email: recipientEmail,
      default_roles: roles,
      expires_at: expiresAt.toISOString(),
    } as never)
    .select("token")
    .single();

  if (insertErr || !invitation) {
    return NextResponse.json(
      {
        error: insertErr?.message ?? "Failed to create invitation record",
      },
      { status: 502 },
    );
  }

  const token = (invitation as { token: string }).token;

  // Build the invite URL from the request origin so the link always points at
  // the host the admin is actually using (handles dev autoPort, previews, prod).
  // Falls back to NEXT_PUBLIC_APP_URL, then localhost.
  const hdrOrigin = request.headers.get("origin");
  const hdrHost = request.headers.get("host");
  const appUrl =
    hdrOrigin ??
    (hdrHost ? `http://${hdrHost}` : null) ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const inviteUrl = `${appUrl}/join/${token}`;

  // Map RoleValue[] → human-readable labels for the email body.
  const roleLabels = roles.map(
    (r) => ROLE_DEFS.find((d) => d.value === r)?.label ?? r,
  );

  // Send the invite email.
  try {
    await sendStaffInviteEmail({
      recipientEmail,
      recipientName,
      companyName: company.name as string,
      invitedByName,
      roleLabels,
      inviteUrl,
      expiresAt,
    });
  } catch (err) {
    // Roll back the invitation row so a retry won't hit a unique-token conflict.
    try {
      await admin
        .from("team_invitations" as never)
        .delete()
        .eq("token", token);
    } catch {
      /* best-effort rollback */
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Email delivery failed: ${err.message}`
            : "Email delivery failed",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, token });
}
