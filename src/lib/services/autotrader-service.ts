/**
 * AutoTrader Connect API — server-only wrapper.
 *
 * Provides vehicle taxonomy (make/model/derivative/trim/generation) +
 * retail/trade/part-exchange valuations for the combined vehicle lookup,
 * the Advertisers API (dealers on the integration), and the auth + token
 * cache the stock-publish route reuses.
 *
 * MUST NOT be imported from any client component — it reads the
 * AUTOTRADER_KEY/SECRET and exchanges them for a bearer token.
 *
 * --- Endpoints (captured live, see docs/autotrader-sandbox-shapes.md) ---
 *   Auth:        POST {base}/authenticate {key, secret} -> {access_token, expires_at}
 *   Vehicle:     GET  {base}/vehicles?advertiserId&registration[&valuations&odometerReadingMiles]
 *   Stock:       POST {base}/stock?advertiserId  (see autotrader-stock-mapper.ts)
 *   Advertisers: GET  {base}/advertisers?page&pageSize  / {base}/advertisers/{id}
 *   base = https://api-sandbox.autotrader.co.uk (AUTOTRADER_SANDBOX=true)
 *          https://api.autotrader.co.uk         (otherwise)
 *
 * --- Token cache ---
 * Token life is only ~15 min, so we cache module-level with a 60-second
 * safety margin and re-auth on 401. `expires_at` is an ISO timestamp.
 *
 * --- Fair-usage & error handling (AutoTrader "Go Live" fundamentals) ---
 * Every service call goes through `atFetch`, which centralises the required
 * behaviour:
 *   429 -> pause ALL AutoTrader activity, then retry (capped).
 *   503 -> pause THAT service ≥2s, then retry (capped).
 *   400 -> no retry; surface body so the caller can flag bad input.
 *   401 -> drop token, re-auth ONCE, retry; still 401 -> stop.
 *   403 -> classify advertiser-not-on-list vs wrong-products; no retry.
 * The Cloudflare `CF-RAY` response header is captured onto every thrown
 * error (and logged) so we can quote it to AutoTrader support.
 */

import "server-only";
import {
  deriveExpiryDate,
  deriveMotStatus,
  type MotStatus,
  type MotTest,
} from "./mot-derivation";
import type { Advertiser } from "../types";
import {
  AT_MAX_RETRIES,
  DEFAULT_429_BACKOFF_MS,
  SERVICE_503_PAUSE_MS,
  classify403,
  parseRetryAfterMs,
} from "../autotrader/fair-usage";

const SANDBOX_BASE = "https://api-sandbox.autotrader.co.uk";
const PROD_BASE = "https://api.autotrader.co.uk";

const TOKEN_SAFETY_MARGIN_MS = 60_000;
const AT_TIMEOUT_MS = 12_000;

function baseUrl(): string {
  return process.env.AUTOTRADER_SANDBOX === "true" ? SANDBOX_BASE : PROD_BASE;
}

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number; // epoch ms
  key: string;
}

let tokenCache: TokenCacheEntry | null = null;

/** Which AutoTrader service a call targets — used for per-service 503 pauses. */
type AtService = "auth" | "vehicles" | "stock" | "advertisers";

// 429 pauses ALL activity; 503 pauses only the affected service.
let globalPauseUntil = 0;
const servicePauseUntil: Partial<Record<AtService, number>> = {};

// ---------------------------------------------------------------------------
// Public derived shape — what the route consumes
// ---------------------------------------------------------------------------
export interface AutotraderLookupResult {
  make: string | null;
  model: string | null;
  derivative: string | null;
  derivativeId: string | null;
  generation: string | null;
  trim: string | null;
  bodyType: string | null;
  fuelType: string | null;
  transmission: string | null;
  engineCapacityCC: number | null;
  co2Emissions: number | null;
  firstRegistrationDate: string | null;
  colour: string | null;
  /** Whole GBP (not pence) — matches vehicles.listing_price convention. */
  retailValuation: number | null;
  tradeValuation: number | null;
  partExchangeValuation: number | null;
  privateValuation: number | null;
  /**
   * MOT derived from AutoTrader's `motTests` array (F-AT4). Used as the
   * tier-2 MOT source in the combined route while DVSA is WAF-blocked.
   * null when AutoTrader returned no motTests block.
   */
  motStatus: MotStatus | null;
  motExpiryDate: string | null;
}

