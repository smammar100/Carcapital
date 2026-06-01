import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Company, User } from "@/lib/types";

const USER_WITH_COMPANY_SELECT = `
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
  createdAt:created_at,
  company:companies (
    id,
    name,
    address,
    vatNumber:vat_number,
    logoUrl:logo_url,
    stockIdPrefix:stock_id_prefix,
    nextStockSeq:next_stock_seq
  )
`;

/**
 * Server-side prefetch of the signed-in user + company. Hands the result to
 * `<AuthProvider initialUser=... initialCompany=...>` so the client renders
 * with the user already populated and `loading: false` — eliminating the
 * post-mount `getSession()` + `hydrate()` round-trip that previously held
 * back FCP/LCP by 1–3 s on every dashboard page.
 *
 * Safe to call from a public route (returns nulls when no session).
 *
 * Wrapped in React.cache() so repeated calls within the same render tree
 * (e.g. layout + a child server component) share one Supabase round-trip.
 */
export const getInitialAuth = cache(async (): Promise<{
  user: User | null;
  company: Company | null;
}> => {
  try {
    // Fast bail-out: if there's no Supabase auth cookie the user is definitely
    // not signed in — skip the Supabase round-trip entirely. This saves
    // ~300–400 ms on every unauthenticated page view (login, public routes).
    const cookieStore = await cookies();
    const hasAuthCookie = cookieStore
      .getAll()
      .some(
        (c) =>
          c.name.startsWith("sb-") &&
          c.name.endsWith("-auth-token") &&
          c.value.length > 0,
      );
    if (!hasAuthCookie) return { user: null, company: null };

    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return { user: null, company: null };

    const { data, error } = await supabase
      .from("users")
      .select(USER_WITH_COMPANY_SELECT)
      .eq("id", authUser.id)
      .single();

    if (error || !data) return { user: null, company: null };

    const { company, ...userRow } = data as unknown as User & {
      company: Company;
    };

    if (userRow.active === false) return { user: null, company: null };

    return { user: userRow, company };
  } catch {
    return { user: null, company: null };
  }
});
