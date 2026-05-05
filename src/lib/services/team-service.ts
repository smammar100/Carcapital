import { mockUsers } from "@/lib/mock-data";
import type { User, UUID } from "@/lib/types";
import type { RoleValue } from "@/lib/roles";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";

/**
 * Team management — Stripe-style invite / pending / accept lifecycle.
 *
 * A user is in one of three states:
 *  - **invited**: `invitedAt` set, `acceptedAt` null. Shows "Invitation sent"
 *    in the team table. No login allowed yet.
 *  - **active**: `acceptedAt` set. Has logged in at least once.
 *  - **deactivated**: `active` flag flipped off. Kept for audit; cannot log in.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InviteValidationError extends Error {}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const teamService = {
  async getAll(companyId: UUID): Promise<User[]> {
    // TODO: Supabase: from('users').select('*').eq('company_id', companyId)
    await delay();
    return mockUsers
      .filter((u) => u.companyId === companyId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async getById(userId: UUID): Promise<User | null> {
    await delay(100);
    return mockUsers.find((u) => u.id === userId) ?? null;
  },

  /**
   * Invite one or more team members. Each becomes a pending user with
   * `invitedAt` set and `acceptedAt: null`.
   *
   * Throws `InviteValidationError` on invalid email or empty role list.
   */
  async invite(input: {
    companyId: UUID;
    emails: string[];
    roles: RoleValue[];
    actorId: UUID;
  }): Promise<User[]> {
    // TODO: Supabase: insert pending user + send magic-link email via Resend / SendGrid
    if (input.emails.length === 0) {
      throw new InviteValidationError("At least one email address is required.");
    }
    if (input.roles.length === 0) {
      throw new InviteValidationError("Select at least one role.");
    }
    const invalid = input.emails.find((e) => !EMAIL_RE.test(e.trim()));
    if (invalid) {
      throw new InviteValidationError(`Invalid email address: ${invalid}`);
    }

    await delay();
    const created: User[] = [];
    const now = nowIso();
    const isSuperUser = input.roles.includes("owner");

    for (const rawEmail of input.emails) {
      const email = rawEmail.trim().toLowerCase();
      // Idempotent: skip if a user with that email already exists.
      const existing = mockUsers.find(
        (u) => u.email.toLowerCase() === email && u.companyId === input.companyId,
      );
      if (existing) continue;
      const user: User = {
        id: newId("user"),
        companyId: input.companyId,
        name: nameFromEmail(email),
        email,
        // Legacy display label; new flow drives off `roles[]` instead.
        role: "sales",
        isSuperUser,
        roles: [...input.roles],
        avatarUrl: null,
        invitedAt: now,
        acceptedAt: null,
        lastLoginAt: null,
        twoStepEnabled: false,
        active: true,
        createdAt: now,
      };
      mockUsers.push(user);
      created.push(user);
      await activityService.log({
        companyId: input.companyId,
        userId: input.actorId,
        vehicleId: null,
        actionType: "user_invited",
        description: `Invited ${email} as ${input.roles.join(", ")}`,
        metadata: { invitedUserId: user.id, roles: input.roles },
      });
    }
    return created;
  },

  /**
   * Re-send the invitation. Mocked — bumps `invitedAt` to "now" so the
   * table sort reflects the action.
   */
  async resendInvitation(userId: UUID, actorId: UUID): Promise<User> {
    await delay();
    const idx = mockUsers.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("User not found");
    if (mockUsers[idx].acceptedAt !== null) {
      throw new Error("User has already accepted their invitation");
    }
    mockUsers[idx] = { ...mockUsers[idx], invitedAt: nowIso() };
    await activityService.log({
      companyId: mockUsers[idx].companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited",
      description: `Re-sent invitation to ${mockUsers[idx].email}`,
      metadata: { invitedUserId: userId },
    });
    return mockUsers[idx];
  },

  /**
   * Cancel a pending invitation — removes the user record entirely.
   * Refuses to operate on accepted users (use deactivate instead).
   */
  async revokeInvitation(userId: UUID, actorId: UUID): Promise<void> {
    await delay();
    const idx = mockUsers.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("User not found");
    const target = mockUsers[idx];
    if (target.acceptedAt !== null) {
      throw new Error("Cannot revoke — user has already accepted");
    }
    mockUsers.splice(idx, 1);
    await activityService.log({
      companyId: target.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited",
      description: `Revoked invitation for ${target.email}`,
      metadata: { revokedUserId: userId },
    });
  },

  /**
   * Update an existing user's role list. No-op if user is super-user
   * (their access is governed by the flag, not roles).
   */
  async setRoles(userId: UUID, roles: RoleValue[], actorId: UUID): Promise<User> {
    await delay();
    const idx = mockUsers.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("User not found");
    mockUsers[idx] = { ...mockUsers[idx], roles: [...roles] };
    await activityService.log({
      companyId: mockUsers[idx].companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited",
      description: `Updated roles for ${mockUsers[idx].email}: ${roles.join(", ")}`,
      metadata: { targetUserId: userId, roles },
    });
    return mockUsers[idx];
  },

  /**
   * Mock accept-invitation. In production this would be triggered by the
   * recipient clicking a magic link in the invitation email.
   */
  async acceptInvitation(userId: UUID): Promise<User> {
    await delay(150);
    const idx = mockUsers.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("User not found");
    mockUsers[idx] = {
      ...mockUsers[idx],
      acceptedAt: nowIso(),
      lastLoginAt: nowIso(),
    };
    return mockUsers[idx];
  },

  isPending(user: User): boolean {
    return user.invitedAt !== null && user.acceptedAt === null;
  },

  /**
   * Permanently remove a member from the team. Distinct from `revokeInvitation`
   * (which is for pending users) — this is destructive removal of an active
   * accepted user.
   *
   * Safety rules:
   *  - Cannot remove yourself (use a different super-admin's session).
   *  - Cannot remove the last super-admin (would lock the dealership out).
   */
  async removeMember(userId: UUID, actorId: UUID): Promise<void> {
    await delay();
    const idx = mockUsers.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("User not found");
    if (userId === actorId) {
      throw new Error("You cannot remove yourself from the team.");
    }
    const target = mockUsers[idx];
    if (target.isSuperUser) {
      const otherSupers = mockUsers.filter(
        (u) => u.isSuperUser && u.id !== userId,
      );
      if (otherSupers.length === 0) {
        throw new Error(
          "Cannot remove the last super-administrator — promote someone else first.",
        );
      }
    }
    mockUsers.splice(idx, 1);
    await activityService.log({
      companyId: target.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited",
      description: `Removed ${target.name} (${target.email}) from the team`,
      metadata: { removedUserId: userId, roles: target.roles },
    });
  },
};
