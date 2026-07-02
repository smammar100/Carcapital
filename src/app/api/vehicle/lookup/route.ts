/**
 * Combined DVLA + DVSA + AutoTrader vehicle lookup.
 *
 * Fans out to DVLA VES, the DVSA MOT History API, and AutoTrader Connect
 * in parallel, then merges:
 *   - DVLA is authoritative for vehicle identity, tax, V5C, CO₂, Euro,
 *     wheelplan, automation flag, registration date, vehicle type.
 *   - DVSA is authoritative for `motStatus` + `motExpiryDate`. If DVSA
 *     succeeds, we discard DVLA's MOT fields.
 *   - AutoTrader fills `model` / `derivative` / `generation` / `trim`
 *     (DVLA returns model=null) and adds retail/trade/part-ex valuations.
 *   - If only DVLA succeeds → fall back to DVLA's MOT fields.
 *   - If DVLA fails (404 or error) → return `null` (vehicle not found).
 *
 * Valuations need a mileage, so the request body may carry `mileage`; the
 * cache key includes it (taxonomy is mileage-independent, valuations are
 * not). Cache: 60-minute in-memory LRU (max 200 entries).
 */

import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import {
  DvlaError,
  lookupDvlaVehicle,
  normaliseReg,
  type DvlaLookupResult,
} from "@/lib/services/dvla-server";
import {
  DvsaError,
  lookupMotHistory,
  type DvsaLookupResult,
} from "@/lib/services/dvsa-service";
import {
  AutotraderError,
  lookupAutotraderVehicle,
  type AutotraderLookupResult,
} from "@/lib/services/autotrader-service";

export const runtime = "nodejs";

// ---- Cache: 60 min TTL, max 200 entries ---------------------------------
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

