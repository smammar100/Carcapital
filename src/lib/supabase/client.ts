import { createBrowserClient } from "@supabase/ssr";
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
      `Supabase client cannot start — ${missing} missing at build time. ` +
        `Add it to your deploy environment (Netlify → Site settings → Environment variables) and redeploy.`,
    );
  }

  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}

/** Strongly-typed Update payload for a public-schema table. */
export type TableUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/** Strongly-typed Insert payload for a public-schema table. */
export type TableInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
