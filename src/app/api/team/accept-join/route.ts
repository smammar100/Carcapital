/**
 * Consume a company magic-link (the email-free join alternative). The
 * visitor is unauthenticated and has no company context, so the token →
 * company lookup and the auth.users creation both need the service-role
 * key and must run here, server-side.
 *
 * Flow:
 *   1. resolve `token` → team_join_links row (company_id + default_role)
 *   2. create the auth user with `email_confirm: true` (no email round-trip)
 *   3. insert the matching public.users row in the ACCEPTED state with the
 *      link's default role — the joiner picked their own password, so no
 *      forced reset (unlike admin create-with-password).
 *
 * Mirrors /api/team/create-with-password conventions.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface Body {
  token?: string;
  email?: string;
  password?: string;
  name?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!token) {
    return NextResponse.json({ error: "Missing join token" }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

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

  // 1. Resolve the token (service-role bypasses RLS — visitor has no JWT).
  const { data: link, error: linkErr } = await admin
    .from("team_join_links")
    .select("company_id, default_role")
    .eq("token", token)
    .maybeSingle();
  if (linkErr) {
    return NextResponse.json(
      { error: "Could not validate the join link" },
      { status: 502 },
    );
  }
  if (!link) {
    return NextResponse.json(
      { error: "This join link is invalid or has been reset" },
      { status: 404 },
    );
  }
  const companyId = link.company_id as string;
  const defaultRole = (link.default_role as string) || "view_only";

  // Guard: don't create a duplicate within the same company.
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .eq("company_id", companyId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists for this team" },
      { status: 409 },
    );
  }

  // 2. Create the auth user (no confirmation email — joiner set the password).
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authData?.user) {
    return NextResponse.json(
      { error: authErr?.message ?? "Failed to create the account" },
      { status: 502 },
    );
  }
  const authUserId = authData.user.id;

  // 3. Insert the matching public.users row in the accepted state.
  const now = new Date().toISOString();
  const { error: rowErr } = await admin.from("users").insert({
    id: authUserId,
    company_id: companyId,
    name: body.name?.trim() || nameFromEmail(email),
    email,
    role: "sales",
    is_super_user: false,
    roles: [defaultRole],
    active: true,
    invited_at: null,
    accepted_at: now,
    last_login_at: null,
    two_step_enabled: false,
    creation_mode: "direct",
    // The joiner chose their own password — no forced reset.
    password_reset_required: false,
    activated_at: now,
  } as never);

  if (rowErr) {
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    return NextResponse.json(
      { error: `Account created but profile insert failed: ${rowErr.message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, email });
}
