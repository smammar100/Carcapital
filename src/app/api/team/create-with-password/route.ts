/**
 * Create a team member with an immediate password — the no-email alternative to
 * the email-invite flow. Two identity modes:
 *   - USERNAME (default for no-email dealerships): admin supplies a `username`;
 *     we mint an internal SYNTHETIC email `<username>@<slug>.staff.carcapital.uk`
 *     (never shown) so Supabase Auth works. Login is by username + password.
 *   - EMAIL (optional, for clients whose staff have emails): admin supplies a
 *     real `email`; behaves as before.
 *
 * Two access modes:
 *   - CAPABILITIES (default for the "Add staff" dialog): admin supplies a flat
 *     list of `capabilities` ("views"). The user is created with `roles: []` and
 *     the selected capabilities are written as per-user grants in
 *     `user_permissions`. No role bundles, no categories.
 *   - ROLES (legacy / email-invite tooling): admin supplies `roles[]`; the user
 *     inherits the role bundles' capabilities.
 *
 * Why a server route: minting an `auth.users` record requires the service-role
 * key. We create the auth user with `email_confirm: true` (no mail sent) and
 * upsert the matching `public.users` row, forcing a password change on first
 * login. The credentials are echoed back so the admin can relay them.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { legacyRoleForRoles, type RoleValue } from "@/lib/roles";
import { ALL_CAPABILITIES, type Capability } from "@/lib/capabilities";
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
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

interface Body {
  email?: string;
  username?: string;
  password?: string;
  name?: string;
  roles?: RoleValue[];
  capabilities?: string[];
  sendEmail?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAP_SET = new Set<string>(ALL_CAPABILITIES);

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

  // Per-actor limit: mints auth accounts.
  const limit = rateLimit(`create-user:${actor.id}`, {
    max: 15,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many accounts created at once — try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const companyId = actor.companyId;
  const password = body.password ?? "";
  const roles = Array.isArray(body.roles) ? body.roles : [];
  const sendEmail = body.sendEmail === true;
  const username = body.username ? normalizeUsername(body.username) : null;
  const bodyEmail = body.email?.trim().toLowerCase() || null;

  // Access mode: capabilities ("views") take precedence over roles.
  const rawCaps = Array.isArray(body.capabilities) ? body.capabilities : [];
  const invalidCap = rawCaps.find((c) => !CAP_SET.has(c));
  if (invalidCap) {
    return NextResponse.json(
      { error: `Unknown view/capability: ${invalidCap}` },
      { status: 400 },
    );
  }
  const capabilities = rawCaps as Capability[];
  const usingCaps = capabilities.length > 0;

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
  if (!usingCaps && roles.length === 0) {
    return NextResponse.json(
      { error: "Select at least one view to grant" },
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
  // Capability flow → no role bundle; roles flow → keep the bundles.
  const effectiveRoles: RoleValue[] = usingCaps ? [] : roles;
  const isSuperUser = !usingCaps && roles.includes("owner");
  const legacyRole = legacyRoleForRoles(effectiveRoles); // "sales" for []
  const memberName =
    body.name?.trim() ||
    (username ? nameFromHandle(username) : nameFromEmail(loginEmail));

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
  //    exists). Direct creation forces a password change on first login.
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
        roles: effectiveRoles,
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

  // 3. Capability flow → write the selected "views" as per-user grants.
  if (usingCaps) {
    const grantRows = capabilities.map((cap) => ({
      user_id: authUserId,
      capability: cap,
      granted_by: actor.id,
      granted_at: now,
    }));
    const { error: grantErr } = await admin
      .from("user_permissions")
      .insert(grantRows as never);
    if (grantErr) {
      // Roll back so a retry is clean (FK cascade also removes any partial grants).
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
      return NextResponse.json(
        { error: `Account created but granting views failed: ${grantErr.message}` },
        { status: 502 },
      );
    }
  }

  // 4. Optional credentials email — only for REAL-email accounts. A send
  //    failure must NOT fail the request (the account exists and the
  //    credentials are echoed below for out-of-band relay), but it must not
  //    be silent either: log it, notify the actor in-app, and tell the
  //    caller via `emailSent` so the UI can prompt a manual hand-off.
  let emailSent: boolean | null = null;
  if (sendEmail && !username) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";
    const { data: co } = await admin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    try {
      await sendCredentialsEmail({
        recipientEmail: loginEmail,
        recipientName: memberName,
        companyName: (co?.name as string) ?? "your company",
        loginUrl: `${appUrl}/login`,
      });
      emailSent = true;
    } catch (err) {
      emailSent = false;
      logger.error("team-create", "credentials email failed", {
        recipient: loginEmail,
        error: err instanceof Error ? err : String(err),
      });
      // Surface in the actor's notification bell (best-effort — the response
      // flag below is the guaranteed signal).
      await admin
        .from("notifications" as never)
        .insert({
          company_id: companyId,
          user_id: actor.id,
          type: "email_failed",
          title: "Credentials email not delivered",
          body: `The credentials email to ${memberName} (${loginEmail}) failed to send. Share the login details with them directly.`,
          link: "/admin/users-and-permissions",
          read: false,
        } as never)
        .then(
          () => {},
          (e) =>
            logger.warn("team-create", "failed to write email-failure notification", {
              error: e instanceof Error ? e : String(e),
            }),
        );
    }
  }

  // 5. Echo the credentials for out-of-band relay. For username accounts we
  //    return the USERNAME (never the internal synthetic email).
  return NextResponse.json({
    id: authUserId,
    username: username ?? null,
    email: username ? null : loginEmail,
    password,
    /** null = no email attempted; false = attempted and failed (relay manually). */
    emailSent,
  });
}
