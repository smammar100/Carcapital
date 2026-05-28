import "server-only";
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
 */
export async function getInitialAuth(): Promise<{
  user: User | null;
  company: Company | null;
}> {
  try {
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
}
