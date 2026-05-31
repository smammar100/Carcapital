import { DVLA_MOCK } from "@/lib/mock-data";
import type { BodyType, Transmission, Vehicle } from "@/lib/types";

const BODY_TYPES = new Set<BodyType>([
  "hatchback",
  "saloon",
  "suv",
  "mpv",
  "estate",
  "convertible",
  "coupe",
]);

/** AutoTrader body strings ("SUV", "Hatchback", …) → our BodyType enum.
 * Returns undefined for vans / unknown shapes so the form keeps its default. */
function normaliseBodyType(raw: string | null): BodyType | undefined {
  if (!raw) return undefined;
  const k = raw.trim().toLowerCase();
  return BODY_TYPES.has(k as BodyType) ? (k as BodyType) : undefined;
}

/** AutoTrader transmission ("Manual" / "Automatic" / "Semi-Automatic") → enum. */
function normaliseTransmission(raw: string | null): Transmission | undefined {
  if (!raw) return undefined;
  const k = raw.trim().toLowerCase();
  if (k === "manual") return "manual";
  if (k.includes("auto")) return "automatic"; // Automatic / Semi-Automatic
  return undefined;
}

/**
 * Vehicle lookup — calls the combined DVLA + DVSA proxy at
 * `/api/vehicle/lookup`. Server-side route fans out to both gov.uk APIs
 * in parallel, merges per spec, and returns the full 17-key payload.
 *
 * Module name kept as `dvla-service.ts` for backward compat with all
 * existing consumers (arrival-form, find-vehicle-card). The default
 * export remains `dvlaService.lookup(reg)` which now returns the merged
 * shape.
 *
 * Behaviour:
 *   - Returns the merged Partial<Vehicle> on success (200 with body).
 *   - Returns null when DVLA doesn't recognise the reg (200 with null body).
 *   - On network failure / 5xx falls back to DVLA_MOCK seed data so demo
 *     mode keeps working without live keys.
 *   - On other 4xx logs + returns null (consumer renders manual-entry).
 *
 * The route's DVLA half is the source of truth for vehicle identity. DVSA
 * is authoritative for `motStatus` + `motExpiryDate` and the route handles
 * the merge — no client-side merging happens here.
 */

function mockFallback(reg: string): DvlaLookupReturn | null {
  // Mock data uses spaced reg keys (e.g. "LX68 CZK") — try both.
  const cleaned = reg.toUpperCase().trim();
  const hit = DVLA_MOCK[cleaned]
    ? DVLA_MOCK[cleaned]
    : Object.entries(DVLA_MOCK).find(
        ([k]) => k.replace(/\s+/g, "") === cleaned.replace(/\s+/g, ""),
      )?.[1] ?? null;
  if (!hit) return null;
  // DVLA_MOCK predates Module-F; pad the missing keys with nulls so the
  // return shape matches DvlaLookupReturn exactly.
  return {
    ...hit,
    registrationDate: null,
    co2Emissions: null,
    euroStatus: null,
    taxStatus: null,
    taxDueDate: null,
    motStatus: null,
    wheelplan: null,
    automatedVehicle: null,
    dateOfLastV5CIssued: null,
    // AutoTrader enrichment is absent in mock fallback.
    derivative: null,
    generation: null,
    trim: null,
    atDerivativeId: null,
    atRetailValuation: null,
    atTradeValuation: null,
    atPartExchangeValuation: null,
  } as DvlaLookupReturn;
}

/** Provenance markers returned by the combined lookup route. */
export type LookupSources = {
  dvla: "ok" | "error";
  dvsa: "ok" | "error" | "missing_credentials";
  autotrader: "ok" | "error" | "missing_credentials";
};

// Hard timeout so the form never hangs on a stuck serverless cold-start,
// a missing DVLA_API_KEY env var, or any other production weirdness. 12s
// is well above DVLA's cold p95 (~2s) and above a worst-case function
// cold-boot — anything past 12s is genuinely broken, not slow. (Vercel
// Fluid Compute reuses instances so cold starts are rare, but the guard
// stays as defence-in-depth.)
const DVLA_TIMEOUT_MS = 12_000;

