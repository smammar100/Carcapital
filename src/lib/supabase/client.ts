import { createBrowserClient } from "@supabase/ssr";
import { processLock } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Resolve the public-side Supabase key.
 *
 * Supabase's current quickstart names the variable `*_PUBLISHABLE_KEY`
 * (the new `sb_publishable_…` keys). The legacy `*_ANON_KEY` name is
 * still in many deploy environments and is the historical convention for
 * the JWT-based anon key. Accept either so a deployer who follows the
 * latest quickstart (and a project still on the old name) both work.
 */
export function resolveSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Returns the singleton browser Supabase client. Throws a clear error if the
 * NEXT_PUBLIC_* env vars failed to bake in at build time — without this guard
 * a missing var becomes `createBrowserClient(undefined, undefined)` which
 * surfaces as a generic exception deep in the SDK, freezing the auth context
 * and leaving the user staring at a blank dashboard skeleton.
 */
export function createClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = resolveSupabaseAnonKey();

  if (!url || !anonKey) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !anonKey
        ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)"
        : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Supabase client cannot start: ${missing} missing at build time. ` +
        `Add it to your deploy environment (Vercel → Project Settings → Environment Variables) and redeploy.`,
    );
  }

  // `lock: processLock` is the critical bit. The default browser lock uses
  // the Navigator LockManager (Web Locks API), which is shared across tabs
  // and processes. When a tab is backgrounded the browser can freeze it
  // mid-operation while it still holds that lock; on return EVERY auth call
  // — and every DB query, which calls getSession() internally to attach the
  // token — blocks forever waiting on the orphaned lock, so pages hang on
  // "Loading…" until a full refresh. processLock is an in-process
  // promise-chain lock: it can't be held by a frozen/other tab and can't
  // orphan, eliminating the entire tab-switch deadlock class for this SPA.
  cached = createBrowserClient<Database>(url, anonKey, {
    auth: {
      lock: processLock,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}

/** Strongly-typed Update payload for a public-schema table. */
export type TableUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/** Strongly-typed Insert payload for a public-schema table. */
export type TableInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
