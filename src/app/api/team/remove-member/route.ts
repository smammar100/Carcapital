/**
 * Remove a team member. The browser anon client can't do this — public.users
 * has no RLS DELETE policy (silent 0-row no-op) and ~14 tables FK-reference
 * users.id with ON DELETE RESTRICT, so a hard delete is impossible for anyone
 * with history. This service-role route does the right thing per member type:
 *
 *   - Pending invite (invited, never accepted, no auth.users row, no history)
 *     → hard delete the public.users row (the old "revoke invitation").
 *   - Established user → soft delete: active=false + ban the auth login so
 *     sessions are revoked, while preserving their historical records.
 *
 * Mirrors /api/team/create-with-password conventions.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface Body {
  userId?: string;
  actorId?: string;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const actorId = body.actorId?.trim();

  if (!userId || !actorId) {
    return NextResponse.json(
      { error: "userId and actorId are required" },
      { status: 400 },
    );
  }
  if (userId === actorId) {
    return NextResponse.json(
      { error: "You cannot remove yourself from the team." },
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

  const { data: target, error: loadErr } = await admin
    .from("users")
    .select(
      "id, company_id, name, email, is_super_user, invited_at, accepted_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json(
      { error: "Could not load the member" },
      { status: 502 },
    );
  }
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const companyId = target.company_id as string;

  // Guard: never strand a company without a super-administrator.
  if (target.is_super_user) {
    const { count } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_super_user", true)
      .neq("id", userId);
    if ((count ?? 0) === 0) {
      return NextResponse.json(
        {
          error:
            "Cannot remove the last super-administrator — promote someone else first.",
        },
        { status: 400 },
      );
    }
  }

  const isPendingInvite =
    target.invited_at !== null && target.accepted_at === null;

  let mode: "deleted" | "deactivated";

  if (isPendingInvite) {
    // No auth.users row, no FK history — safe to hard delete.
    const { error: delErr } = await admin
      .from("users")
      .delete()
      .eq("id", userId);
    if (delErr) {
      return NextResponse.json(
        { error: `Could not remove the invite: ${delErr.message}` },
        { status: 502 },
      );
    }
    mode = "deleted";
  } else {
    const { error: updErr } = await admin
      .from("users")
      .update({ active: false } as never)
      .eq("id", userId);
    if (updErr) {
      return NextResponse.json(
        { error: `Could not deactivate the member: ${updErr.message}` },
        { status: 502 },
      );
    }
    // Revoke login + reject session refresh. Best-effort: if there's no
    // matching auth.users row the profile deactivation already stands.
    await admin.auth.admin
      .updateUserById(userId, { ban_duration: "876000h" })
      .catch(() => {});
    mode = "deactivated";
  }

  await admin
    .from("activity_log")
    .insert({
      company_id: companyId,
      user_id: actorId,
      vehicle_id: null,
      action_type: "user_invited",
      description: `Removed ${target.name as string} (${target.email as string}) from the team`,
      metadata: { removedUserId: userId, mode },
    } as never)
    .then(
      () => {},
      () => {},
    );

  return NextResponse.json({ ok: true, mode });
}
