/**
 * Keyed sliding-window rate limiter for API routes.
 *
 * In-memory and per-instance: on Vercel Fluid Compute instances are reused
 * across requests, so this provides real (if not globally exact) protection —
 * a burst hitting one warm instance is throttled; the cap loosens only in
 * proportion to how many instances are live. That is the right trade-off for
 * abuse-prevention on auth-adjacent routes without buying shared infra.
 * If a route ever needs an exact global limit (billing, hard quotas), replace
 * the backing store with Upstash/Postgres behind the same signature.
 *
 * Generalises the pattern in src/app/api/photo/vehicle/route.ts to keyed
 * limits (per IP / per user) shared across routes.
 */

interface Bucket {
  timestamps: number[];
  lastSeen: number;
}

const buckets = new Map<string, Bucket>();

// Cap total tracked keys so a spray of unique keys can't grow memory
// unboundedly; oldest-idle buckets are evicted first.
const MAX_BUCKETS = 10_000;

function evictIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  let oldestKey: string | null = null;
  let oldestSeen = Infinity;
  for (const [key, b] of buckets) {
    if (b.lastSeen < oldestSeen) {
      oldestSeen = b.lastSeen;
      oldestKey = key;
    }
  }
  if (oldestKey) buckets.delete(oldestKey);
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the oldest hit leaves the window (only when !ok). */
  retryAfterSeconds: number;
}

/**
 * Record a hit for `key` and report whether it is within `max` hits per
 * `windowMs`. Namespacing is the caller's job — prefix keys per route
 * (e.g. `join:${ip}`) so limits don't bleed across endpoints.
 */
export function rateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [], lastSeen: now };
    buckets.set(key, bucket);
    evictIfNeeded();
  }
  bucket.lastSeen = now;
  const { timestamps } = bucket;
  while (timestamps.length && now - timestamps[0] > windowMs) {
    timestamps.shift();
  }
  if (timestamps.length >= max) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((timestamps[0] + windowMs - now) / 1000),
    );
    return { ok: false, retryAfterSeconds };
  }
  timestamps.push(now);
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP for keying unauthenticated routes. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Reset all buckets — test hook only. */
export function _resetRateLimits() {
  buckets.clear();
}
