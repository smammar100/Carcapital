/**
 * Combined DVLA + DVSA vehicle lookup.
 *
 * Fans out to DVLA VES and the DVSA MOT History API in parallel, merges
 * per Module-F spec §2:
 *   - DVLA is authoritative for vehicle identity, tax, V5C, CO₂, Euro,
 *     wheelplan, automation flag, registration date, vehicle type.
 *   - DVSA is authoritative for `motStatus` + `motExpiryDate`. If DVSA
 *     succeeds, we discard DVLA's MOT fields.
 *   - If only DVLA succeeds → fall back to DVLA's MOT fields.
 *   - If DVLA fails (404 or error) → return `null` (vehicle not found).
 *
 * Cache: 60-minute in-memory LRU (max 200 entries). Separate from the
 * /api/dvla/lookup cache so behaviour-by-route is clear.
 */

import { NextResponse } from "next/server";
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
  /** Provenance — useful for the UI to badge "verified" or warn. */
  sources: {
    dvla: "ok" | "error";
    dvsa: "ok" | "error" | "missing_credentials";
  };
}

// ---- Merge ---------------------------------------------------------------
function mergePayload(
  dvla: DvlaLookupResult,
  dvsa: DvsaLookupResult | null,
  dvsaSource: VehicleLookupPayload["sources"]["dvsa"],
): VehicleLookupPayload {
  return {
    registration: dvla.registration,
    make: dvla.make,
    model: dvla.model,
    colour: dvla.colour,
    registrationDate: dvla.registrationDate,
    yearOfManufacture: dvla.yearOfManufacture,
    fuelType: dvla.fuelType,
    engineCapacityCC: dvla.engineCapacityCC,
    co2Emissions: dvla.co2Emissions,
    euroStatus: dvla.euroStatus,
    vehicleType: dvla.vehicleType,
    wheelplan: dvla.wheelplan,
    automatedVehicle: dvla.automatedVehicle,
    taxStatus: dvla.taxStatus,
    taxDueDate: dvla.taxDueDate,
    // DVSA wins for MOT when available; fall back to DVLA's MOT fields.
    motStatus: dvsa?.motStatus ?? dvla.motStatus,
    motExpiryDate: dvsa?.motExpiryDate ?? dvla.motExpiryDate,
    dateOfLastV5CIssued: dvla.dateOfLastV5CIssued,
    sources: {
      dvla: "ok",
      dvsa: dvsaSource,
    },
  };
}

// ---- POST /api/vehicle/lookup -------------------------------------------
export async function POST(request: Request) {
  let payload: { registrationNumber?: string; force?: boolean };
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

  // Cache short-circuit unless the caller explicitly bypassed via
  // { force: true } — that path powers the ComplianceCard's "Re-fetch"
  // button so Ali can re-pull DVLA + DVSA on demand without waiting an
  // hour for the LRU to expire.
  const url = new URL(request.url);
  const forceFromQs = url.searchParams.get("force") === "1";
  const force = payload.force === true || forceFromQs;
  if (!force) {
    const cached = cacheGet(reg);
    if (cached !== undefined) {
      return NextResponse.json(cached.body, {
        headers: { "x-cache": "hit" },
      });
    }
  }

  // Fan-out: DVLA + DVSA in parallel.
  const [dvlaResult, dvsaResult] = await Promise.allSettled([
    lookupDvlaVehicle(reg),
    lookupMotHistory(reg),
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
    cacheSet(reg, null);
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

  const merged = mergePayload(dvlaResult.value, dvsa, dvsaSource);
  cacheSet(reg, merged);
  return NextResponse.json(merged, {
    headers: { "x-cache": "miss" },
  });
}
