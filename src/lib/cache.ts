/**
 * Tiny request-level cache for service-layer reads.
 *
 * Two jobs:
 *  1. **In-flight dedupe** — six components mounting in parallel and all calling
 *     `vehicleService.getAll(companyId)` issue ONE network request, not six.
 *  2. **Short TTL** — repeat calls within the TTL return the cached value
 *     synchronously. Page-to-page navigation reuses the recent fetch.
 *
 * Cache keys are namespaced by table prefix (`vehicles:`, `sales:`, …) so
 * mutations can call `invalidate('vehicles:')` to clear everything tied to
 * that entity.
 *
 * Not a substitute for SWR — there's no background revalidation, no
 * stale-while-revalidate. But it's a fraction of the size and adds no deps.
 */

import { createClient } from "@/lib/supabase/client";

const DEFAULT_TTL_MS = 30_000;

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * The Supabase JWT silently expires (~1h) while a tab is backgrounded or
 * idle — and the browser throttles the auto-refresh timer, so it can stay
 * dead. The auth-context refreshes the token on window focus, but:
 *   • client-side route switches (sidebar nav) are NOT window focus
 *     events, so that path doesn't fire on an in-app tab change, and
 *   • a token refresh keeps the same user, so the auth-context
 *     deliberately does NOT re-hydrate → already-mounted pages never
 *     re-run their `useEffect([company])` → the screen stays blank
 *     until a hard reload.
 *
 * This is the missing systemic recovery: any cached read whose fetch
 * fails with an auth/JWT error forces a session refresh and retries
 * ONCE. Every service read goes through here, so the whole app
 * self-heals on a stale session regardless of how the user navigated.
 */
function isAuthError(e: unknown): boolean {
  const err = e as
    | { code?: string; status?: number; message?: string }
    | null;
  if (!err) return false;
  if (err.status === 401) return true;
  if (err.code === "PGRST301" || err.code === "401") return true; // JWT expired / unauthenticated
  return /jwt (?:expired|is expired|is invalid)|invalid jwt|token (?:is )?expired|not authenticated|refresh token|missing sub claim/i.test(
    err.message ?? "",
  );
}

/**
 * Run `fetcher` under cache+dedupe semantics keyed by `key`.
 * Returns the cached value if fresh; otherwise issues (or joins) one request
 * and caches its resolved value for `ttlMs`.
 *
 * Errors are NOT cached — a failed fetch lets the next caller retry.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > now) {
    return hit.value;
  }
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = (async () => {
    try {
      let value: T;
      try {
        value = await fetcher();
      } catch (e) {
        if (!isAuthError(e)) throw e;
        // Session likely died while idle / between route switches.
        // getSession() refreshes an expired access token when the
        // refresh token is still valid, then we retry the read ONCE.
        try {
          await createClient().auth.getSession();
        } catch {
          /* fall through — the retry will surface the real error */
        }
        value = await fetcher();
      }
      cache.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

/**
 * Drop every cached entry whose key starts with `prefix`.
 * Call this from mutation methods so the next read fetches fresh data.
 */
export function invalidate(prefix: string): void {
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

/** Clear everything — useful on sign-out so the next user doesn't see stale rows. */
export function invalidateAll(): void {
  cache.clear();
}
