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
import { legacyRoleForRoles, type RoleValue } from "@/lib/roles";

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

  // 1. Resolve the token. Check targeted single-use invitations first, then
  //    fall back to the shared reusable team_join_links magic-link.
  let companyId: string;
  let defaultRoles: string[];
  let invitationToken: string | null = null;

  const { data: invitation, error: invErr } = await admin
    .from("team_invitations" as never)
    .select("company_id, default_roles, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (invErr) {
    return NextResponse.json(
      { error: "Could not validate the join link" },
      { status: 502 },
    );
  }

  if (invitation) {
    const inv = invitation as {
      company_id: string;
      default_roles: string[];
      expires_at: string;
      used_at: string | null;
    };
    if (inv.used_at) {
      return NextResponse.json(
        { error: "This invitation link has already been used" },
        { status: 409 },
      );
    }
    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invitation link has expired. Ask your manager to send a new one." },
        { status: 410 },
      );
    }
    companyId = inv.company_id;
    defaultRoles = inv.default_roles.length > 0 ? inv.default_roles : ["view_only"];
    invitationToken = token;
  } else {
    // Fall back to shared magic-link (team_join_links).
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
    companyId = link.company_id as string;
    defaultRoles = [(link.default_role as string) || "view_only"];
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
      { error: "An account with that email already exists for this team" },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const memberName = body.name?.trim() || nameFromEmail(email);

  // 2. Create the auth user (no email round-trip). We provision the matching
  //    public.users row ourselves in step 3 — this codebase has NO
  //    on_auth_user_created trigger, so relying on one would leave the joiner
  //    with an auth account but no profile (null company/roles → no access).
  const legacyRole = legacyRoleForRoles(defaultRoles as RoleValue[]);
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { company_id: companyId, name: memberName, role: legacyRole },
  });
  if (authErr || !authData?.user) {
    return NextResponse.json(
      { error: authErr?.message ?? "Failed to create the account" },
      { status: 502 },
    );
  }
  const authUserId = authData.user.id;

  // 3. Provision the public.users profile row in the ACCEPTED state. UPSERT on
  //    the primary key so this is correct whether or not a base row already
  //    exists — no hidden trigger dependency. company_id, email and role are
  //    NOT NULL so they MUST be set here. The joiner chose their own password,
  //    so no forced reset.
  const { error: rowErr } = await admin
    .from("users")
    .upsert(
      {
        id: authUserId,
        company_id: companyId,
        email,
        name: memberName,
        role: legacyRole,
        roles: defaultRoles,
        is_super_user: false,
        active: true,
        invited_at: null,
        accepted_at: now,
        two_step_enabled: false,
        creation_mode: "direct",
        password_reset_required: false,
        activated_at: now,
      } as never,
      { onConflict: "id" },
    );

  if (rowErr) {
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    return NextResponse.json(
      { error: `Account created but profile creation failed: ${rowErr.message}` },
      { status: 502 },
    );
  }

  // 4. Mark single-use invitation as consumed so the link can't be reused.
  if (invitationToken) {
    try {
      await admin
        .from("team_invitations" as never)
        .update({ used_at: now } as never)
        .eq("token", invitationToken);
    } catch {
      /* best-effort — the account is already created */
    }
  }

  return NextResponse.json({ ok: true, email });
}
