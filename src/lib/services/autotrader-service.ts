/**
 * AutoTrader Connect API — server-only wrapper.
 *
 * Provides vehicle taxonomy (make/model/derivative/trim/generation) +
 * retail/trade/part-exchange valuations for the combined vehicle lookup,
 * and the auth + token cache the stock-publish route reuses.
 *
 * MUST NOT be imported from any client component — it reads the
 * AUTOTRADER_KEY/SECRET and exchanges them for a bearer token.
 *
 * --- Endpoints (captured live, see docs/autotrader-sandbox-shapes.md) ---
 *   Auth:    POST {base}/authenticate {key, secret} -> {access_token, expires_at}
 *   Vehicle: GET  {base}/vehicles?advertiserId&registration[&valuations&odometerReadingMiles]
 *   Stock:   POST {base}/stock?advertiserId  (see autotrader-stock-mapper.ts)
 *   base = https://api-sandbox.autotrader.co.uk (AUTOTRADER_SANDBOX=true)
 *          https://api.autotrader.co.uk         (otherwise)
 *
 * --- Token cache ---
 * Token life is only ~15 min, so we cache module-level with a 60-second
 * safety margin and re-auth on 401. `expires_at` is an ISO timestamp.
 */

import "server-only";
import {
  deriveExpiryDate,
  deriveMotStatus,
  type MotStatus,
  type MotTest,
} from "./mot-derivation";

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
    | "rate_limited"
    | "upstream_error"
    | "timeout"
    | "network";
  readonly status: number | null;
  constructor(
    code: AutotraderError["code"],
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
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

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, secret }),
    });
  } catch (e) {
    throw new AutotraderError(
      "network",
      `AutoTrader /authenticate unreachable: ${String(e)}`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AutotraderError(
      "auth_failed",
      `AutoTrader auth failed (${res.status}): ${text.slice(0, 160)}`,
      res.status,
    );
  }
  const parsed = (await res.json()) as {
    access_token?: string;
    expires_at?: string;
  };
  if (!parsed.access_token) {
    throw new AutotraderError(
      "auth_failed",
      "AutoTrader auth response missing access_token",
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AT_TIMEOUT_MS);

  try {
    let token = await getAccessToken();

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

    const doFetch = (tok: string) =>
      fetch(`${baseUrl()}/vehicles?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
        signal: controller.signal,
      });

    let res = await doFetch(token);
    if (res.status === 401) {
      dropTokenCache();
      token = await getAccessToken();
      res = await doFetch(token);
    }

    if (res.status === 404) return null;
    if (res.status === 429) {
      throw new AutotraderError(
        "rate_limited",
        "AutoTrader rate limit exceeded",
        429,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AutotraderError(
        "upstream_error",
        `AutoTrader /vehicles error ${res.status}: ${body.slice(0, 160)}`,
        res.status,
      );
    }

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
  } catch (e) {
    if (e instanceof AutotraderError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AutotraderError(
        "timeout",
        `AutoTrader lookup timed out after ${AT_TIMEOUT_MS}ms`,
      );
    }
    throw new AutotraderError("network", `AutoTrader lookup failed: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }
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
    throw new AutotraderError("missing_credentials", "AUTOTRADER_ADVERTISER_ID missing");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AT_TIMEOUT_MS);
  try {
    let token = await getAccessToken();
    const doFetch = (tok: string) =>
      fetch(`${baseUrl()}/stock?advertiserId=${advertiserId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    let res = await doFetch(token);
    if (res.status === 401) {
      dropTokenCache();
      token = await getAccessToken();
      res = await doFetch(token);
    }
    if (res.status === 429) {
      throw new AutotraderError("rate_limited", "AutoTrader rate limit exceeded", 429);
    }
    const json = (await res.json().catch(() => null)) as
      | { metadata?: { stockId?: string }; errors?: unknown }
      | null;
    if (!res.ok) {
      const detail = json?.errors
        ? JSON.stringify(json.errors).slice(0, 300)
        : `HTTP ${res.status}`;
      throw new AutotraderError(
        "upstream_error",
        `AutoTrader /stock create failed: ${detail}`,
        res.status,
      );
    }
    const stockId = json?.metadata?.stockId;
    if (!stockId) {
      throw new AutotraderError(
        "upstream_error",
        "AutoTrader /stock create returned no stockId",
      );
    }
    return { stockId, advertisingStatus: "not_published" };
  } catch (e) {
    if (e instanceof AutotraderError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AutotraderError("timeout", `AutoTrader stock create timed out`);
    }
    throw new AutotraderError("network", `AutoTrader stock create failed: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Test hook — clears the in-memory token cache. */
export function __resetAutotraderTokenCacheForTests(): void {
  tokenCache = null;
}