export class AutotraderError extends Error {
  readonly code:
    | "missing_credentials"
    | "auth_failed"
    | "bad_request"
    | "unauthorized"
    | "forbidden_advertiser"
    | "forbidden_product"
    | "rate_limited"
    | "service_unavailable"
    | "upstream_error"
    | "timeout"
    | "network";
  readonly status: number | null;
  /** Cloudflare CF-RAY id from the failing response — quote to AT support. */
  readonly cfRayId: string | null;
  constructor(
    code: AutotraderError["code"],
    message: string,
    status: number | null = null,
    cfRayId: string | null = null,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.cfRayId = cfRayId;
  }
}

// ---------------------------------------------------------------------------
// Resilient transport
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cfRayOf(res: Response): string | null {
  return res.headers.get("cf-ray");
}

/** Honour a `Retry-After` header (seconds or HTTP-date). null when absent. */
function retryAfterMs(res: Response): number | null {
  return parseRetryAfterMs(res.headers.get("retry-after"), Date.now());
}

interface AtRequestSpec {
  url: string;
  init: Omit<RequestInit, "signal">;
}

/**
 * Issue a single AutoTrader request with full Go-Live fair-usage / error
 * handling. `build(token)` returns the URL + init; pass a null-tolerant
 * builder and `authed:false` for the auth endpoint itself.
 *
 * Returns the raw `Response` on success (res.ok), or on a 404 when
 * `allow404` is set, so the caller can parse the body. Throws
 * `AutotraderError` (with cfRayId) for every other outcome.
 */
