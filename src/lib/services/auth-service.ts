import { createClient } from "@/lib/supabase/client";
import type { Company, User, UUID } from "@/lib/types";

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
  async getUser(id: UUID): Promise<User | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select(USER_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as User | null;
  },

  async getAllUsers(): Promise<User[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select(USER_SELECT)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as User[];
  },

  async getUsersForCompany(companyId: UUID): Promise<User[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select(USER_SELECT)
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as User[];
  },

  async getCompany(id: UUID): Promise<Company | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as Company | null;
  },

  async getCurrentCompany(): Promise<Company> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .limit(1)
      .single();
    if (error) throw error;
    return data as unknown as Company;
  },
};
