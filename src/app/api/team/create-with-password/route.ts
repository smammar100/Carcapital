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
import { sendCredentialsEmail } from "@/lib/email/send-invite";
import {
  requireUser,
  requireCapability,
  authErrorResponse,
} from "@/lib/auth/require-user";

export const runtime = "nodejs";

interface Body {
  companyId?: string;
  email?: string;
  password?: string;
  name?: string;
  roles?: RoleValue[];
  sendEmail?: boolean;
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

  // AuthZ: only an admin who can manage users may create accounts. The new
  // member is created in the CALLER's company — never a body-supplied one.
  let actor;
  try {
    actor = await requireUser();
    requireCapability(actor, "admin:manage_users");
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const companyId = actor.companyId;
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const roles = Array.isArray(body.roles) ? body.roles : [];
  const sendEmail = body.sendEmail === true;

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

  const now = new Date().toISOString();
  const isSuperUser = roles.includes("owner");
  const memberName = body.name?.trim() || nameFromEmail(email);

  // 1. Create the auth user. The on_auth_user_created trigger auto-inserts the
  //    matching public.users row from user_metadata (company_id, name, role),
  //    so company_id MUST be passed here or the trigger fails with
  //    "Database error creating new user".
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { company_id: companyId, name: memberName, role: "sales" },
  });
  if (authErr || !authData?.user) {
    return NextResponse.json(
      { error: authErr?.message ?? "Failed to create the auth user" },
      { status: 502 },
    );
  }
  const authUserId = authData.user.id;

  // 2. The trigger created the base row; enrich it with roles/flags. Direct
  //    creation forces a password change on first login (SPEC Point 2).
  const { error: rowErr } = await admin
    .from("users")
    .update({
      name: memberName,
      is_super_user: isSuperUser,
      roles,
      active: true,
      invited_at: null,
      accepted_at: now,
      two_step_enabled: false,
      creation_mode: "direct",
      password_reset_required: true,
      activated_at: null,
    } as never)
    .eq("id", authUserId);

  if (rowErr) {
    // Roll back the orphan auth user so a retry can succeed cleanly.
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    return NextResponse.json(
      { error: `Auth user created but profile update failed: ${rowErr.message}` },
      { status: 502 },
    );
  }

  // Optionally notify the new member by email (login URL only — no password).
  if (sendEmail && email) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";
    const memberName = body.name?.trim() || nameFromEmail(email);
    const { data: co } = await admin
      .from("companies")
      .select("name")
      .eq("id", companyId!)
      .maybeSingle();
    await sendCredentialsEmail({
      recipientEmail: email,
      recipientName: memberName,
      companyName: (co?.name as string) ?? "your company",
      loginUrl: `${appUrl}/login`,
    }).catch(() => {});
  }

  return NextResponse.json({
    id: authUserId,
    email,
    // Echo the password back so the admin can copy + relay it. It was just
    // set by this same request — nothing newly sensitive is exposed.
    password,
  });
}
