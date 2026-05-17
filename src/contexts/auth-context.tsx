"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { invalidateAll } from "@/lib/cache";
import { warmDashboardCache } from "@/lib/cache-warmup";
import type { Company, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  company: Company | null;
  loading: boolean;
  /** Non-null when the auth context failed to initialise (e.g. missing env vars). */
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Force a session check + re-hydrate. Called on tab focus/visibility so
   * a backgrounded tab whose JWT silently expired recovers transparently
   * instead of every request 401-ing into a blank page.
   */
  revalidate: () => Promise<void>;
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
  const [error, setError] = useState<string | null>(null);
  // Single-flight guard so a burst of focus/visibility/online events
  // doesn't stampede getSession()/hydrate().
  const revalidatingRef = useRef(false);
  // Latest signed-in user id, read by revalidate() without re-subscribing
  // the focus listeners on every user change. Synced in an effect (not
  // during render) — React 19 forbids ref writes in the render body, and
  // revalidate() only ever reads this from event handlers that fire well
  // after commit, so the post-commit sync is always current in practice.
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  /**
   * Resolve the public.users + companies rows for an auth session.
   * Sets user + company state; null on failure.
   * Note: callers re-create the client locally so we never touch
   * `createClient()` during SSR/prerender.
   */
  const hydrate = useCallback(async (authUserId: string | null) => {
    if (!authUserId) {
      setUser(null);
      setCompany(null);
      return;
    }
    const supabase = createClient();
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
    // Fire-and-forget cache warm-up so the dashboard renders against a warm
    // cache. Every dashboard component will read from this within 30s.
    void warmDashboardCache(companyRow.id, userRow.id);
  }, []);

  /**
   * Re-check the session and re-hydrate only if the signed-in user
   * changed (or the session died). `getSession()` transparently refreshes
   * an expired access token when the refresh token is still valid — which
   * is exactly the case for a tab left idle past the ~1h JWT lifetime.
   * Single-flighted; cheap no-op when the session is unchanged.
   */
  const revalidate = useCallback(async () => {
    if (revalidatingRef.current) return;
    revalidatingRef.current = true;
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const nextId = session?.user?.id ?? null;
      if (nextId !== userIdRef.current) {
        await hydrate(nextId);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[auth] revalidate failed:", e);
    } finally {
      revalidatingRef.current = false;
    }
  }, [hydrate]);

  // Recover a stale session when the tab regains focus / visibility, or
  // the network comes back. Browsers throttle background timers, so the
  // Supabase auto-refresh timer may not fire while the tab is hidden;
  // when the user returns the JWT can be dead. Proactively revalidating
  // here refreshes it BEFORE any service call can 401 into a blank page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onWake = () => {
      if (document.visibilityState === "visible") void revalidate();
    };
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [revalidate]);

  // Bootstrap from current session + subscribe to changes. The client is
  // instantiated inside the effect so SSR/prerender never reads env vars.
  // Errors at any step are surfaced via `error` state instead of hanging the
  // UI on a forever-loading skeleton.
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        await hydrate(session?.user?.id ?? null);

        const sub = supabase.auth.onAuthStateChange(
          async (event, nextSession) => {
            if (!mounted) return;
            // TOKEN_REFRESHED only rotates the JWT — the public.users /
            // companies rows are unchanged, so re-querying them is wasteful
            // and can cause a render flash. Keeping the session alive is
            // the whole point; nothing to re-hydrate.
            if (event === "TOKEN_REFRESHED") return;
            try {
              await hydrate(nextSession?.user?.id ?? null);
            } catch (e) {
              // Don't kill the listener — log and keep going.
              // eslint-disable-next-line no-console
              console.error("[auth] hydrate failed during state change:", e);
            }
          },
        );
        subscription = sub.data.subscription;
      } catch (e) {
        if (!mounted) return;
        const msg =
          e instanceof Error ? e.message : "Failed to initialise auth";
        // eslint-disable-next-line no-console
        console.error("[auth] init failed:", e);
        setError(msg);
      } finally {
        // Always resolve loading so the UI can render either content or an
        // error state — never a perpetual skeleton.
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [hydrate]);

  async function signIn(email: string, password: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // onAuthStateChange will fire and call hydrate(); no need to setUser here.
  }

  async function signOut(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear the cache so the next user doesn't see the previous user's rows.
    invalidateAll();
    setUser(null);
    setCompany(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, company, loading, error, signIn, signOut, revalidate }}
    >
      {children}
    </AuthContext.Provider>
  );
}
