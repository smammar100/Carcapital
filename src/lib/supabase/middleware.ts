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
 * Quick presence/freshness check on the Supabase auth cookie. When the
 * `sb-<ref>-auth-token` cookie exists and the embedded JWT exp is more than
 * 60s in the future, we can trust the session is still valid and skip the
 * full `supabase.auth.getUser()` round-trip to Supabase. Saves ~150–400 ms
 * of TTFB on every page navigation. The Supabase auto-refresh handler in
 * the browser keeps the cookie fresh well before it actually expires.
 *
 * Returns `true` when a definitely-fresh session cookie is present.
 */
function hasFreshAuthCookie(request: NextRequest): boolean {
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

  // Fast path: protected page + fresh access-token cookie → trust the
  // cookie and skip the Supabase round-trip. Cuts TTFB by 150–400 ms.
  if (!isPublic && pathname !== "/" && hasFreshAuthCookie(request)) {
    return NextResponse.next({ request });
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

  if (user && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
