import { mockUserPermissions, mockUsers } from "@/lib/mock-data";
import type { UserPermission, UUID } from "@/lib/types";
import type { Capability } from "@/lib/capabilities";
import { capabilitiesForRoles } from "@/lib/roles";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";

/**
 * v4.1 Gap 3 — per-user capability grants.
 *
 * Super-users (User.isSuperUser === true) bypass these checks entirely. The
 * service still tracks their explicit grants for audit purposes if any are set.
 */
export const permissionService = {
  async getForUser(userId: UUID): Promise<UserPermission[]> {
    // TODO: Supabase: from('user_permissions').select('*').eq('user_id', userId)
    await delay(150);
    return mockUserPermissions.filter((p) => p.userId === userId);
  },

  /**
   * Compute the effective capability set for a user:
   *   1. If `isSuperUser`, return all capabilities (caller treats as "any").
   *   2. Union of capabilities granted by every assigned role.
   *   3. Plus any explicit grants in `mockUserPermissions` (overrides).
   */
  async effectiveCapabilities(userId: UUID): Promise<Set<Capability>> {
    await delay(50);
    const u = mockUsers.find((x) => x.id === userId);
    if (!u) return new Set();
    const fromRoles = capabilitiesForRoles(u.roles);
    for (const p of mockUserPermissions) {
      if (p.userId === userId) fromRoles.add(p.capability as Capability);
    }
    return fromRoles;
  },

  async userHas(userId: UUID, capability: Capability): Promise<boolean> {
    // TODO: Supabase: select 1 from user_permissions where user_id=$1 and capability=$2
    await delay(50);
    const u = mockUsers.find((x) => x.id === userId);
    if (!u) return false;
    if (u.isSuperUser) return true;
    const caps = capabilitiesForRoles(u.roles);
    if (caps.has(capability)) return true;
    return mockUserPermissions.some(
      (p) => p.userId === userId && p.capability === capability,
    );
  },

  /**
   * Replace the user's grants with the supplied list. Returns the new set.
   * Adds an activity log entry summarising what changed.
   */
  async setForUser(
    userId: UUID,
    capabilities: Capability[],
    actorId: UUID,
  ): Promise<UserPermission[]> {
    // TODO: Supabase: transaction — delete then bulk insert
    await delay();
    // Remove existing rows for this user
    for (let i = mockUserPermissions.length - 1; i >= 0; i--) {
      if (mockUserPermissions[i].userId === userId) {
        mockUserPermissions.splice(i, 1);
      }
    }
    // Insert fresh
    for (const cap of capabilities) {
      mockUserPermissions.push({
        id: newId("perm"),
        userId,
        capability: cap,
        grantedBy: actorId,
        grantedAt: nowIso(),
      });
    }
    const target = mockUsers.find((x) => x.id === userId);
    await activityService.log({
      companyId: target?.companyId ?? "company-1",
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited", // closest existing action type — replace with "permission_changed" once added
      description: `Permissions updated for ${target?.name ?? userId} — ${capabilities.length} capabilities granted`,
      metadata: { targetUserId: userId, capabilities },
    });
    return mockUserPermissions.filter((p) => p.userId === userId);
  },

  async setSuperUser(
    userId: UUID,
    isSuperUser: boolean,
    actorId: UUID,
  ): Promise<void> {
    await delay(150);
    const idx = mockUsers.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("User not found");
    mockUsers[idx] = { ...mockUsers[idx], isSuperUser };
    await activityService.log({
      companyId: mockUsers[idx].companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited",
      description: `${mockUsers[idx].name} super-user flag set to ${isSuperUser}`,
      metadata: { targetUserId: userId, isSuperUser },
    });
  },
};
