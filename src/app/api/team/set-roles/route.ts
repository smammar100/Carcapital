/**
 * Update a team member's role bundle — the backend for the in-grid role editor
 * (EditRolesDialog).
 *
 * Why a server route: the only RLS UPDATE policy on public.users is
 * `users_update_self` (id = auth.uid()), so an admin CANNOT change another
 * member's row from the browser — a client update silently matches zero rows.
 * This handler uses the service-role client (bypasses RLS) but gates the caller
 * with requireAnyCapability and applies the same guards as the rest of
 * /api/team/*.
 *
 * It also keeps the legacy `users.role` column in step with the new `roles[]`
 * via legacyRoleForRoles — several UI filters (salesperson / inspector pickers)
 * still key off that single column, and it is NOT NULL.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_DEFS, legacyRoleForRoles, type RoleValue } from "@/lib/roles";
import {
  requireUser,
  requireAnyCapability,
  authErrorResponse,
} from "@/lib/auth/require-user";

export const runtime = "nodejs";

const VALID_ROLES = new Set<string>(ROLE_DEFS.map((r) => r.value));

// camelCase alias so the updated row maps straight onto the `User` type.
const SELECT = `
  id,
  companyId:company_id,
  name,
  email,
  role,
  isSuperUser:is_super_user,
  roles,
  avatarUrl:avatar_url,
  active,
  invitedAt:invited_at,
  acceptedAt:accepted_at,
  lastLoginAt:last_login_at,
  twoStepEnabled:two_step_enabled,
  creationMode:creation_mode,
  passwordResetRequired:password_reset_required,
  activatedAt:activated_at,
  createdAt:created_at
`;

interface Body {
  userId?: string;
  roles?: string[];
}

export async function POST(request: Request) {
  // AuthZ: only a user/permission manager may change roles.
  let actor;
  try {
    actor = await requireUser();
    requireAnyCapability(actor, [
      "admin:manage_users",
      "admin:manage_permissions",
    ]);
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const roles = Array.isArray(body.roles) ? body.roles : [];

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (roles.length === 0) {
    return NextResponse.json(
      { error: "Select at least one role" },
      { status: 400 },
    );
  }
  const invalid = roles.find((r) => !VALID_ROLES.has(r));
  if (invalid) {
    return NextResponse.json({ error: `Unknown role: ${invalid}` }, { status: 400 });
  }
  // Owner == super-user; that grant is deliberate and out of scope here.
  if (roles.includes("owner")) {
    return NextResponse.json(
      { error: "The Owner / Super Administrator role can't be assigned here." },
      { status: 400 },
    );
  }
  // Prevent self-edit (lock-out / self-escalation) — mirrors remove-member.
  if (userId === actor.id) {
    return NextResponse.json(
      { error: "You can't change your own roles." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // Target must exist and live in the caller's company.
  const { data: target, error: tErr } = await admin
    .from("users")
    .select("id, company_id, is_super_user")
    .eq("id", userId)
    .maybeSingle();
  if (tErr) {
    return NextResponse.json(
      { error: "Could not load the member" },
      { status: 502 },
    );
  }
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  const t = target as { company_id: string; is_super_user: boolean };
  if (t.company_id !== actor.companyId) {
    return NextResponse.json(
      { error: "Member is not in your company" },
      { status: 403 },
    );
  }
  if (t.is_super_user) {
    return NextResponse.json(
      { error: "Super administrators are managed separately." },
      { status: 403 },
    );
  }

  const { data: updated, error: uErr } = await admin
    .from("users")
    .update({
      roles,
      role: legacyRoleForRoles(roles as RoleValue[]),
    } as never)
    .eq("id", userId)
    .select(SELECT)
    .single();
  if (uErr || !updated) {
    return NextResponse.json(
      { error: `Could not update roles: ${uErr?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ user: updated });
}
