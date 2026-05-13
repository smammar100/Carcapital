import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { UserPermission, UUID } from "@/lib/types";
import type { Capability } from "@/lib/capabilities";
import { capabilitiesForRoles } from "@/lib/roles";
import { authService } from "./auth-service";
import { activityService } from "./activity-service";

const NS = "perms:";

const SELECT = `
  id,
  userId:user_id,
  capability,
  grantedBy:granted_by,
  grantedAt:granted_at
`;

export const permissionService = {
  async getForUser(userId: UUID): Promise<UserPermission[]> {
    return withCache(`${NS}user:${userId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_permissions")
        .select(SELECT)
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as unknown as UserPermission[];
    });
  },

  async effectiveCapabilities(userId: UUID): Promise<Set<Capability>> {
    const u = await authService.getUser(userId);
    if (!u) return new Set();
    const fromRoles = capabilitiesForRoles(u.roles);
    const grants = await permissionService.getForUser(userId);
    for (const p of grants) fromRoles.add(p.capability as Capability);
    return fromRoles;
  },

  async userHas(userId: UUID, capability: Capability): Promise<boolean> {
    const u = await authService.getUser(userId);
    if (!u) return false;
    if (u.isSuperUser) return true;
    const caps = capabilitiesForRoles(u.roles);
    if (caps.has(capability)) return true;
    const supabase = createClient();
    const { count, error } = await supabase
      .from("user_permissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("capability", capability);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async setForUser(
    userId: UUID,
    capabilities: Capability[],
    actorId: UUID,
  ): Promise<UserPermission[]> {
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("set_user_permissions", {
      p_user_id: userId,
      p_capabilities: capabilities,
      p_granted_by: actorId,
    });
    if (rpcErr) throw rpcErr;
    invalidate(NS);

    const grants = await permissionService.getForUser(userId);
    const target = await authService.getUser(userId);
    if (target) {
      await activityService.log({
        companyId: target.companyId,
        userId: actorId,
        vehicleId: null,
        actionType: "user_invited",
        description: `Permissions updated for ${target.name} — ${capabilities.length} capabilities granted`,
        metadata: { targetUserId: userId, capabilities },
      });
    }
    return grants;
  },

  async setSuperUser(
    userId: UUID,
    isSuperUser: boolean,
    actorId: UUID,
  ): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ is_super_user: isSuperUser })
      .eq("id", userId);
    if (error) throw error;
    invalidate("auth:");
    invalidate("team:");
    const target = await authService.getUser(userId);
    if (target) {
      await activityService.log({
        companyId: target.companyId,
        userId: actorId,
        vehicleId: null,
        actionType: "user_invited",
        description: `${target.name} super-user flag set to ${isSuperUser}`,
        metadata: { targetUserId: userId, isSuperUser },
      });
    }
  },
};
