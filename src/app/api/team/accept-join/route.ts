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
import { rateLimit, clientIp } from "@/lib/rate-limit";

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
  // Unauthenticated + creates accounts → tight per-IP limit. Also blunts
  // token brute-forcing against the join-link lookup below.
  const limit = rateLimit(`accept-join:${clientIp(request)}`, {
    max: 10,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts, try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

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
  let joinLinkToken: string | null = null;
  let joinLinkUsedCount = 0;

  /** Release the use slot claimed on the shared link so a retry can succeed. */
  const releaseJoinLinkSlot = async () => {
    if (!joinLinkToken) return;
    await admin
      .from("team_join_links")
      .update({ used_count: joinLinkUsedCount - 1 } as never)
      .eq("token", joinLinkToken)
      .eq("used_count", joinLinkUsedCount)
      .then(() => {}, () => {});
  };

  const { data: invitation, error: invErr } = await admin
    .from("team_invitations" as never)
    .select("company_id, default_roles, expires_at, used_at, recipient_email")
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
      recipient_email: string | null;
    };
    // Targeted invitations are bound to a specific recipient — the redeemer
    // must sign up under the invited email. Without this, anyone holding the
    // token could redeem it under an arbitrary email of their choosing.
    if (
      inv.recipient_email &&
      inv.recipient_email.trim().toLowerCase() !== email
    ) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address." },
        { status: 403 },
      );
    }
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
    // Atomically consume the single-use token BEFORE creating the auth user.
    // The early `used_at` read above is racy (TOCTOU): two concurrent
    // redemptions can both pass it. This conditional update is the real guard
    // — only one request can flip `used_at` from null, and a 0-row result means
    // another redemption already claimed it. If account creation later fails we
    // roll `used_at` back so a legitimate retry can succeed.
    const { data: claimed, error: claimErr } = await admin
      .from("team_invitations" as never)
      .update({ used_at: new Date().toISOString() } as never)
      .eq("token", token)
      .is("used_at", null)
      .select("token");
    if (claimErr) {
      return NextResponse.json(
        { error: "Could not validate the join link" },
        { status: 502 },
      );
    }
    if (!claimed || claimed.length === 0) {
      return NextResponse.json(
        { error: "This invitation link has already been used" },
        { status: 409 },
      );
    }
    companyId = inv.company_id;
    defaultRoles = inv.default_roles.length > 0 ? inv.default_roles : ["view_only"];
    invitationToken = token;
  } else {
    // Fall back to shared magic-link (team_join_links).
    const { data: link, error: linkErr } = await admin
      .from("team_join_links")
      .select("company_id, default_role, expires_at, max_uses, used_count, revoked_at")
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
    const shared = link as {
      company_id: string;
      default_role: string | null;
      expires_at: string | null;
      max_uses: number | null;
      used_count: number | null;
      revoked_at: string | null;
    };
    // Expiry / revocation / use-cap gates (migration 0033), mirroring the
    // team_invitations checks above. `expires_at` is nullable in the type only
    // for pre-migration rows — treat NULL as expired rather than immortal.
    if (shared.revoked_at) {
      return NextResponse.json(
        { error: "This join link has been revoked. Ask your manager for a new one." },
        { status: 410 },
      );
    }
    if (!shared.expires_at || new Date(shared.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This join link has expired. Ask your manager to reset it." },
        { status: 410 },
      );
    }
    if (shared.max_uses !== null && (shared.used_count ?? 0) >= shared.max_uses) {
      return NextResponse.json(
        { error: "This join link has reached its usage limit. Ask your manager to reset it." },
        { status: 410 },
      );
    }
    // Atomically claim a use slot BEFORE creating the auth user — the read
    // above is racy under concurrency (same TOCTOU as team_invitations). The
    // conditional increment only succeeds while the cap and expiry still hold;
    // 0 rows means another redemption beat us to the last slot. Rolled back on
    // downstream failure so a legitimate retry still works.
    const { data: slot, error: slotErr } = await admin
      .from("team_join_links")
      .update({ used_count: (shared.used_count ?? 0) + 1 } as never)
      .eq("token", token)
      .eq("used_count", shared.used_count ?? 0)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("token");
    if (slotErr) {
      return NextResponse.json(
        { error: "Could not validate the join link" },
        { status: 502 },
      );
    }
    if (!slot || slot.length === 0) {
      return NextResponse.json(
        { error: "This join link is no longer available. Ask your manager to reset it." },
        { status: 409 },
      );
    }
    joinLinkToken = token;
    joinLinkUsedCount = (shared.used_count ?? 0) + 1;
    companyId = shared.company_id;
    defaultRoles = [shared.default_role || "view_only"];
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
    // Release the single-use token we claimed above so a legitimate retry works.
    if (invitationToken) {
      await admin
        .from("team_invitations" as never)
        .update({ used_at: null } as never)
        .eq("token", invitationToken)
        .then(() => {}, () => {});
    }
    await releaseJoinLinkSlot();
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
    // Release the claimed token so the joiner can retry after a transient failure.
    if (invitationToken) {
      await admin
        .from("team_invitations" as never)
        .update({ used_at: null } as never)
        .eq("token", invitationToken)
        .then(() => {}, () => {});
    }
    await releaseJoinLinkSlot();
    return NextResponse.json(
      { error: `Account created but profile creation failed: ${rowErr.message}` },
      { status: 502 },
    );
  }

  // The single-use invitation was already atomically consumed up-front (see the
  // conditional `used_at` claim above), so no further marking is needed here.

  return NextResponse.json({ ok: true, email });
}
