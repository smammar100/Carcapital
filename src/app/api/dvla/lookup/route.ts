/**
 * DVLA Vehicle Enquiry Service (VES) v1 proxy.
 *
 * Why a proxy at all: the DVLA API key (`process.env.DVLA_API_KEY`) must never
 * reach the browser. Any browser-side code that needs vehicle lookup calls
 * THIS endpoint, which adds the `x-api-key` header server-side and forwards
 * to gov.uk.
 *
 * Maps the DVLA response shape to our internal `Partial<Vehicle>` so the
 * existing dvlaService consumers (find-vehicle-card, arrival-form) don't
 * change. Note: DVLA does NOT return `model` — that field is always `null`
 * after this change; users fill it manually in the arrival form.
 *
 * Caching: 60-minute in-memory LRU (max 200 entries). DVLA data rarely
 * changes day-to-day, and the free tier is limited to 1000 req/day. The
 * cache also makes repeat lookups (dev / demo) feel instant.
 *
 * Key rotation: DVLA Open Data keys rotate periodically. When the upstream
 * starts returning 403, refresh the key at the DVLA portal and update
 * `.env.local` (DEVELOPER ACTION REQUIRED — not automated).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DVLA_ENDPOINT =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

// ---- Cache: 60 min TTL, max 200 entries ---------------------------------
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

interface CacheEntry {
  body: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  // LRU bump — re-insert to refresh insertion order
  cache.delete(key);
  cache.set(key, entry);
  return entry.body;
}

function cacheSet(key: string, body: unknown): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { body, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---- Fuel-type mapping --------------------------------------------------
function mapFuelType(dvla: string | undefined): string {
  switch ((dvla ?? "").toUpperCase()) {
    case "PETROL":
      return "petrol";
    case "DIESEL":
      return "diesel";
    case "ELECTRICITY":
    case "ELECTRIC":
      return "electric";
    case "HYBRID ELECTRIC":
    case "PETROL HYBRID":
    case "PETROL/ELECTRIC":
    case "PETROL/ELECTRIC HYBRID":
      return "hybrid";
    default:
      return "petrol"; // safe fallback
  }
}

function titleCase(s: string | undefined): string | null {
  if (!s) return null;
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normaliseReg(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

// ---- DVLA response shape (only fields we use) --------------------------
interface DvlaResponse {
  registrationNumber?: string;
  make?: string;
  yearOfManufacture?: number;
  colour?: string;
  fuelType?: string;
  engineCapacity?: number;
  motExpiryDate?: string; // YYYY-MM-DD
  motStatus?: string;
  monthOfFirstRegistration?: string; // YYYY-MM
}

// ---- POST /api/dvla/lookup --------------------------------------------
export async function POST(request: Request) {
  const apiKey = process.env.DVLA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DVLA_API_KEY not configured" },
      { status: 500 },
    );
  }

  let payload: { registrationNumber?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const rawReg = payload.registrationNumber;
  if (!rawReg || typeof rawReg !== "string" || !rawReg.trim()) {
    return NextResponse.json(
      { error: "Registration required" },
      { status: 400 },
    );
  }

  const reg = normaliseReg(rawReg);
  if (!/^[A-Z0-9]{1,8}$/.test(reg)) {
    return NextResponse.json(
      { error: "Invalid registration format" },
      { status: 400 },
    );
  }

  // Cache hit short-circuits before any upstream call
  const cached = cacheGet(reg);
  if (cached !== undefined) {
    return NextResponse.json(cached);
  }

  let upstream: Response;
  try {
    upstream = await fetch(DVLA_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ registrationNumber: reg }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "DVLA service unreachable", detail: String(e) },
      { status: 502 },
    );
  }

  if (upstream.status === 404) {
    // Vehicle not found — cache the null so repeat misses are cheap
    cacheSet(reg, null);
    return NextResponse.json(null, { status: 200 });
  }

  if (upstream.status === 400) {
    const body = await upstream.text();
    return NextResponse.json(
      { error: "DVLA rejected the registration", detail: body },
      { status: 400 },
    );
  }

  if (upstream.status === 429) {
    console.warn("[dvla] rate-limited by upstream");
    return NextResponse.json(
      { error: "DVLA rate limit exceeded — try again shortly" },
      { status: 429 },
    );
  }

  if (upstream.status === 403) {
    return NextResponse.json(
      { error: "DVLA rejected the API key — rotate the key and retry" },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `DVLA upstream error ${upstream.status}` },
      { status: 502 },
    );
  }

  let dvla: DvlaResponse;
  try {
    dvla = (await upstream.json()) as DvlaResponse;
  } catch {
    return NextResponse.json(
      { error: "DVLA returned non-JSON response" },
      { status: 502 },
    );
  }

  // Map DVLA → Partial<Vehicle>
  const mapped = {
    make: dvla.make ?? null,
    model: null, // DVLA VES doesn't return model — user fills manually
    year: dvla.yearOfManufacture ?? null,
    colour: titleCase(dvla.colour),
    fuelType: mapFuelType(dvla.fuelType),
    engineSizeCC: dvla.engineCapacity ?? null,
    motExpiry: dvla.motExpiryDate ?? null,
  };

  cacheSet(reg, mapped);
  return NextResponse.json(mapped);
}
