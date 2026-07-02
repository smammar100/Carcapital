/**
 * Pins the middleware security invariant: the unverified-JWT cookie check is
 * ROUTING-ONLY. A forged cookie (valid shape, future exp, no real session)
 * may skip the login fast-redirect, but updateSession must still redirect to
 * /login because the authoritative supabase.auth.getUser() returns no user.
 * If a refactor ever makes the fast path grant access, these tests fail.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The authoritative check — force "no session" regardless of cookies.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  }),
}));

import { hasFreshAuthCookie, updateSession } from "./middleware";

function forgedAuthCookieValue(expOffsetSeconds: number): string {
  // Unsigned JWT with an arbitrary exp — trivially forgeable by an attacker.
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }),
  ).toString("base64");
  const accessToken = `header.${payload}.signature`;
  return JSON.stringify([accessToken, "refresh-token"]);
}

function requestWithCookie(path: string, cookieValue?: string): NextRequest {
  const req = new NextRequest(`http://localhost${path}`);
  if (cookieValue !== undefined) {
    req.cookies.set("sb-test-auth-token", cookieValue);
  }
  return req;
}

describe("hasFreshAuthCookie", () => {
  it("false with no cookie", () => {
    expect(hasFreshAuthCookie(requestWithCookie("/dashboard"))).toBe(false);
  });

  it("false with an expired token", () => {
    expect(
      hasFreshAuthCookie(
        requestWithCookie("/dashboard", forgedAuthCookieValue(-3600)),
      ),
    ).toBe(false);
  });

  it("false with garbage cookie content", () => {
    expect(
      hasFreshAuthCookie(requestWithCookie("/dashboard", "not-json")),
    ).toBe(false);
  });

  it("true with a fresh-looking token — which must NOT mean authenticated", () => {
    expect(
      hasFreshAuthCookie(
        requestWithCookie("/dashboard", forgedAuthCookieValue(3600)),
      ),
    ).toBe(true);
  });
});

describe("updateSession — forged cookies never grant access", () => {
  it("no cookie → fast-redirects to /login", async () => {
    const res = await updateSession(requestWithCookie("/dashboard"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("FORGED fresh cookie → still redirected to /login by the authoritative check", async () => {
    const res = await updateSession(
      requestWithCookie("/dashboard", forgedAuthCookieValue(3600)),
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("public paths pass through without a session", async () => {
    const res = await updateSession(requestWithCookie("/login"));
    expect(res.headers.get("location")).toBeNull();
  });
});
