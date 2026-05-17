import { DVLA_MOCK } from "@/lib/mock-data";
import type { Vehicle } from "@/lib/types";

/**
 * DVLA lookup — calls the live Vehicle Enquiry Service v1 via our server
 * proxy at /api/dvla/lookup. The API key lives in `.env.local` (server-side
 * only) — see src/app/api/dvla/lookup/route.ts.
 *
 * Consumers:
 *   - src/components/vehicles/arrival-form.tsx (DVLA-fills the form on reg blur)
 *   - src/components/dashboard/find-vehicle-card.tsx (jump-to-vehicle widget)
 *
 * Behaviour:
 *   - Returns Partial<Vehicle> on success (200 with body).
 *   - Returns null when DVLA doesn't recognise the reg (200 with null body).
 *   - On network failure or 5xx, falls back to the DVLA_MOCK seed data if the
 *     reg is present there — keeps the demo working in offline / no-key dev
 *     mode.
 *   - On 4xx other than 404, throws so consumers can show an error toast.
 *
 * Note: live DVLA VES does NOT return `model`. Expect `model` to be null on
 * the returned object even when the lookup succeeds.
 */

function mockFallback(reg: string): Partial<Vehicle> | null {
  // Mock data uses spaced reg keys (e.g. "LX68 CZK") — try both.
  const cleaned = reg.toUpperCase().trim();
  if (DVLA_MOCK[cleaned]) return DVLA_MOCK[cleaned];
  // Try normalised (no spaces) match against keys
  const normalised = cleaned.replace(/\s+/g, "");
  const hit = Object.entries(DVLA_MOCK).find(
    ([k]) => k.replace(/\s+/g, "") === normalised,
  );
  return hit ? hit[1] : null;
}

// Hard timeout so the form never hangs on a stuck serverless cold-start,
// a missing DVLA_API_KEY env var, or any other production weirdness. 12s
// is well above DVLA's cold p95 (~2s) and above a worst-case function
// cold-boot — anything past 12s is genuinely broken, not slow. (Vercel
// Fluid Compute reuses instances so cold starts are rare, but the guard
// stays as defence-in-depth.)
const DVLA_TIMEOUT_MS = 12_000;

export const dvlaService = {
  async lookup(reg: string): Promise<Partial<Vehicle> | null> {
    // This service is deliberately non-throwing. Every failure mode collapses
    // to `null` + a console.warn so consumers (arrival-form, find-vehicle-card)
    // can show a "not found / manual entry" state without try/catch. Throwing
    // here used to surface as a "Invalid registration format" error in the
    // Next.js dev overlay every time someone tabbed out of a half-typed reg.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DVLA_TIMEOUT_MS);
    try {
      const res = await fetch("/api/dvla/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber: reg }),
        signal: controller.signal,
      });

      if (res.ok) {
        return (await res.json()) as Partial<Vehicle> | null;
      }

      // 500 (missing key) or 502 (upstream) — try mock fallback first
      if (res.status === 500 || res.status === 502) {
        const fallback = mockFallback(reg);
        if (fallback) {
          console.warn(
            `[dvla] upstream error ${res.status}; using mock fallback for ${reg}`,
          );
          return fallback;
        }
      }

      // 400 (invalid format), 429 (rate limit), 403 (bad key), 502 etc —
      // log and return null. The caller renders the "Manual entry required"
      // state, which is the right UX for every one of these.
      const body = await res.json().catch(() => ({}));
      console.warn(
        `[dvla] lookup failed for ${reg}: ${res.status} ${body?.error ?? ""}`,
      );
      return null;
    } catch (e) {
      // AbortError fires when our 12s timeout trips. Network failures (fetch
      // threw, not a non-ok response) come through as TypeError. In both
      // cases, try mock data before giving up so demos keep working.
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (aborted) {
        console.warn(`[dvla] lookup timed out after ${DVLA_TIMEOUT_MS}ms for ${reg}`);
      }
      if (aborted || e instanceof TypeError) {
        const fallback = mockFallback(reg);
        if (fallback) {
          console.warn(
            `[dvla] ${aborted ? "timeout" : "network error"}; using mock fallback for ${reg}`,
          );
          return fallback;
        }
      }
      console.warn(`[dvla] lookup error for ${reg}:`, e);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  },
};
