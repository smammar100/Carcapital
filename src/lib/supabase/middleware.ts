import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/join",
];

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Best-effort presence check on the Supabase auth cookie.
 *
 * SECURITY: the JWT here is NOT signature-verified, so a positive result must
 * NEVER be trusted to grant authenticated access — an attacker can forge an
 * unsigned token with a future `exp`. This is used ONLY to fail-closed: when it
 * returns `false` we know there is definitely no usable session and can
 * short-circuit straight to a login redirect, skipping the Supabase round-trip.
 * A `true` result means "maybe a session" and ALWAYS falls through to the
 * authoritative `supabase.auth.getUser()` check below.
 *
 * Returns `true` when a plausibly-fresh session cookie is present.
 */
export function hasFreshAuthCookie(request: NextRequest): boolean {
  const tokenCookie = request.cookies
    .getAll()
    .find(
      (c) =>
        c.name.startsWith("sb-") &&
        c.name.endsWith("-auth-token") &&
        c.value.length > 0,
    );
  if (!tokenCookie) return false;

  try {
    // Supabase stores either a JSON array `[access_token, refresh_token, ...]`
    // or a base64 prefix followed by JSON. Strip the prefix if present.
    let raw = tokenCookie.value;
    if (raw.startsWith("base64-")) {
      raw = atob(raw.slice("base64-".length));
    }
    const parsed = JSON.parse(raw) as
      | [string, string, ...unknown[]]
      | { access_token?: string };
    const accessToken = Array.isArray(parsed)
      ? parsed[0]
      : parsed.access_token;
    if (!accessToken) return false;
    const payload = JSON.parse(atob(accessToken.split(".")[1])) as {
      exp?: number;
    };
    if (!payload.exp) return false;
    const expiresInSeconds = payload.exp - Math.floor(Date.now() / 1000);
    return expiresInSeconds > 60;
  } catch {
    return false;
  }
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // /warranties redirect runs regardless of auth state.
  if (pathname === "/warranties") {
    const url = request.nextUrl.clone();
    url.pathname = "/warranties/in-house";
    return NextResponse.redirect(url);
  }

  // Fail-closed fast path: protected page with NO plausible session cookie →
  // we know there's no session, so redirect to /login without the Supabase
  // round-trip. We must NOT use a positive cookie result to grant access here
  // (the JWT is unverified and forgeable); a "maybe a session" always falls
  // through to the authoritative supabase.auth.getUser() check below.
  if (!isPublic && pathname !== "/" && !hasFreshAuthCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting the root → send to the dashboard. We deliberately
  // do NOT redirect /login→/dashboard here: /login is owned by the client, which
  // force-signs-out any pre-existing session so account-switchers land on a
  // usable form. A middleware redirect would race that sign-out and bounce the
  // user back in as the old account.
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
