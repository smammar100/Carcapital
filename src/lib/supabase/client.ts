import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

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
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
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
