import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, clientIp, _resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    _resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to max hits within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", { max: 5, windowMs: 1000 }).ok).toBe(true);
    }
    expect(rateLimit("k", { max: 5, windowMs: 1000 }).ok).toBe(false);
  });

  it("reports retryAfterSeconds when limited", () => {
    rateLimit("k", { max: 1, windowMs: 30_000 });
    const res = rateLimit("k", { max: 1, windowMs: 30_000 });
    expect(res.ok).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(res.retryAfterSeconds).toBeLessThanOrEqual(30);
  });

  it("frees slots as the window slides", () => {
    rateLimit("k", { max: 1, windowMs: 1000 });
    expect(rateLimit("k", { max: 1, windowMs: 1000 }).ok).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("k", { max: 1, windowMs: 1000 }).ok).toBe(true);
  });

  it("keys are independent", () => {
    rateLimit("a", { max: 1, windowMs: 1000 });
    expect(rateLimit("a", { max: 1, windowMs: 1000 }).ok).toBe(false);
    expect(rateLimit("b", { max: 1, windowMs: 1000 }).ok).toBe(true);
  });

  it("a rejected hit does not consume a slot", () => {
    rateLimit("k", { max: 1, windowMs: 1000 });
    // Hammering while limited must not extend the lockout.
    for (let i = 0; i < 10; i++) rateLimit("k", { max: 1, windowMs: 1000 });
    vi.advanceTimersByTime(1001);
    expect(rateLimit("k", { max: 1, windowMs: 1000 }).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for hop", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip then 'unknown'", () => {
    expect(
      clientIp(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } })),
    ).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