// --- Combined-route response shape (mirrors VehicleLookupPayload from
// src/app/api/vehicle/lookup/route.ts but kept loose so this module stays
// importable from server-only AND client code).
export interface VehicleLookupResponse {
  registration: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  registrationDate: string | null;
  yearOfManufacture: number | null;
  fuelType: "petrol" | "diesel" | "hybrid" | "electric";
  engineCapacityCC: number | null;
  co2Emissions: number | null;
  euroStatus: string | null;
  vehicleType: "car" | "van" | null;
  wheelplan: string | null;
  automatedVehicle: boolean | null;
  taxStatus: string | null;
  taxDueDate: string | null;
  motStatus: string | null;
  motExpiryDate: string | null;
  motSource?: "dvsa" | "autotrader" | "dvla" | null;
  dateOfLastV5CIssued: string | null;
  // AutoTrader taxonomy + valuation (whole GBP)
  derivative: string | null;
  derivativeId: string | null;
  generation: string | null;
  trim: string | null;
  bodyType: string | null;
  transmission: string | null;
  retailValuation: number | null;
  tradeValuation: number | null;
  partExchangeValuation: number | null;
  privateValuation: number | null;
  sources?: LookupSources;
}

/** Looser return shape: a Partial<Vehicle> for the fields the existing form
 * already binds against, plus the route's provenance markers and the
 * derived registrationDate (ISO date) for the Compliance card. */
export type DvlaLookupReturn = Partial<Vehicle> & {
  registrationDate: string | null;
  /** AutoTrader valuations (whole GBP) — surfaced on the form + Financials. */
  retailValuation: number | null;
  tradeValuation: number | null;
  partExchangeValuation: number | null;
  privateValuation: number | null;
  /** Which upstream supplied the MOT fields (F-AT4). */
  motSource?: "dvsa" | "autotrader" | "dvla" | null;
  sources?: LookupSources;
};

/** Map the combined route's payload onto the existing form-state shape so
 * arrival-form callers don't need to learn new field names. The form reads
 * `make / year / colour / fuelType / engineSizeCC / motExpiry` today; we
 * keep those keys and add the eight new compliance fields alongside. */
function toFormPartial(p: VehicleLookupResponse): DvlaLookupReturn {
  return {
    make: p.make ?? undefined,
    model: p.model ?? undefined,
    year: p.yearOfManufacture ?? undefined,
    colour: p.colour ?? undefined,
    fuelType: p.fuelType,
    vehicleType: p.vehicleType ?? undefined,
    engineSizeCC: p.engineCapacityCC ?? undefined,
    motExpiry: p.motExpiryDate,
    firstRegisteredDate: p.registrationDate,
    // Module-F compliance fields
    co2Emissions: p.co2Emissions,
    euroStatus: p.euroStatus,
    taxStatus: p.taxStatus,
    taxDueDate: p.taxDueDate,
    motStatus: p.motStatus,
    wheelplan: p.wheelplan,
    automatedVehicle: p.automatedVehicle,
    dateOfLastV5CIssued: p.dateOfLastV5CIssued,
    registrationDate: p.registrationDate,
    // AutoTrader taxonomy → Vehicle fields (derivative/generation/trim live
    // on Vehicle now); valuations surfaced separately on the return.
    derivative: p.derivative,
    generation: p.generation,
    trim: p.trim,
    atDerivativeId: p.derivativeId,
    // AutoTrader body/transmission, normalised onto the Vehicle enums so the
    // form's Body Type + Transmission selects auto-fill (DVLA omits both).
    bodyType: normaliseBodyType(p.bodyType),
    transmission: normaliseTransmission(p.transmission),
    retailValuation: p.retailValuation,
    tradeValuation: p.tradeValuation,
    partExchangeValuation: p.partExchangeValuation,
    privateValuation: p.privateValuation,
    motSource: p.motSource ?? null,
    sources: p.sources,
  };
}

export const dvlaService = {
  /**
   * Look up a registration via the combined DVLA + DVSA + AutoTrader route.
   * Pass `opts.mileage` to unlock AutoTrader valuations (they can't value a
   * car without it). `opts.force` bypasses the route's 60-min cache.
   */
  async lookup(
    reg: string,
    opts: { mileage?: number; force?: boolean } = {},
  ): Promise<DvlaLookupReturn | null> {
    // This service is deliberately non-throwing. Every failure mode collapses
    // to `null` + a console.warn so consumers (arrival-form, find-vehicle-card)
    // can show a "not found / manual entry" state without try/catch. Throwing
    // here used to surface as a "Invalid registration format" error in the
    // Next.js dev overlay every time someone tabbed out of a half-typed reg.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DVLA_TIMEOUT_MS);
    try {
      const res = await fetch("/api/vehicle/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: reg,
          mileage: opts.mileage,
          force: opts.force,
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const body = (await res.json()) as VehicleLookupResponse | null;
        if (!body) return null;
        return toFormPartial(body);
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
