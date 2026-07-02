/**
 * Unit tests for the AutoTrader "Go Live" fundamentals — fair-usage policy +
 * notification hash authentication. Ported verbatim from the node:test suite
 * (autotrader-fair-usage.test.mts) to Vitest; identical assertions.
 *
 * These pure modules are the demonstration artefact for the Demonstration-
 * checked Go-Live items (429/503/400/403 handling, hash auth). The full
 * transport (atFetch) wires them together in autotrader-service.ts.
 */
import { expect, test } from "vitest";
import { createHmac } from "node:crypto";
import {
  AT_MAX_RETRIES,
  DEFAULT_429_BACKOFF_MS,
  SERVICE_503_PAUSE_MS,
  classify403,
  parseRetryAfterMs,
} from "./fair-usage";
import {
  computeNotificationHash,
  verifyNotificationHash,
} from "./verify-notification";

// --- Fair-usage constants (Go-Live thresholds) ----------------------------
test("503 service pause is at least AutoTrader's 2s minimum", () => {
  expect(SERVICE_503_PAUSE_MS).toBeGreaterThanOrEqual(2_000);
});

test("429 has a non-zero default backoff and at least one retry", () => {
  expect(DEFAULT_429_BACKOFF_MS).toBeGreaterThan(0);
  expect(AT_MAX_RETRIES).toBeGreaterThanOrEqual(1);
});

// --- parseRetryAfterMs -----------------------------------------------------
test("parseRetryAfterMs reads delta-seconds", () => {
  expect(parseRetryAfterMs("2", 0)).toBe(2_000);
  expect(parseRetryAfterMs("0", 0)).toBe(0);
});

test("parseRetryAfterMs reads an HTTP-date relative to now", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  const future = "Thu, 01 Jan 2026 00:00:05 GMT";
  expect(parseRetryAfterMs(future, now)).toBe(5_000);
});

test("parseRetryAfterMs returns null for missing/garbage", () => {
  expect(parseRetryAfterMs(null, 0)).toBe(null);
  expect(parseRetryAfterMs("not-a-date", 0)).toBe(null);
});

test("parseRetryAfterMs never returns a negative wait", () => {
  const now = Date.parse("2026-01-01T00:00:10Z");
  const past = "Thu, 01 Jan 2026 00:00:00 GMT";
  expect(parseRetryAfterMs(past, now)).toBe(0);
});

// --- classify403 (two documented 403 kinds) --------------------------------
test("classify403 → forbidden_product when the body mentions products/service", () => {
  expect(
    classify403("Advertiser does not have access to the product requested"),
  ).toBe("forbidden_product");
  expect(classify403("No access to the service you are requesting")).toBe(
    "forbidden_product",
  );
});

test("classify403 → forbidden_advertiser otherwise (not on integration)", () => {
  expect(classify403("Advertiser 10008899 is not on your advertiser list")).toBe(
    "forbidden_advertiser",
  );
  expect(classify403("")).toBe("forbidden_advertiser");
});

// --- Notification hash authentication --------------------------------------
const SECRET = "test-shared-secret";
const BODY = JSON.stringify({
  notificationType: "ADVERTISER",
  advertiserId: "10008899",
});

test("computeNotificationHash matches a reference HMAC-SHA256 hex", () => {
  const expected = createHmac("sha256", SECRET).update(BODY, "utf8").digest("hex");
  expect(computeNotificationHash(BODY, SECRET)).toBe(expected);
});

test("verifyNotificationHash accepts a correct hash (2XX path)", () => {
  const hash = computeNotificationHash(BODY, SECRET);
  expect(verifyNotificationHash(BODY, hash, SECRET)).toBe(true);
});

test("verifyNotificationHash is case-insensitive on the hex digest", () => {
  const hash = computeNotificationHash(BODY, SECRET).toUpperCase();
  expect(verifyNotificationHash(BODY, hash, SECRET)).toBe(true);
});

test("verifyNotificationHash rejects a tampered body (401 path)", () => {
  const hash = computeNotificationHash(BODY, SECRET);
  expect(verifyNotificationHash(BODY + " ", hash, SECRET)).toBe(false);
});

test("verifyNotificationHash rejects a wrong/short/missing hash", () => {
  expect(verifyNotificationHash(BODY, "deadbeef", SECRET)).toBe(false);
  expect(verifyNotificationHash(BODY, null, SECRET)).toBe(false);
  expect(verifyNotificationHash(BODY, "", SECRET)).toBe(false);
});

test("verifyNotificationHash rejects when the secret is wrong", () => {
  const hash = computeNotificationHash(BODY, SECRET);
  expect(verifyNotificationHash(BODY, hash, "other-secret")).toBe(false);
});

test("verifyNotificationHash returns false when no secret is configured", () => {
  const hash = computeNotificationHash(BODY, SECRET);
  expect(verifyNotificationHash(BODY, hash, "")).toBe(false);
});
