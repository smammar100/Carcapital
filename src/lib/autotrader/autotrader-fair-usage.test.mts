/**
 * Unit tests for the AutoTrader "Go Live" fundamentals — fair-usage policy +
 * notification hash authentication. Runs on Node's built-in test runner
 * (Node strips TypeScript types natively): `pnpm test` or
 *   node --test src/lib/autotrader/autotrader-fair-usage.test.mts
 *
 * These pure modules are the demonstration artefact for the Demonstration-
 * checked Go-Live items (429/503/400/403 handling, hash auth). The full
 * transport (atFetch) wires them together in autotrader-service.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  AT_MAX_RETRIES,
  DEFAULT_429_BACKOFF_MS,
  SERVICE_503_PAUSE_MS,
  classify403,
  parseRetryAfterMs,
} from "./fair-usage.ts";
import {
  computeNotificationHash,
  verifyNotificationHash,
} from "./verify-notification.ts";

// --- Fair-usage constants (Go-Live thresholds) ----------------------------
test("503 service pause is at least AutoTrader's 2s minimum", () => {
  assert.ok(SERVICE_503_PAUSE_MS >= 2_000);
});

test("429 has a non-zero default backoff and at least one retry", () => {
  assert.ok(DEFAULT_429_BACKOFF_MS > 0);
  assert.ok(AT_MAX_RETRIES >= 1);
});

// --- parseRetryAfterMs -----------------------------------------------------
test("parseRetryAfterMs reads delta-seconds", () => {
  assert.equal(parseRetryAfterMs("2", 0), 2_000);
  assert.equal(parseRetryAfterMs("0", 0), 0);
});

test("parseRetryAfterMs reads an HTTP-date relative to now", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  const future = "Thu, 01 Jan 2026 00:00:05 GMT";
  assert.equal(parseRetryAfterMs(future, now), 5_000);
});

test("parseRetryAfterMs returns null for missing/garbage", () => {
  assert.equal(parseRetryAfterMs(null, 0), null);
  assert.equal(parseRetryAfterMs("not-a-date", 0), null);
});

test("parseRetryAfterMs never returns a negative wait", () => {
  const now = Date.parse("2026-01-01T00:00:10Z");
  const past = "Thu, 01 Jan 2026 00:00:00 GMT";
  assert.equal(parseRetryAfterMs(past, now), 0);
});

// --- classify403 (two documented 403 kinds) --------------------------------
test("classify403 → forbidden_product when the body mentions products/service", () => {
  assert.equal(
    classify403("Advertiser does not have access to the product requested"),
    "forbidden_product",
  );
  assert.equal(
    classify403("No access to the service you are requesting"),
    "forbidden_product",
  );
});

test("classify403 → forbidden_advertiser otherwise (not on integration)", () => {
  assert.equal(
    classify403("Advertiser 10008899 is not on your advertiser list"),
    "forbidden_advertiser",
  );
  assert.equal(classify403(""), "forbidden_advertiser");
});

// --- Notification hash authentication --------------------------------------
const SECRET = "test-shared-secret";
const BODY = JSON.stringify({ notificationType: "ADVERTISER", advertiserId: "10008899" });

test("computeNotificationHash matches a reference HMAC-SHA256 hex", () => {
  const expected = createHmac("sha256", SECRET).update(BODY, "utf8").digest("hex");
  assert.equal(computeNotificationHash(BODY, SECRET), expected);
});

test("verifyNotificationHash accepts a correct hash (2XX path)", () => {
  const hash = computeNotificationHash(BODY, SECRET);
  assert.equal(verifyNotificationHash(BODY, hash, SECRET), true);
});

test("verifyNotificationHash is case-insensitive on the hex digest", () => {
  const hash = computeNotificationHash(BODY, SECRET).toUpperCase();
  assert.equal(verifyNotificationHash(BODY, hash, SECRET), true);
});

test("verifyNotificationHash rejects a tampered body (401 path)", () => {
  const hash = computeNotificationHash(BODY, SECRET);
  assert.equal(verifyNotificationHash(BODY + " ", hash, SECRET), false);
});

test("verifyNotificationHash rejects a wrong/short/missing hash", () => {
  assert.equal(verifyNotificationHash(BODY, "deadbeef", SECRET), false);
  assert.equal(verifyNotificationHash(BODY, null, SECRET), false);
  assert.equal(verifyNotificationHash(BODY, "", SECRET), false);
});

test("verifyNotificationHash rejects when the secret is wrong", () => {
  const hash = computeNotificationHash(BODY, SECRET);
  assert.equal(verifyNotificationHash(BODY, hash, "other-secret"), false);
});

test("verifyNotificationHash returns false when no secret is configured", () => {
  const hash = computeNotificationHash(BODY, SECRET);
  assert.equal(verifyNotificationHash(BODY, hash, ""), false);
});
