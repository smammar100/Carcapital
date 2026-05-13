import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (!cached) {
    cached = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return cached;
}

/** Strongly-typed Update payload for a public-schema table. */
export type TableUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/** Strongly-typed Insert payload for a public-schema table. */
export type TableInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