interface CacheEntry {
  body: VehicleLookupPayload | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): CacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function cacheSet(key: string, body: VehicleLookupPayload | null): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { body, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---- Public response shape -----------------------------------------------
export interface VehicleLookupPayload {
  registration: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  registrationDate: string | null;
  yearOfManufacture: number | null;
  fuelType: DvlaLookupResult["fuelType"];
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
  dateOfLastV5CIssued: string | null;
  // --- AutoTrader taxonomy + valuation (whole GBP) ---
  derivative: string | null;
  derivativeId: string | null;
  generation: string | null;
  trim: string | null;
  /** Raw AutoTrader body/transmission (e.g. "SUV", "Manual") — the client
   * normalises these onto the Vehicle enums when filling the form. */
  bodyType: string | null;
  transmission: string | null;
  retailValuation: number | null;
  tradeValuation: number | null;
  partExchangeValuation: number | null;
  privateValuation: number | null;
  /** Which upstream supplied motStatus/motExpiryDate (F-AT4 tiering). */
  motSource: "dvsa" | "autotrader" | "dvla" | null;
  /** Provenance — useful for the UI to badge "verified" or warn. */
  sources: {
    dvla: "ok" | "error";
    dvsa: "ok" | "error" | "missing_credentials";
    autotrader: "ok" | "error" | "missing_credentials";
  };
}

// ---- MOT tiering (F-AT4) -------------------------------------------------
// DVSA is authoritative when it succeeded AND actually returned tests.
// AutoTrader's motTests-derived status is tier 2 (works while the DVSA WAF
// blocks us). DVLA's coarse motStatus/motExpiryDate is the last resort.
// "No MOT history" is treated as empty so a populated lower tier wins.
function pickMot(
  dvla: DvlaLookupResult,
  dvsa: DvsaLookupResult | null,
  dvsaSource: VehicleLookupPayload["sources"]["dvsa"],
  at: AutotraderLookupResult | null,
): {
  status: string | null;
  expiryDate: string | null;
  source: VehicleLookupPayload["motSource"];
} {
  const populated = (s: string | null | undefined) =>
    !!s && s !== "No MOT history";

  type MotCandidate = {
    status: string | null;
    expiryDate: string | null;
    source: VehicleLookupPayload["motSource"];
  };

  // Collect every source that produced a real MOT signal, in priority order
  // (DVSA detailed → AutoTrader detailed → DVLA coarse).
  const candidates: MotCandidate[] = [];
  if (dvsaSource === "ok" && dvsa && populated(dvsa.motStatus)) {
    candidates.push({
      status: dvsa.motStatus,
      expiryDate: dvsa.motExpiryDate,
      source: "dvsa",
    });
  }
  if (at && populated(at.motStatus)) {
    candidates.push({
      status: at.motStatus,
      expiryDate: at.motExpiryDate,
      source: "autotrader",
    });
  }
  if (populated(dvla.motStatus)) {
    candidates.push({
      status: dvla.motStatus,
      expiryDate: dvla.motExpiryDate,
      source: "dvla",
    });
  }

  if (!candidates.length) {
    // Nothing populated anywhere — surface DVSA's empty result if we have it,
    // else null. Keeps the "No MOT history" wording when that's genuinely true.
    const fallback = dvsa?.motStatus ?? at?.motStatus ?? dvla.motStatus ?? null;
    return {
      status: fallback,
      expiryDate: dvla.motExpiryDate ?? null,
      source: fallback ? "dvla" : null,
    };
  }

  // An MOT renewal only ever pushes the expiry further out, so the source
  // holding the furthest-future expiry is the most current record — prefer it
  // (its status is consistent with that date: future ⇒ Valid, past ⇒ expired).
  // This stops a stale AutoTrader/DVSA test-history snapshot from masking
  // DVLA's live `motExpiryDate` — the EK18FUT case where AutoTrader's sandbox
  // history ended 2026-03-01 but DVLA holds the real 2027-05-21 expiry. When no
  // candidate carries an expiry, fall back to source priority (candidates[0]).
  const withExpiry = candidates.filter((c) => c.expiryDate);
  if (withExpiry.length) {
    return withExpiry.reduce((best, c) =>
      (c.expiryDate as string) > (best.expiryDate as string) ? c : best,
    );
  }
  return candidates[0];
}

// ---- Merge ---------------------------------------------------------------
function mergePayload(
  dvla: DvlaLookupResult,
  dvsa: DvsaLookupResult | null,
  dvsaSource: VehicleLookupPayload["sources"]["dvsa"],
  at: AutotraderLookupResult | null,
  atSource: VehicleLookupPayload["sources"]["autotrader"],
): VehicleLookupPayload {
  const mot = pickMot(dvla, dvsa, dvsaSource, at);
  return {
    registration: dvla.registration,
    make: dvla.make,
    // DVLA never returns model → fall back to AutoTrader's taxonomy.
    model: dvla.model ?? at?.model ?? null,
    colour: dvla.colour,
    registrationDate: dvla.registrationDate,
    yearOfManufacture: dvla.yearOfManufacture,
    fuelType: dvla.fuelType,
    // AutoTrader can fill engine size / CO₂ when DVLA omits them.
    engineCapacityCC: dvla.engineCapacityCC ?? at?.engineCapacityCC ?? null,
    co2Emissions: dvla.co2Emissions ?? at?.co2Emissions ?? null,
    euroStatus: dvla.euroStatus,
    vehicleType: dvla.vehicleType,
    wheelplan: dvla.wheelplan,
    automatedVehicle: dvla.automatedVehicle,
    taxStatus: dvla.taxStatus,
    taxDueDate: dvla.taxDueDate,
    // F-AT4 — three-tier MOT: DVSA (authoritative, when it works and has
    // data) → AutoTrader motTests (works while DVSA is WAF-blocked) → DVLA
    // coarse fields (last resort). `mot` is computed below.
    motStatus: mot.status,
    motExpiryDate: mot.expiryDate,
    motSource: mot.source,
    dateOfLastV5CIssued: dvla.dateOfLastV5CIssued,
    // AutoTrader taxonomy + valuations
    derivative: at?.derivative ?? null,
    derivativeId: at?.derivativeId ?? null,
    generation: at?.generation ?? null,
    trim: at?.trim ?? null,
    // AutoTrader also supplies body + transmission (DVLA VES does not).
    bodyType: at?.bodyType ?? null,
    transmission: at?.transmission ?? null,
    retailValuation: at?.retailValuation ?? null,
    tradeValuation: at?.tradeValuation ?? null,
    partExchangeValuation: at?.partExchangeValuation ?? null,
    privateValuation: at?.privateValuation ?? null,
    sources: {
      dvla: "ok",
      dvsa: dvsaSource,
      autotrader: atSource,
    },
  };
}

// ---- POST /api/vehicle/lookup -------------------------------------------
export async function POST(request: Request) {
  // AuthZ: must be a signed-in, active user (any role).
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  // Per-user limit: every call can burn DVLA/DVSA/AutoTrader quota
  // (DVLA free tier is 1,000/day). Generous enough for bulk intake sessions.
  const limit = rateLimit(`vehicle-lookup:${actor.id}`, {
    max: 30,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let payload: {
    registrationNumber?: string;
    force?: boolean;
    mileage?: number;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }

  const rawReg = payload.registrationNumber;
  if (!rawReg || typeof rawReg !== "string" || !rawReg.trim()) {
    return NextResponse.json(
      { error: "registration_required" },
      { status: 400 },
    );
  }

  const reg = normaliseReg(rawReg);
  if (!/^[A-Z0-9]{1,8}$/.test(reg)) {
    return NextResponse.json(
      { error: "invalid_registration" },
      { status: 400 },
    );
  }

  // Valuations depend on mileage, so the cache key buckets by it. Taxonomy
  // is mileage-independent but caching the whole merged payload per
  // (reg, mileage) is simplest and correct.
  const mileage =
    typeof payload.mileage === "number" && payload.mileage > 0
      ? Math.round(payload.mileage)
      : null;
  const cacheKey = mileage === null ? reg : `${reg}:${mileage}`;

  // Cache short-circuit unless the caller explicitly bypassed via
  // { force: true } — that path powers the ComplianceCard's "Re-fetch"
  // button so Ali can re-pull on demand without waiting an hour.
  const url = new URL(request.url);
  const forceFromQs = url.searchParams.get("force") === "1";
  const force = payload.force === true || forceFromQs;
  if (!force) {
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) {
      return NextResponse.json(cached.body, {
        headers: { "x-cache": "hit" },
      });
    }
  }

  // Fan-out: DVLA + DVSA + AutoTrader in parallel.
  const [dvlaResult, dvsaResult, atResult] = await Promise.allSettled([
    lookupDvlaVehicle(reg),
    lookupMotHistory(reg),
    lookupAutotraderVehicle(reg, mileage ? { mileage } : {}),
  ]);

  // --- DVLA handling ---
  if (dvlaResult.status === "rejected") {
    const err = dvlaResult.reason;
    if (err instanceof DvlaError) {
      if (err.code === "rate_limited") {
        return NextResponse.json(
          { error: "dvla_rate_limited" },
          { status: 429 },
        );
      }
      if (err.code === "invalid_format") {
        return NextResponse.json(
          { error: "invalid_registration" },
          { status: 400 },
        );
      }
      // missing_credentials / network / timeout / upstream_error → 502
      console.warn(`[vehicle-lookup] DVLA failed: ${err.code}: ${err.message}`);
      return NextResponse.json(
        { error: "dvla_unavailable", code: err.code },
        { status: 502 },
      );
    }
    console.warn(`[vehicle-lookup] DVLA threw non-DvlaError`, err);
    return NextResponse.json(
      { error: "dvla_unavailable" },
      { status: 502 },
    );
  }

  // DVLA succeeded but returned null → registration not found.
  if (dvlaResult.value === null) {
    cacheSet(cacheKey, null);
    return NextResponse.json(null);
  }

  // --- DVSA handling (best-effort — never blocks the response) ---
  let dvsa: DvsaLookupResult | null = null;
  let dvsaSource: VehicleLookupPayload["sources"]["dvsa"] = "ok";
  if (dvsaResult.status === "fulfilled") {
    dvsa = dvsaResult.value;
  } else {
    const err = dvsaResult.reason;
    if (err instanceof DvsaError && err.code === "missing_credentials") {
      dvsaSource = "missing_credentials";
      console.warn("[vehicle-lookup] DVSA credentials missing — MOT fields fall back to DVLA");
    } else {
      dvsaSource = "error";
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[vehicle-lookup] DVSA failed: ${msg}`);
    }
  }

  // --- AutoTrader handling (best-effort — never blocks the response) ---
  let at: AutotraderLookupResult | null = null;
  let atSource: VehicleLookupPayload["sources"]["autotrader"] = "ok";
  if (atResult.status === "fulfilled") {
    at = atResult.value;
  } else {
    const err = atResult.reason;
    if (err instanceof AutotraderError && err.code === "missing_credentials") {
      atSource = "missing_credentials";
      console.warn("[vehicle-lookup] AutoTrader credentials missing — taxonomy/valuation omitted");
    } else {
      atSource = "error";
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[vehicle-lookup] AutoTrader failed: ${msg}`);
    }
  }

  const merged = mergePayload(dvlaResult.value, dvsa, dvsaSource, at, atSource);
  cacheSet(cacheKey, merged);
  return NextResponse.json(merged, {
    headers: { "x-cache": "miss" },
  });
}
