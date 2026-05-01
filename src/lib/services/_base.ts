/**
 * Shared helpers for the service layer.
 *
 * All services import `delay()` from here so the latency simulation has a
 * single knob. When Supabase replaces the mock store, delete this file's
 * `delay` calls — real network gives real latency.
 */

export const delay = (ms = 300): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function newId(prefix: string = "id"): string {
  // Browser-only path: crypto.randomUUID is widely supported.
  // TODO: Supabase: replace with `gen_random_uuid()` Postgres default.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
