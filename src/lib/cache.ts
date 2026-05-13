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

const DEFAULT_TTL_MS = 30_000;

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

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
      const value = await fetcher();
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
