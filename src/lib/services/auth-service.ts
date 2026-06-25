import { createClient } from "@/lib/supabase/client";
import { withCache } from "@/lib/cache";
import type { Company, User, UUID } from "@/lib/types";

const NS = "auth:";

const USER_SELECT = `
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

const COMPANY_SELECT = `
  id,
  name,
  address,
  vatNumber:vat_number,
  logoUrl:logo_url,
  stockIdPrefix:stock_id_prefix,
  nextStockSeq:next_stock_seq
`;

export const authService = {
  // SECURITY: `companyId` is an optional, backward-compatible tenant filter.
  // When provided, the query is scoped to that company; when omitted, behaviour
  // is unchanged so existing callers aren't broken. Row-level security in
  // Supabase remains the primary enforcement boundary.
  async getUser(id: UUID, companyId?: UUID): Promise<User | null> {
    return withCache(
      `${NS}user:${id}${companyId ? `:${companyId}` : ""}`,
      async () => {
        const supabase = createClient();
        let q = supabase.from("users").select(USER_SELECT).eq("id", id);
        if (companyId) q = q.eq("company_id", companyId);
        const { data, error } = await q.maybeSingle();
        if (error) throw error;
        return data as unknown as User | null;
      },
    );
  },

  async getAllUsers(companyId?: UUID): Promise<User[]> {
    return withCache(
      `${NS}all-users${companyId ? `:${companyId}` : ""}`,
      async () => {
        const supabase = createClient();
        let q = supabase.from("users").select(USER_SELECT);
        if (companyId) q = q.eq("company_id", companyId);
        const { data, error } = await q.order("created_at", {
          ascending: true,
        });
        if (error) throw error;
        return (data ?? []) as unknown as User[];
      },
    );
  },

  async getUsersForCompany(companyId: UUID): Promise<User[]> {
    return withCache(`${NS}users:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select(USER_SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as User[];
    });
  },

  async getCompany(id: UUID): Promise<Company | null> {
    return withCache(`${NS}company:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("companies")
        .select(COMPANY_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Company | null;
    });
  },

  async getCurrentCompany(): Promise<Company> {
    return withCache(`${NS}current-company`, async () => {
      const supabase = createClient();
      // Derive the company from the authenticated user's profile rather than
      // grabbing an arbitrary `.limit(1)` row — that leaked the wrong tenant.
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authUser) throw new Error("No authenticated user");

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", authUser.id)
        .single();
      if (profileError) throw profileError;
      const companyId = (profile as { company_id: string } | null)?.company_id;
      if (!companyId) throw new Error("User has no company");

      const { data, error } = await supabase
        .from("companies")
        .select(COMPANY_SELECT)
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data as unknown as Company;
    });
  },
};
