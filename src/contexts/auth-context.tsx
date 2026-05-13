"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  company: Company | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/**
 * The PostgREST alias string used to fetch the signed-in user's row plus
 * the joined company in one round-trip with camelCase keys ready for the
 * business types in `src/lib/types.ts`.
 */
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  /**
   * Resolve the public.users + companies rows for an auth session.
   * Sets user + company state; null on failure.
   */
  const hydrate = useCallback(
    async (authUserId: string | null) => {
      if (!authUserId) {
        setUser(null);
        setCompany(null);
        return;
      }
      const { data, error } = await supabase
        .from("users")
        .select(USER_WITH_COMPANY_SELECT)
        .eq("id", authUserId)
        .single();

      if (error || !data) {
        // Auth session exists but no public.users row — shouldn't happen in a
        // seeded database. Sign out to clear the orphan session.
        await supabase.auth.signOut();
        setUser(null);
        setCompany(null);
        return;
      }

      const { company: companyRow, ...userRow } = data as unknown as User & {
        company: Company;
      };
      setUser(userRow);
      setCompany(companyRow);
    },
    [supabase],
  );

  // Bootstrap from current session + subscribe to changes.
  useEffect(() => {
    let mounted = true;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      await hydrate(session?.user?.id ?? null);
      if (mounted) setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      await hydrate(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrate, supabase]);

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // onAuthStateChange will fire and call hydrate(); no need to setUser here.
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    setUser(null);
    setCompany(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, company, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
