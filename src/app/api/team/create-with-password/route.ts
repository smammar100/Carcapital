/**
 * Create a team member with an immediate password — the alternative to the
 * email-invite flow ("Any alternative of creating a member instead of email
 * invite?").
 *
 * Why a server route: minting an `auth.users` record requires the Supabase
 * service-role key, which must never reach the browser. This handler uses
 * `createAdminClient()` (service-role) to:
 *   1. create the auth user with `email_confirm: true` (no email round-trip)
 *   2. insert the matching `public.users` row in the ACCEPTED state
 *      (`accepted_at = now`, `invited_at = null`) so the user can sign in
 *      straight away with the credentials the admin relays to them.
 *
 * The email-invite path (`teamService.invite`) is untouched.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RoleValue } from "@/lib/roles";

export const runtime = "nodejs";

interface Body {
  companyId?: string;
  email?: string;
  password?: string;
  name?: string;
  roles?: RoleValue[];
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

  const companyId = body.companyId?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const roles = Array.isArray(body.roles) ? body.roles : [];

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
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
  if (roles.length === 0) {
    return NextResponse.json(
      { error: "Select at least one role" },
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

  // Guard: don't create a duplicate within the same company.
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .eq("company_id", companyId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists in this company" },
      { status: 409 },
    );
  }

  // 1. Create the auth user (no confirmation email — admin relays creds).
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authData?.user) {
    return NextResponse.json(
      { error: authErr?.message ?? "Failed to create the auth user" },
      { status: 502 },
    );
  }
  const authUserId = authData.user.id;

  // 2. Insert the matching public.users row in the accepted state.
  const now = new Date().toISOString();
  const isSuperUser = roles.includes("owner");
  const { error: rowErr } = await admin.from("users").insert({
    id: authUserId,
    company_id: companyId,
    name: body.name?.trim() || nameFromEmail(email),
    email,
    role: "sales",
    is_super_user: isSuperUser,
    roles,
    active: true,
    invited_at: null,
    accepted_at: now,
    last_login_at: null,
    two_step_enabled: false,
  } as never);

  if (rowErr) {
    // Roll back the orphan auth user so a retry can succeed cleanly.
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    return NextResponse.json(
      { error: `Auth user created but profile insert failed: ${rowErr.message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    id: authUserId,
    email,
    // Echo the password back so the admin can copy + relay it. It was just
    // set by this same request — nothing newly sensitive is exposed.
    password,
  });
}
