import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { User, UUID } from "@/lib/types";
import type { RoleValue } from "@/lib/roles";
import { activityService } from "./activity-service";

const NS = "team:";
// Mutations also invalidate auth:* since both layers read public.users.
const AUTH_NS = "auth:";

/**
 * Note on Auth user lifecycle: invite / revoke / remove operations currently
 * only touch `public.users`. Creating or deleting the matching `auth.users`
 * row requires the service-role key and must run server-side — that lives
 * behind `/api/team/*` route handlers (TODO). Until those exist, use the
 * Supabase dashboard to issue/revoke logins.
 */

const SELECT = `
  id,
  companyId:company_id,
  name,
  email,
  username,
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InviteValidationError extends Error {}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function bustUserCaches() {
  invalidate(NS);
  invalidate(AUTH_NS);
}

export const teamService = {
  async getAll(companyId: UUID): Promise<User[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select(SELECT)
        .eq("company_id", companyId)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as User[];
    });
  },

  async getById(userId: UUID): Promise<User | null> {
    return withCache(`${NS}by-id:${userId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select(SELECT)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as User | null;
    });
  },

  /**
   * Create a public.users row in the "invited" state. Does NOT create the
   * matching auth.users record — see the file-level note on the Auth user
   * lifecycle TODO. The seeded users already have auth accounts; net-new
   * invitees won't be able to log in until that path lands.
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

      const { data, error } = await supabase
        .from("users")
        .insert({
          // No auth.users row yet — generate a placeholder UUID. The FK to
          // auth.users will fail until the server-side invite route is wired.
          // For now, this row exists as a pending invite the dashboard surfaces.
          id: crypto.randomUUID(),
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
      bustUserCaches();
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
    const u = await teamService.getById(userId);
    if (!u) throw new Error("User not found");
    if (u.acceptedAt !== null) {
      throw new Error("User has already accepted their invitation");
    }
    const { data, error } = await supabase
      .from("users")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", userId)
      .select(SELECT)
      .single();
    if (error) throw error;
    const updated = data as unknown as User;
    bustUserCaches();
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
    const target = await teamService.getById(userId);
    if (!target) throw new Error("User not found");
    if (target.acceptedAt !== null) {
      throw new Error("Cannot revoke — user has already accepted");
    }
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) throw error;
    bustUserCaches();
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
   * Change a member's role bundle. Routed through the server (admin client)
   * because RLS only lets a user update their OWN row — an admin can't change
   * another member's roles from the browser. The route also re-derives the
   * legacy `users.role` column and enforces the manage-users/permissions
   * capability + guards (no self-edit, no super-user targets).
   */
  async setRoles(
    userId: UUID,
    roles: RoleValue[],
    actorId: UUID,
  ): Promise<User> {
    const res = await fetch("/api/team/set-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, roles }),
    });
    const json = (await res.json()) as { user?: User; error?: string };
    if (!res.ok || !json.user) {
      throw new Error(json.error ?? "Could not update roles");
    }
    bustUserCaches();
    const user = json.user;
    await activityService
      .log({
        companyId: user.companyId,
        userId: actorId,
        vehicleId: null,
        actionType: "user_invited",
        description: `Updated roles for ${user.email}: ${roles.join(", ")}`,
        metadata: { targetUserId: userId, roles },
      })
      .catch(() => {});
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
    bustUserCaches();
    return data as unknown as User;
  },

  isPending(user: User): boolean {
    return user.invitedAt !== null && user.acceptedAt === null;
  },

  /**
   * Removal must run server-side: public.users has no RLS DELETE policy (a
   * browser delete silently no-ops) and RESTRICT FKs make a hard delete
   * impossible for users with history. The route hard-deletes pending
   * invites and deactivates + bans established users. Guards (self / last
   * super-admin) are enforced there too.
   */
  async removeMember(userId: UUID, actorId: UUID): Promise<void> {
    if (userId === actorId) {
      throw new Error("You cannot remove yourself from the team.");
    }
    const res = await fetch("/api/team/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, actorId }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? "Could not remove member");
    }
    bustUserCaches();
  },
};
