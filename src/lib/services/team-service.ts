import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User, UUID } from "@/lib/types";
import type { RoleValue } from "@/lib/roles";
import { activityService } from "./activity-service";

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
  createdAt:created_at
`;

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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select(SELECT)
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as User[];
  },

  async getById(userId: UUID): Promise<User | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select(SELECT)
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as User | null;
  },

  /**
   * Invite via Supabase Auth: creates an unconfirmed auth user and a matching
   * public.users row in the invited state. Must run server-side (uses the
   * service-role key). For now we treat this as a server action equivalent —
   * adjust to a route handler when wired up to the team UI.
   */
  async invite(input: {
    companyId: UUID;
    emails: string[];
    roles: RoleValue[];
    actorId: UUID;
  }): Promise<User[]> {
    if (input.emails.length === 0) {
      throw new InviteValidationError(
        "At least one email address is required.",
      );
    }
    if (input.roles.length === 0) {
      throw new InviteValidationError("Select at least one role.");
    }
    const invalid = input.emails.find((e) => !EMAIL_RE.test(e.trim()));
    if (invalid) {
      throw new InviteValidationError(`Invalid email address: ${invalid}`);
    }

    const admin = createAdminClient();
    const supabase = createClient();
    const isSuperUser = input.roles.includes("owner");
    const created: User[] = [];
    const now = new Date().toISOString();

    for (const rawEmail of input.emails) {
      const email = rawEmail.trim().toLowerCase();
      // Skip if a user with this email already exists in the company.
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .eq("company_id", input.companyId)
        .maybeSingle();
      if (existing) continue;

      const { data: authData, error: authErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: nameFromEmail(email) },
      });
      if (authErr || !authData.user) {
        throw authErr ?? new Error(`Failed to invite ${email}`);
      }

      const { data, error } = await supabase
        .from("users")
        .insert({
          id: authData.user.id,
          company_id: input.companyId,
          name: nameFromEmail(email),
          email,
          role: "sales",
          is_super_user: isSuperUser,
          roles: input.roles,
          active: true,
          invited_at: now,
          accepted_at: null,
          last_login_at: null,
          two_step_enabled: false,
        })
        .select(SELECT)
        .single();
      if (error) throw error;
      const user = data as unknown as User;
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

  async resendInvitation(userId: UUID, actorId: UUID): Promise<User> {
    const supabase = createClient();
    const admin = createAdminClient();
    const u = await teamService.getById(userId);
    if (!u) throw new Error("User not found");
    if (u.acceptedAt !== null) {
      throw new Error("User has already accepted their invitation");
    }
    await admin.auth.admin.inviteUserByEmail(u.email);
    const { data, error } = await supabase
      .from("users")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", userId)
      .select(SELECT)
      .single();
    if (error) throw error;
    const updated = data as unknown as User;
    await activityService.log({
      companyId: updated.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited",
      description: `Re-sent invitation to ${updated.email}`,
      metadata: { invitedUserId: userId },
    });
    return updated;
  },

  async revokeInvitation(userId: UUID, actorId: UUID): Promise<void> {
    const supabase = createClient();
    const admin = createAdminClient();
    const target = await teamService.getById(userId);
    if (!target) throw new Error("User not found");
    if (target.acceptedAt !== null) {
      throw new Error("Cannot revoke — user has already accepted");
    }
    await admin.auth.admin.deleteUser(userId);
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) throw error;
    await activityService.log({
      companyId: target.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited",
      description: `Revoked invitation for ${target.email}`,
      metadata: { revokedUserId: userId },
    });
  },

  async setRoles(
    userId: UUID,
    roles: RoleValue[],
    actorId: UUID,
  ): Promise<User> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .update({ roles })
      .eq("id", userId)
      .select(SELECT)
      .single();
    if (error) throw error;
    const user = data as unknown as User;
    await activityService.log({
      companyId: user.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "user_invited",
      description: `Updated roles for ${user.email}: ${roles.join(", ")}`,
      metadata: { targetUserId: userId, roles },
    });
    return user;
  },

  async acceptInvitation(userId: UUID): Promise<User> {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("users")
      .update({ accepted_at: now, last_login_at: now })
      .eq("id", userId)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as unknown as User;
  },

  isPending(user: User): boolean {
    return user.invitedAt !== null && user.acceptedAt === null;
  },

  async removeMember(userId: UUID, actorId: UUID): Promise<void> {
    if (userId === actorId) {
      throw new Error("You cannot remove yourself from the team.");
    }
    const admin = createAdminClient();
    const supabase = createClient();
    const target = await teamService.getById(userId);
    if (!target) throw new Error("User not found");
    if (target.isSuperUser) {
      const { count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("company_id", target.companyId)
        .eq("is_super_user", true)
        .neq("id", userId);
      if ((count ?? 0) === 0) {
        throw new Error(
          "Cannot remove the last super-administrator — promote someone else first.",
        );
      }
    }
    await admin.auth.admin.deleteUser(userId);
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) throw error;
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
