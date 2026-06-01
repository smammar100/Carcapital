import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { capabilitiesForRoles, type RoleValue } from "@/lib/roles";
import type { Capability } from "@/lib/capabilities";

/**
 * Server-side authorization for API route handlers.
 *
 * Before this existed, routes trusted `companyId`/`actorId` from the request
 * body and used the service-role key with no caller check — any logged-in (or
 * even logged-out) client could act as anyone. `requireUser()` authenticates
 * the caller from their session cookie, loads their profile, blocks
 * deactivated accounts, and resolves their effective capabilities. Routes then
 * derive company/actor from the returned actor — never from the body.
 */

export interface AuthedActor {
  id: string;
  companyId: string;
  roles: RoleValue[];
  isSuperUser: boolean;
  capabilities: Set<Capability>;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

/** Reject a promise if it doesn't settle within `ms`. Prevents a slow
 *  Supabase round-trip from hanging the whole serverless function (which,
 *  on the vehicle-lookup route, manifested as a spinner that never resolved). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new AuthError(401, `${label} timed out`)), ms),
    ),
  ]);
}

/** Authenticate + load the active caller. Throws AuthError(401/403) otherwise. */
export async function requireUser(): Promise<AuthedActor> {
  const supabase = await createClient();

  // getUser() validates the access token against Supabase. If the token has
  // expired, API routes (excluded from middleware, which is what refreshes
  // tokens for page navigations) have nothing to refresh it — so getUser()
  // 401s even though the browser still holds a valid refresh token. Fall back
  // to getSession(), which uses the refresh token to mint a fresh access
  // token, then re-validate. This was the production "every lookup 401s while
  // the dashboard shows logged-in" bug.
  const getUserResult = await withTimeout(
    supabase.auth.getUser(),
    8_000,
    "auth check",
  );
  let user = getUserResult.data.user;
  let authError: unknown = getUserResult.error;

  if (!user) {
    // Try a refresh via the session (uses the refresh-token cookie).
    const { data: sessionData } = await withTimeout(
      supabase.auth.getSession(),
      8_000,
      "session refresh",
    );
    if (sessionData?.session?.user) {
      user = sessionData.session.user;
      authError = null;
    }
  }

  if (!user) {
    const msg =
      authError instanceof Error ? authError.message : "no user";
    console.warn(
      `[require-user] 401 — no valid session (getUser+getSession both failed): ${msg}`,
    );
    throw new AuthError(401, "Authentication required");
  }

  // Load the profile with the service-role client so this works regardless of
  // RLS, but keyed strictly to the authenticated user's own id.
  const admin = createAdminClient();
  const { data: profile, error: pErr } = await admin
    .from("users")
    .select("id, company_id, roles, is_super_user, active")
    .eq("id", user.id)
    .maybeSingle();
  if (pErr || !profile) throw new AuthError(403, "No profile for this account");
  if ((profile as { active: boolean }).active === false) {
    throw new AuthError(403, "Account is deactivated");
  }

  const roles = ((profile as { roles: RoleValue[] }).roles ?? []) as RoleValue[];
  const isSuperUser = (profile as { is_super_user: boolean }).is_super_user === true;

  const capabilities = capabilitiesForRoles(roles);
  const { data: grants } = await admin
    .from("user_permissions")
    .select("capability")
    .eq("user_id", user.id);
  for (const g of grants ?? []) {
    capabilities.add((g as { capability: Capability }).capability);
  }

  return {
    id: (profile as { id: string }).id,
    companyId: (profile as { company_id: string }).company_id,
    roles,
    isSuperUser,
    capabilities,
  };
}

/** Throw AuthError(403) unless the actor holds `cap` (super-users bypass). */
export function requireCapability(actor: AuthedActor, cap: Capability): void {
  if (actor.isSuperUser) return;
  if (!actor.capabilities.has(cap)) {
    throw new AuthError(403, `Missing required permission: ${cap}`);
  }
}

/** Throw AuthError(403) unless the actor holds ANY of `caps` (super-users bypass). */
export function requireAnyCapability(actor: AuthedActor, caps: Capability[]): void {
  if (actor.isSuperUser) return;
  if (!caps.some((c) => actor.capabilities.has(c))) {
    throw new AuthError(403, `Missing required permission: one of ${caps.join(", ")}`);
  }
}

/**
 * Convert an AuthError into a NextResponse for a route catch block. Returns
 * null for non-auth errors so the caller can rethrow/handle them.
 */
export function authErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return null;
}
