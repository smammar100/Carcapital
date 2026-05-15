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

export const dvlaService = {
  async lookup(reg: string): Promise<Partial<Vehicle> | null> {
    try {
      const res = await fetch("/api/dvla/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber: reg }),
      });

      if (res.ok) {
        return (await res.json()) as Partial<Vehicle> | null;
      }

      // 500 (missing key) or 502 (upstream) — fall back to mock if available
      if (res.status === 500 || res.status === 502) {
        const fallback = mockFallback(reg);
        if (fallback) {
          console.warn(
            `[dvla] upstream error ${res.status}; using mock fallback for ${reg}`,
          );
          return fallback;
        }
        throw new Error(`DVLA service error (${res.status})`);
      }

      // 400 / 429 etc — surface a useful error message
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `DVLA lookup failed (${res.status})`);
    } catch (e) {
      // Network failure (fetch threw) — try mock fallback before bailing
      if (e instanceof TypeError) {
        const fallback = mockFallback(reg);
        if (fallback) {
          console.warn(
            `[dvla] network error; using mock fallback for ${reg}`,
          );
          return fallback;
        }
      }
      throw e;
    }
  },
};
