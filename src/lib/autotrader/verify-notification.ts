/**
 * AutoTrader notification hash authentication (server-only).
 *
 * AutoTrader signs each advertiser-update notification with a hash derived
 * from the request body + a shared secret (AUTOTRADER_WEBHOOK_SECRET). We
 * recompute it and compare in constant time before trusting the payload.
 *
 * NOTE: the exact algorithm + header name must be confirmed against
 * AutoTrader's "Advertiser update notifications" reference. We default to
 * HMAC-SHA256(body, secret) (hex) in a header named below — adjust both once
 * confirmed (and update the test vectors).
 *
 * No `server-only` barrier: these are pure crypto helpers (node:crypto) with
 * no secrets baked in, kept importable under `node --test`. The only caller is
 * the server-only webhook route.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Header carrying the notification hash — CONFIRM exact name with AutoTrader. */
export const NOTIFICATION_HASH_HEADER = "x-autotrader-hash";

/** HMAC-SHA256(rawBody, secret) as lowercase hex. */
export function computeNotificationHash(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Constant-time comparison of the provided hash against the expected one.
 * Returns false for a missing/empty hash, a length mismatch, or any mismatch.
 */
export function verifyNotificationHash(
  rawBody: string,
  providedHash: string | null | undefined,
  secret: string,
): boolean {
  if (!providedHash || !secret) return false;
  const expected = computeNotificationHash(rawBody, secret);
  // Compare case-insensitively on hex by normalising first.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(providedHash.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
