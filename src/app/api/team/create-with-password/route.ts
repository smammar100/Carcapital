/**
 * Create a team member with an immediate password — the no-email alternative to
 * the email-invite flow. Two identity modes:
 *   - USERNAME (default for no-email dealerships): admin supplies a `username`;
 *     we mint an internal SYNTHETIC email `<username>@<slug>.staff.carcapital.uk`
 *     (never shown) so Supabase Auth works. Login is by username + password.
 *   - EMAIL (optional, for clients whose staff have emails): admin supplies a
 *     real `email`; behaves as before.
 *
 * Why a server route: minting an `auth.users` record requires the service-role
 * key. We create the auth user with `email_confirm: true` (no mail sent) and
 * upsert the matching `public.users` row in the ACCEPTED state, forcing a
 * password change on first login. The credentials are echoed back so the admin
 * can relay them out-of-band (WhatsApp / phone / in person).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { legacyRoleForRoles, type RoleValue } from "@/lib/roles";
import { sendCredentialsEmail } from "@/lib/email/send-invite";
import {
  isValidUsername,
  normalizeUsername,
  syntheticEmail,
} from "@/lib/auth/username";
import {
  requireUser,
  requireCapability,
  authErrorResponse,
} from "@/lib/auth/require-user";

export const runtime = "nodejs";

interface Body {
  email?: string;
  username?: string;
  password?: string;
  name?: string;
  roles?: RoleValue[];
  sendEmail?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function nameFromHandle(handle: string): string {
  return handle.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  const password = body.password ?? "";
  const roles = Array.isArray(body.roles) ? body.roles : [];
  const sendEmail = body.sendEmail === true;
  const username = body.username ? normalizeUsername(body.username) : null;
  const bodyEmail = body.email?.trim().toLowerCase() || null;

  // Exactly one identity: username (no-email) OR email.
  if (username && bodyEmail) {
    return NextResponse.json(
      { error: "Provide a username or an email, not both" },
      { status: 400 },
    );
  }
  if (!username && !bodyEmail) {
    return NextResponse.json(
      { error: "A username or email is required" },
      { status: 400 },
    );
  }
  if (username && !isValidUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Username must be 3–32 characters: lowercase letters, numbers, dot, underscore or hyphen (start/end alphanumeric).",
      },
      { status: 400 },
    );
  }
  if (bodyEmail && !EMAIL_RE.test(bodyEmail)) {
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
    return NextResponse.json({ error: "Select at least one role" }, { status: 400 });
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

  // Resolve the auth email: real (email accounts) or internal synthetic
  // (username accounts, scoped to the caller's dealership slug → globally
  // unique, so the same username in another dealership won't collide).
  let loginEmail: string;
  if (username) {
    const { data: coRow } = await admin
      .from("companies")
      .select("slug")
      .eq("id", companyId)
      .maybeSingle();
    const orgSlug = (coRow as unknown as { slug: string } | null)?.slug ?? null;
    if (!orgSlug) {
      return NextResponse.json(
        { error: "Dealership slug not configured" },
        { status: 500 },
      );
    }
    loginEmail = syntheticEmail(orgSlug, username);
  } else {
    loginEmail = bodyEmail!;
  }

  // Duplicate guard. Email accounts are pre-checked here; username uniqueness is
  // enforced by the synthetic-email global uniqueness + the partial unique index
  // (company_id, username) and surfaced as a clean 409 below.
  if (!username) {
    const { data: existing } = await admin
      .from("users")
      .select("id")
      .eq("email", loginEmail)
      .eq("company_id", companyId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists in this company" },
        { status: 409 },
      );
    }
  }

  const now = new Date().toISOString();
  const isSuperUser = roles.includes("owner");
  const memberName =
    body.name?.trim() ||
    (username ? nameFromHandle(username) : nameFromEmail(loginEmail));
  const legacyRole = legacyRoleForRoles(roles);

  // 1. Create the auth user (no email round-trip). A duplicate username produces
  //    a duplicate synthetic email → createUser fails here cleanly (no orphan).
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: { company_id: companyId, name: memberName, role: legacyRole },
  });
  if (authErr || !authData?.user) {
    const msg = authErr?.message ?? "";
    if (username && /already|exist|registered|duplicate/i.test(msg)) {
      return NextResponse.json(
        { error: "That username is already taken" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: msg || "Failed to create the auth user" },
      { status: 502 },
    );
  }
  const authUserId = authData.user.id;

  // 2. Provision the public.users profile row (no on_auth_user_created trigger
  //    exists, so we upsert it ourselves). Direct creation forces a password
  //    change on first login.
  const { error: rowErr } = await admin
    .from("users")
    .upsert(
      {
        id: authUserId,
        company_id: companyId,
        email: loginEmail,
        username,
        name: memberName,
        role: legacyRole,
        is_super_user: isSuperUser,
        roles,
        active: true,
        invited_at: null,
        accepted_at: now,
        two_step_enabled: false,
        creation_mode: "direct",
        password_reset_required: true,
        activated_at: null,
      } as never,
      { onConflict: "id" },
    );

  if (rowErr) {
    // Roll back the orphan auth user so a retry can succeed cleanly.
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    if (
      username &&
      ((rowErr as { code?: string }).code === "23505" ||
        /username/i.test(rowErr.message))
    ) {
      return NextResponse.json(
        { error: "That username is already taken" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: `Auth user created but profile creation failed: ${rowErr.message}` },
      { status: 502 },
    );
  }

  // 3. Optional credentials email — only for REAL-email accounts (synthetic
  //    addresses have no inbox; staff get their login relayed out-of-band).
  if (sendEmail && !username) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";
    const { data: co } = await admin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    await sendCredentialsEmail({
      recipientEmail: loginEmail,
      recipientName: memberName,
      companyName: (co?.name as string) ?? "your company",
      loginUrl: `${appUrl}/login`,
    }).catch(() => {});
  }

  // 4. Echo the credentials for out-of-band relay. For username accounts we
  //    return the USERNAME (never the internal synthetic email).
  return NextResponse.json({
    id: authUserId,
    username: username ?? null,
    email: username ? null : loginEmail,
    password,
  });
}
