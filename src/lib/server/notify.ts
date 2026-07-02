/**
 * Server-side notification fan-out — the write half of the notification bell
 * (notifications-context.tsx + notification-service.ts are the read half).
 *
 * RLS deliberately has no INSERT policy on notifications (migration 0034):
 * rows targeting OTHER users can only be written here, with the service-role
 * client, so a client can never spoof notifications into someone else's bell.
 *
 * Targeting is by capability: "everyone who can edit leads", not a hardcoded
 * role list — mirrors requireCapability's semantics (role bundles + per-user
 * grants + super-user bypass).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { capabilitiesForRoles, type RoleValue } from "@/lib/roles";
import type { Capability } from "@/lib/capabilities";
import { logger } from "@/lib/logger";

export interface NotifyPayload {
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Insert a notification for every ACTIVE user in `companyId` who holds
 * `capability` (via role bundles, per-user grants, or super-user), except
 * `exceptUserId` (usually the actor — no self-notifications).
 *
 * Best-effort by design: failures are logged, never thrown — a notification
 * must not break the mutation it decorates. Returns the number notified.
 */
export async function notifyUsersWithCapability(opts: {
  companyId: string;
  capability: Capability;
  exceptUserId?: string;
  notification: NotifyPayload;
}): Promise<number> {
  const { companyId, capability, exceptUserId, notification } = opts;
  try {
    const admin = createAdminClient();

    const { data: users, error: uErr } = await admin
      .from("users")
      .select("id, roles, is_super_user, active")
      .eq("company_id", companyId)
      .eq("active", true);
    if (uErr) throw uErr;

    const userIds = (users ?? []).map((u) => (u as { id: string }).id);
    const { data: grants, error: gErr } = await admin
      .from("user_permissions")
      .select("user_id")
      .eq("capability", capability)
      .in("user_id", userIds);
    if (gErr) throw gErr;

    const grantedUserIds = new Set(
      (grants ?? []).map((g) => (g as { user_id: string }).user_id),
    );

    const targets = (users ?? [])
      .map((u) => u as unknown as {
        id: string;
        roles: RoleValue[] | null;
        is_super_user: boolean;
      })
      .filter((u) => u.id !== exceptUserId)
      .filter(
        (u) =>
          u.is_super_user === true ||
          grantedUserIds.has(u.id) ||
          capabilitiesForRoles(u.roles ?? []).has(capability),
      );

    if (targets.length === 0) return 0;

    const rows = targets.map((u) => ({
      company_id: companyId,
      user_id: u.id,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
      link: notification.link ?? null,
      read: false,
    }));

    const { error: insErr } = await admin
      .from("notifications" as never)
      .insert(rows as never);
    if (insErr) throw insErr;
    return targets.length;
  } catch (e) {
    logger.error("notify", "fan-out failed", {
      capability,
      type: notification.type,
      error: e instanceof Error ? e : String(e),
    });
    return 0;
  }
}
