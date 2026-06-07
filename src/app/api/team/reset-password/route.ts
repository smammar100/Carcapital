/**
 * Admin password reset for a team member — the no-email equivalent of
 * self-service "forgot password" (synthetic-email staff have no inbox). The
 * admin generates a fresh temporary password and relays it out-of-band; the
 * member is forced to set their own on next login.
 *
 * Modeled on /api/team/set-roles: service-role admin client, gated by
 * requireAnyCapability, with the same target guards (same company, not self,
 * not a super-user).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireUser,
  requireAnyCapability,
  authErrorResponse,
} from "@/lib/auth/require-user";

export const runtime = "nodejs";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const rnd = new Uint32Array(14);
  crypto.getRandomValues(rnd);
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[rnd[i] % chars.length];
  return `${out}!9`;
}

interface Body {
  userId?: string;
}

export async function POST(request: Request) {
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
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (userId === actor.id) {
    return NextResponse.json(
      { error: "You can't reset your own password here." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  const { data: target, error: tErr } = await admin
    .from("users")
    .select("id, company_id, is_super_user, username, email")
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
  const t = target as unknown as {
    company_id: string;
    is_super_user: boolean;
    username: string | null;
    email: string;
  };
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

  const password = generatePassword();
  const { error: uErr } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (uErr) {
    return NextResponse.json(
      { error: `Could not reset password: ${uErr.message}` },
      { status: 502 },
    );
  }

  // Force the member to choose their own password on next login.
  await admin
    .from("users")
    .update({ password_reset_required: true } as never)
    .eq("id", userId);

  // Surface the new credential for out-of-band relay. Username accounts return
  // the username; email accounts return the email.
  return NextResponse.json({
    username: t.username,
    email: t.username ? null : t.email,
    password,
  });
}