async function atFetch(
  service: AtService,
  build: (token: string | null) => AtRequestSpec,
  opts: { authed?: boolean; allow404?: boolean } = {},
): Promise<Response> {
  const { authed = true, allow404 = false } = opts;
  let attempt = 0;
  let reauthed = false;

  for (;;) {
    // Respect an active pause (429 global, or 503 for this service).
    const wait = Math.max(
      globalPauseUntil - Date.now(),
      (servicePauseUntil[service] ?? 0) - Date.now(),
    );
    if (wait > 0) await sleep(wait);

    const token = authed ? await getAccessToken() : null;
    const { url, init } = build(token);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new AutotraderError(
          "timeout",
          `AutoTrader ${service} timed out after ${AT_TIMEOUT_MS}ms`,
        );
      }
      throw new AutotraderError(
        "network",
        `AutoTrader ${service} request failed: ${String(e)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) return res;
    if (allow404 && res.status === 404) return res;

    const ray = cfRayOf(res);

    // 401 — re-auth once, then stop ALL activity for this call.
    if (res.status === 401 && authed && !reauthed) {
      dropTokenCache();
      reauthed = true;
      continue;
    }
    if (res.status === 401) {
      logRay(service, 401, ray);
      throw new AutotraderError(
        "unauthorized",
        `AutoTrader ${service} unauthorized (401) — token rejected`,
        401,
        ray,
      );
    }

    // 429 — pause ALL activity, then retry (capped).
    if (res.status === 429) {
      const backoff = retryAfterMs(res) ?? DEFAULT_429_BACKOFF_MS * (attempt + 1);
      globalPauseUntil = Date.now() + backoff;
      logRay(service, 429, ray);
      if (attempt < AT_MAX_RETRIES) {
        attempt++;
        continue;
      }
      throw new AutotraderError(
        "rate_limited",
        `AutoTrader ${service} rate limited (429)`,
        429,
        ray,
      );
    }

    // 503 — pause THIS service ≥2s, then retry (capped).
    if (res.status === 503) {
      const backoff = Math.max(SERVICE_503_PAUSE_MS, retryAfterMs(res) ?? 0);
      servicePauseUntil[service] = Date.now() + backoff;
      logRay(service, 503, ray);
      if (attempt < AT_MAX_RETRIES) {
        attempt++;
        continue;
      }
      throw new AutotraderError(
        "service_unavailable",
        `AutoTrader ${service} unavailable (503)`,
        503,
        ray,
      );
    }

    // 400 — bad input. Never retry; surface the body so callers can flag it.
    if (res.status === 400) {
      const body = await res.text().catch(() => "");
      logRay(service, 400, ray);
      throw new AutotraderError(
        "bad_request",
        `AutoTrader ${service} bad request (400): ${body.slice(0, 240)}`,
        400,
        ray,
      );
    }

    // 403 — two documented kinds; classify, stop activity, no retry.
    if (res.status === 403) {
      const body = await res.text().catch(() => "");
      logRay(service, 403, ray);
      throw new AutotraderError(
        classify403(body),
        `AutoTrader ${service} forbidden (403): ${body.slice(0, 240)}`,
        403,
        ray,
      );
    }

    // Anything else.
    const body = await res.text().catch(() => "");
    logRay(service, res.status, ray);
    throw new AutotraderError(
      "upstream_error",
      `AutoTrader ${service} error ${res.status}: ${body.slice(0, 240)}`,
      res.status,
      ray,
    );
  }
}

function logRay(service: AtService, status: number, ray: string | null): void {
  console.warn(
    `[autotrader] ${service} HTTP ${status} cf-ray=${ray ?? "(none)"}`,
  );
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function getAccessToken(): Promise<string> {
  const key = process.env.AUTOTRADER_KEY;
  const secret = process.env.AUTOTRADER_SECRET;
  if (!key || !secret) {
    throw new AutotraderError(
      "missing_credentials",
      "AUTOTRADER_KEY / AUTOTRADER_SECRET missing",
    );
  }
  const now = Date.now();
  if (
    tokenCache &&
    tokenCache.key === key &&
    tokenCache.expiresAt - TOKEN_SAFETY_MARGIN_MS > now
  ) {
    return tokenCache.accessToken;
  }

  // The auth endpoint is unauthenticated; run it through atFetch (authed:false)
  // so it shares the 429/503/CF-RAY handling. A non-ok status throws from
  // atFetch — translate that into an auth_failed so callers can distinguish
  // "couldn't get a token" from a downstream data error.
  let res: Response;
  try {
    res = await atFetch(
      "auth",
      () => ({
        url: `${baseUrl()}/authenticate`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, secret }),
        },
      }),
      { authed: false },
    );
  } catch (e) {
    if (e instanceof AutotraderError) {
      // Reshape transport-level failures into an auth_failed, preserving the
      // CF-RAY for support, but keep timeout/network/missing as-is.
      if (
        e.code === "bad_request" ||
        e.code === "unauthorized" ||
        e.code === "upstream_error"
      ) {
        throw new AutotraderError(
          "auth_failed",
          `AutoTrader auth failed: ${e.message}`,
          e.status,
          e.cfRayId,
        );
      }
    }
    throw e;
  }

  const parsed = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_at?: string;
  } | null;
  if (!parsed?.access_token) {
    throw new AutotraderError(
      "auth_failed",
      "AutoTrader auth response missing access_token",
      res.status,
      cfRayOf(res),
    );
  }
  // `expires_at` is an ISO timestamp; fall back to now+14min if unparseable
  // (token life is ~15 min — stay conservative).
  const expiresAt = parsed.expires_at
    ? Date.parse(parsed.expires_at)
    : now + 14 * 60 * 1000;
  tokenCache = {
    key,
    accessToken: parsed.access_token,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : now + 14 * 60 * 1000,
  };
  return tokenCache.accessToken;
}

function dropTokenCache() {
  tokenCache = null;
}

/** Exposed for the stock route so it can reuse the cached token. */
export async function getAutotraderToken(): Promise<string> {
  return getAccessToken();
}

export function autotraderAdvertiserId(): string | null {
  return process.env.AUTOTRADER_ADVERTISER_ID ?? null;
}

export function autotraderBaseUrl(): string {
  return baseUrl();
}

// ---------------------------------------------------------------------------
// Raw response shapes (only fields we read)
// ---------------------------------------------------------------------------
interface AtVehicle {
  make?: string;
  model?: string;
  generation?: string;
  derivative?: string;
  derivativeId?: string;
  trim?: string;
  bodyType?: string;
  fuelType?: string;
  transmissionType?: string;
  engineCapacityCC?: number;
  co2EmissionGPKM?: number;
  firstRegistrationDate?: string;
  colour?: string;
}
interface AtValuationAmount {
  amountGBP?: number | null;
}
interface AtValuations {
  retail?: AtValuationAmount;
  trade?: AtValuationAmount;
  partExchange?: AtValuationAmount;
  private?: AtValuationAmount;
}
// AutoTrader's motTests entries — structurally satisfy the shared MotTest
// (we only read testResult + expiryDate for the derivation).
interface AtMotTest extends MotTest {
  completedDate?: string;
  odometerValue?: number;
  odometerUnit?: string;
  motTestNumber?: string;
}
interface AtVehicleResponse {
  vehicle?: AtVehicle;
  valuations?: AtValuations;
  motTests?: AtMotTest[];
}

function titleCase(s: string | undefined | null): string | null {
  if (!s) return null;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Vehicle lookup
// ---------------------------------------------------------------------------
export async function lookupAutotraderVehicle(
  reg: string,
  opts: { mileage?: number; firstRegistrationDate?: string | null } = {},
): Promise<AutotraderLookupResult | null> {
  const advertiserId = process.env.AUTOTRADER_ADVERTISER_ID;
  if (!advertiserId) {
    throw new AutotraderError(
      "missing_credentials",
      "AUTOTRADER_ADVERTISER_ID missing",
    );
  }

  const params = new URLSearchParams({
    advertiserId,
    registration: reg,
    // F-AT4: always request MOT history — it's one flag on the same call
    // and backstops the WAF-blocked DVSA source in the combined route.
    motTests: "true",
  });
  // Valuations require a mileage. Only request them when we have one.
  if (opts.mileage && opts.mileage > 0) {
    params.set("valuations", "true");
    params.set("odometerReadingMiles", String(Math.round(opts.mileage)));
    if (opts.firstRegistrationDate) {
      params.set("firstRegistrationDate", opts.firstRegistrationDate);
    }
  }

  const res = await atFetch(
    "vehicles",
    (token) => ({
      url: `${baseUrl()}/vehicles?${params.toString()}`,
      init: {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    }),
    { allow404: true },
  );
  if (res.status === 404) return null;

  const data = (await res.json()) as AtVehicleResponse;
  const v = data.vehicle;
  if (!v) return null;
  const val = data.valuations;
  // F-AT4: derive MOT from AutoTrader's motTests when present. null (not
  // "No MOT history") when the block is absent, so the route can tell
  // "AutoTrader has no MOT data" from "AutoTrader says no tests exist".
  const motTests = data.motTests;
  const hasMot = Array.isArray(motTests);
  return {
    make: v.make ? v.make.toUpperCase() : null,
    model: v.model ? v.model.toUpperCase() : null,
    derivative: v.derivative ?? null,
    derivativeId: v.derivativeId ?? null,
    generation: v.generation ?? null,
    trim: v.trim ?? null,
    bodyType: v.bodyType ?? null,
    fuelType: v.fuelType ?? null,
    transmission: v.transmissionType ?? null,
    engineCapacityCC: v.engineCapacityCC ?? null,
    co2Emissions: v.co2EmissionGPKM ?? null,
    firstRegistrationDate: v.firstRegistrationDate ?? null,
    colour: titleCase(v.colour),
    retailValuation: val?.retail?.amountGBP ?? null,
    tradeValuation: val?.trade?.amountGBP ?? null,
    partExchangeValuation: val?.partExchange?.amountGBP ?? null,
    privateValuation: val?.private?.amountGBP ?? null,
    motStatus: hasMot ? deriveMotStatus(motTests as MotTest[]) : null,
    motExpiryDate: hasMot ? deriveExpiryDate(motTests as MotTest[]) : null,
  };
}

// ---------------------------------------------------------------------------
// Advertisers API (dealers configured on this integration)
// ---------------------------------------------------------------------------
// Raw shapes — captured live from the sandbox 2026-06-28 via
// scripts/autotrader-advertisers-probe.mjs (advertiser 10008899). The list
// envelope is { results[], totalResults }; a single advertiser is fetched
// with ?advertiserId= (the path-style /advertisers/{id} returns 404).
interface AtAdvertiserLocation {
  addressLineOne?: string;
  town?: string;
  county?: string | null;
  region?: string;
  postCode?: string;
  latitude?: number;
  longitude?: number;
}
interface AtAdvertiser {
  advertiserId?: string;
  name?: string;
  status?: string;
  segment?: string;
  phone?: string;
  location?: AtAdvertiserLocation;
  // AT Connect capabilities — each { name, eligible }. We surface the names of
  // the eligible ones as the advertiser's "products".
  capabilities?: { atConnect?: Array<{ name?: string; eligible?: boolean }> };
  [k: string]: unknown;
}
interface AtAdvertisersResponse {
  results?: AtAdvertiser[];
  // `advertisers` kept as a defensive fallback; the live envelope uses results.
  advertisers?: AtAdvertiser[];
  totalResults?: number;
  totalResultCount?: number;
}

/**
 * Normalise a raw advertiser object (from the Advertisers API OR an ADVERTISER
 * update notification) into our `Advertiser` shape. Exported for the webhook.
 */
export function normalizeAdvertiser(raw: unknown): Advertiser {
  return mapAdvertiser((raw ?? {}) as AtAdvertiser);
}

function mapAdvertiser(row: AtAdvertiser): Advertiser {
  const atConnect = row.capabilities?.atConnect;
  // "products" = the names of the capabilities the advertiser is eligible for.
  const products = Array.isArray(atConnect)
    ? atConnect
        .filter((c) => c?.eligible && typeof c.name === "string")
        .map((c) => c.name as string)
    : [];
  return {
    advertiserId: String(row.advertiserId ?? ""),
    name: (row.name ?? null) as string | null,
    status: (row.status ?? null) as string | null,
    postcode: (row.location?.postCode ?? null) as string | null,
    products,
    raw: row as Record<string, unknown>,
  };
}

export interface AdvertiserListResult {
  advertisers: Advertiser[];
  page: number;
  pageSize: number;
  totalResults: number | null;
}

/**
 * List the dealers (advertisers) configured on this integration, paginated.
 * Go-Live requires page + pageSize be sent — they always are here.
 */
export async function listAdvertisers(
  opts: { page?: number; pageSize?: number } = {},
): Promise<AdvertiserListResult> {
  const page = opts.page && opts.page > 0 ? Math.floor(opts.page) : 1;
  const pageSize =
    opts.pageSize && opts.pageSize > 0 ? Math.min(Math.floor(opts.pageSize), 100) : 20;

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  const res = await atFetch("advertisers", (token) => ({
    url: `${baseUrl()}/advertisers?${params.toString()}`,
    init: {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
  }));

  const data = (await res.json().catch(() => null)) as AtAdvertisersResponse | null;
  const rows = data?.results ?? data?.advertisers ?? [];
  return {
    // The list envelope echoes neither page nor pageSize — reflect what we sent.
    advertisers: rows.map(mapAdvertiser),
    page,
    pageSize,
    totalResults: data?.totalResults ?? data?.totalResultCount ?? null,
  };
}

/**
 * Look up a single advertiser to check whether it's on this integration.
 * Uses the query form `?advertiserId=` (the path form /advertisers/{id}
 * returns 404 in the sandbox) and reads the first result. Returns null when
 * the advertiser isn't on the integration (empty results). A 403 throws
 * `forbidden_advertiser` — also "not on the integration".
 */
export async function getAdvertiser(
  advertiserId: string,
): Promise<Advertiser | null> {
  const params = new URLSearchParams({ advertiserId });
  const res = await atFetch("advertisers", (token) => ({
    url: `${baseUrl()}/advertisers?${params.toString()}`,
    init: {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
  }));
  const data = (await res.json().catch(() => null)) as AtAdvertisersResponse | null;
  const rows = data?.results ?? data?.advertisers ?? [];
  if (rows.length === 0) return null;
  return mapAdvertiser(rows[0]);
}

// ---------------------------------------------------------------------------
// Stock create / update
// ---------------------------------------------------------------------------
export interface StockCreateResult {
  stockId: string;
  /** Raw advertising-location statuses echoed back (all NOT_PUBLISHED on create). */
  advertisingStatus: "not_published" | "published";
}

/**
 * Create a stock item (advert) for the configured advertiser. The body is
 * built by autotrader-stock-mapper.ts. Returns the AutoTrader Stock ID.
 *
 * V1 always creates advertising locations as NOT_PUBLISHED — going live is a
 * deliberate second action (out of scope here).
 */
export async function createStock(
  body: Record<string, unknown>,
): Promise<StockCreateResult> {
  const advertiserId = process.env.AUTOTRADER_ADVERTISER_ID;
  if (!advertiserId) {
    throw new AutotraderError(
      "missing_credentials",
      "AUTOTRADER_ADVERTISER_ID missing",
    );
  }

  const res = await atFetch("stock", (token) => ({
    url: `${baseUrl()}/stock?advertiserId=${advertiserId}`,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    },
  }));

  const json = (await res.json().catch(() => null)) as
    | { metadata?: { stockId?: string } }
    | null;
  const stockId = json?.metadata?.stockId;
  if (!stockId) {
    throw new AutotraderError(
      "upstream_error",
      "AutoTrader /stock create returned no stockId",
      res.status,
      cfRayOf(res),
    );
  }
  return { stockId, advertisingStatus: "not_published" };
}

/** Test hook — clears the in-memory token cache and any active pauses. */
export function __resetAutotraderTokenCacheForTests(): void {
  tokenCache = null;
  globalPauseUntil = 0;
  for (const k of Object.keys(servicePauseUntil)) {
    delete servicePauseUntil[k as AtService];
  }
}
