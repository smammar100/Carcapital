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
import { toast } from "@/lib/toast";
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
  onboardingCompletedAt:onboarding_completed_at,
  createdAt:created_at,
  company:companies (
    id,
    name,
    slug,
    address,
    vatNumber:vat_number,
    logoUrl:logo_url,
    logoMarkUrl:logo_mark_url,
    stockIdPrefix:stock_id_prefix,
    nextStockSeq:next_stock_seq,
    workingHoursStart:working_hours_start,
    workingHoursEnd:working_hours_end
  )
`;

interface AuthProviderProps {
  children: ReactNode;
  /**
   * Server-prefetched user + company. When provided the provider starts with
   * `loading: false` so the first render already shows the signed-in shell —
   * no client-side `getSession()` round-trip is required for FCP. The bootstrap
   * effect still subscribes to `onAuthStateChange` for sign-out / token rotation.
   */
  initialUser?: User | null;
  initialCompany?: Company | null;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialCompany = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [company, setCompany] = useState<Company | null>(initialCompany);
  const [loading, setLoading] = useState(initialUser === null);
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

    // Removed members are deactivated (active=false) + auth-banned. A banned
    // user's already-issued access token stays valid until expiry, so close
    // that gap here: treat an inactive profile as logged out.
    if (userRow.active === false) {
      await supabase.auth.signOut();
      setUser(null);
      setCompany(null);
      return;
    }

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
    // SPEC Point 9 — when the tab has been hidden a long time, the cached
    // service data is stale on return. Track how long we were hidden and,
    // past a threshold, blow the shared cache so the next reads refetch,
    // plus a subtle toast so the user knows why the screen just updated.
    const STALE_AFTER_MS = 5 * 60 * 1000;
    let hiddenAt: number | null = null;
    const onWake = () => {
      if (document.visibilityState !== "visible") {
        if (hiddenAt === null) hiddenAt = Date.now();
        return;
      }
      const wasHiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      void revalidate();
      if (wasHiddenFor > STALE_AFTER_MS) {
        invalidateAll();
        toast.success("Refreshed data after returning");
      }
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

        const sub = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (!mounted) return;
          // TOKEN_REFRESHED only rotates the JWT — the public.users /
          // companies rows are unchanged, so re-querying them is wasteful
          // and can cause a render flash. Keeping the session alive is
          // the whole point; nothing to re-hydrate.
          if (event === "TOKEN_REFRESHED") return;

          const nextId = nextSession?.user?.id ?? null;
          // Tab refocus re-emits INITIAL_SESSION for the SAME user; re-hydrating
          // then is pointless and caused the blank-on-tab-switch bug, so skip
          // when nothing changed. BUT a deliberate SIGNED_IN (a real login,
          // incl. switching accounts) must always re-hydrate so the new
          // identity replaces the old — even if the id ref looks stale.
          if (
            nextId === userIdRef.current &&
            event !== "SIGNED_OUT" &&
            event !== "SIGNED_IN"
          ) {
            return;
          }

          // CRITICAL: never await a Supabase call inside this callback.
          // supabase-js runs it while holding the GoTrue auth lock; a DB
          // query in hydrate() needs that same lock to attach the token,
          // so awaiting here deadlocks (callback ⇄ query ⇄ lock) and the
          // request never resolves — data "doesn't load" until refresh.
          // Deferring lets the callback return and release the lock first.
          setTimeout(() => {
            if (!mounted) return;
            void hydrate(nextId).catch((e) => {
              // eslint-disable-next-line no-console
              console.error("[auth] hydrate failed during state change:", e);
            });
          }, 0);
        });
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
    // Drop any existing session + cached rows FIRST so signing in as a
    // different user can't leave the previous identity/data in place (the
    // "logged in as someone else but still see the old user" bug).
    await supabase.auth.signOut().catch(() => {});
    invalidateAll();
    setUser(null);
    setCompany(null);
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
