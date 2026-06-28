/**
 * AutoTrader "Go Live" fair-usage + error-handling policy — PURE functions.
 *
 * Kept free of `server-only` and any framework imports so the decision logic
 * is unit-testable under `node --test`. The server-only transport
 * (autotrader-service.ts `atFetch`) imports these and applies them.
 */

/** AutoTrader's documented minimum pause for a 503 on a service. */
export const SERVICE_503_PAUSE_MS = 2_000;
/** Base backoff for a 429 when no Retry-After is given (grows per attempt). */
export const DEFAULT_429_BACKOFF_MS = 1_000;
/** Retries AFTER the first attempt, per call. */
export const AT_MAX_RETRIES = 2;

/**
 * Parse a `Retry-After` header (delta-seconds OR an HTTP-date) into ms from
 * `nowMs`. Returns null when absent/unparseable.
 */
export function parseRetryAfterMs(
  headerValue: string | null,
  nowMs: number,
): number | null {
  if (!headerValue) return null;
  const secs = Number(headerValue);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(headerValue);
  return Number.isFinite(when) ? Math.max(0, when - nowMs) : null;
}

export type ForbiddenKind = "forbidden_advertiser" | "forbidden_product";

/**
 * Classify a 403 body into the two AutoTrader-documented kinds:
 *   forbidden_advertiser — integration has no access to that advertiser id
 *   forbidden_product    — advertiser has no access to the requested service
 * Heuristic over the body text — confirm exact wording against a real 403 via
 * scripts/autotrader-advertisers-probe.mjs and tighten if needed.
 */
export function classify403(body: string): ForbiddenKind {
  const b = body.toLowerCase();
  if (
    b.includes("product") ||
    b.includes("service you are requesting") ||
    b.includes("access to the service")
  ) {
    return "forbidden_product";
  }
  return "forbidden_advertiser";
}
