/**
 * DVSA MOT History API — server-only wrapper.
 *
 * Authoritative source for `motStatus` and `motExpiryDate` on the combined
 * vehicle lookup route (`/api/vehicle/lookup`). This module MUST NOT be
 * imported from any client component — it reads OAuth client secrets and
 * exchanges them for a bearer token against Microsoft Entra v2.
 *
 * --- Endpoint geography ---
 *
 *   Token:   process.env.DVSA_TOKEN_URL  (Microsoft Entra v2 OAuth)
 *   Scope:   process.env.DVSA_SCOPE_URL  (resource scope, ends in `/.default`)
 *   Data:    https://history.mot.api.gov.uk/v1/trade/vehicles/registration/{reg}
 *
 * Note: the approval email mentions `tapi.dvsa.gov.uk` — that's the SCOPE,
 * not the data endpoint. The actual MOT history API lives on the
 * `history.mot.api.gov.uk` host. Confused tickets to dvsa-tech@dft.gov.uk
 * always cite the wrong one.
 *
 * --- Token cache ---
 *
 * The token returned by Entra is valid for ~1 h. We cache it module-level
 * keyed on the client id, with a 30 s safety margin. On 401 we drop the
 * cache and retry once (handles silent rotation).
 *
 * --- Derived fields ---
 *
 * DVSA returns the full MOT-test array; per the v1 spec we derive only:
 *   motStatus     — "Valid" | "Not valid" | "No details held by DVLA"
 *   motExpiryDate — latest PASSED test's expiryDate (ISO YYYY-MM-DD)
 *
 * Per-test detail (mileage, advisories, defects) is intentionally out of
 * scope for V1. Follow-up F-MOT1 in the UAT pack.
 */

import "server-only";

const DVSA_DATA_BASE =
  "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

const TOKEN_SAFETY_MARGIN_MS = 30_000;
const DVSA_TIMEOUT_MS = 12_000;

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
  clientId: string;
}

let tokenCache: TokenCacheEntry | null = null;

// ---------------------------------------------------------------------------
// DVSA raw response shape (only fields we care about)
// ---------------------------------------------------------------------------
interface DvsaMotTest {
  completedDate?: string;
  testResult?: "PASSED" | "FAILED" | string;
  expiryDate?: string; // YYYY-MM-DD
  odometerValue?: string;
  odometerUnit?: string;
  motTestNumber?: string;
}

interface DvsaVehicleResponse {
  registration?: string;
  make?: string;
  model?: string;
  primaryColour?: string;
  fuelType?: string;
  manufactureDate?: string;
  firstUsedDate?: string;
  motTests?: DvsaMotTest[];
}

// ---------------------------------------------------------------------------
// Derived public shape — what the route consumes
// ---------------------------------------------------------------------------
export type MotStatus = "Valid" | "Not valid" | "No details held by DVLA";

export interface DvsaLookupResult {
  motStatus: MotStatus;
  motExpiryDate: string | null;
}

// ---------------------------------------------------------------------------
// Typed error so the route can translate cleanly.
// ---------------------------------------------------------------------------
export class DvsaError extends Error {
  readonly code:
    | "missing_credentials"
    | "token_failed"
    | "rate_limited"
    | "upstream_error"
    | "timeout"
    | "network";
  readonly status: number | null;
  constructor(
    code: DvsaError["code"],
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------
async function getAccessToken(): Promise<string> {
  const clientId = process.env.DVSA_CLIENT_ID;
  const clientSecret = process.env.DVSA_CLIENT_SECRET;
  const scope = process.env.DVSA_SCOPE_URL;
  const tokenUrl = process.env.DVSA_TOKEN_URL;
  if (!clientId || !clientSecret || !scope || !tokenUrl) {
    throw new DvsaError(
      "missing_credentials",
      "One or more DVSA_* env vars are missing",
    );
  }
  // Cache hit: same client + still inside its TTL minus 30 s
  const now = Date.now();
  if (
    tokenCache &&
    tokenCache.clientId === clientId &&
    tokenCache.expiresAt - TOKEN_SAFETY_MARGIN_MS > now
  ) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    throw new DvsaError(
      "network",
      `DVSA token endpoint unreachable: ${String(e)}`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DvsaError(
      "token_failed",
      `DVSA token exchange failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }
  const parsed = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!parsed.access_token || !parsed.expires_in) {
    throw new DvsaError(
      "token_failed",
      "DVSA token response missing access_token or expires_in",
    );
  }
  tokenCache = {
    clientId,
    accessToken: parsed.access_token,
    expiresAt: now + parsed.expires_in * 1000,
  };
  return tokenCache.accessToken;
}

// Forced cache invalidation (called on 401 from the history endpoint).
function dropTokenCache() {
  tokenCache = null;
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------
function deriveMotStatus(tests: DvsaMotTest[]): MotStatus {
  if (!tests.length) return "No details held by DVLA";
  const today = new Date().toISOString().slice(0, 10);
  // "Valid" if any PASSED test has an expiryDate today or later.
  const latestPassed = tests
    .filter((t) => t.testResult === "PASSED" && t.expiryDate)
    .map((t) => t.expiryDate as string)
    .sort()
    .pop();
  if (latestPassed && latestPassed >= today) return "Valid";
  return "Not valid";
}

function deriveExpiryDate(tests: DvsaMotTest[]): string | null {
  const passedExpiries = tests
    .filter((t) => t.testResult === "PASSED" && t.expiryDate)
    .map((t) => t.expiryDate as string)
    .sort();
  return passedExpiries.at(-1) ?? null;
}

// ---------------------------------------------------------------------------
// History fetch
// ---------------------------------------------------------------------------
async function fetchHistory(
  reg: string,
  apiKey: string,
  token: string,
  signal: AbortSignal,
): Promise<Response> {
  const url = `${DVSA_DATA_BASE}/${encodeURIComponent(reg)}`;
  // Header notes:
  //   - `User-Agent` is required by the Akamai WAF in front of the MOT
  //     History API — requests without it get a generic 403 HTML page.
  //   - `X-API-Key` uses that exact case per the DVSA docs.
  //   - `Accept: application/json+v6` mirrors the v6 schema we parse below
  //     (tolerant of v1 shape — we accept arrays too).
  return fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-API-Key": apiKey,
      Accept: "application/json+v6",
      "User-Agent": "Carcap-Server/1.0 (+https://carcapital.co.uk)",
    },
    signal,
  });
}

// ---------------------------------------------------------------------------
// Public lookup
// ---------------------------------------------------------------------------
export async function lookupMotHistory(
  reg: string,
): Promise<DvsaLookupResult | null> {
  const apiKey = process.env.DVSA_API_KEY;
  if (!apiKey || !process.env.DVSA_CLIENT_ID) {
    throw new DvsaError("missing_credentials", "DVSA_API_KEY missing");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DVSA_TIMEOUT_MS);

  try {
    let token = await getAccessToken();
    let res = await fetchHistory(reg, apiKey, token, controller.signal);

    // Silent token rotation: retry once with a fresh token on 401.
    if (res.status === 401) {
      dropTokenCache();
      token = await getAccessToken();
      res = await fetchHistory(reg, apiKey, token, controller.signal);
    }

    if (res.status === 404) {
      return { motStatus: "No details held by DVLA", motExpiryDate: null };
    }
    if (res.status === 429) {
      throw new DvsaError(
        "rate_limited",
        "DVSA rate limit exceeded — try again shortly",
        429,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // The WAF in front of the API (Imperva Incapsula) returns a generic
      // HTML 403 page when it blocks; extract the incident ID so we can
      // give DVSA support a referenceable case number instead of pasting
      // the whole HTML payload into logs.
      const incidentMatch = body.match(/incident_id=([^&"<]+)/);
      const incident = incidentMatch?.[1] ?? null;
      const snippet = incident
        ? `WAF Incapsula incident_id=${incident}`
        : body.slice(0, 200);
      throw new DvsaError(
        "upstream_error",
        `DVSA upstream error ${res.status}: ${snippet}`,
        res.status,
      );
    }

    // The /registration/{reg} endpoint returns a single object (v6 schema).
    // Earlier v1 returned an array; tolerate both.
    const raw = await res.json();
    const vehicle: DvsaVehicleResponse = Array.isArray(raw) ? raw[0] : raw;
    const tests = vehicle?.motTests ?? [];

    return {
      motStatus: deriveMotStatus(tests),
      motExpiryDate: deriveExpiryDate(tests),
    };
  } catch (e) {
    if (e instanceof DvsaError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new DvsaError(
        "timeout",
        `DVSA lookup timed out after ${DVSA_TIMEOUT_MS}ms`,
      );
    }
    throw new DvsaError("network", `DVSA lookup failed: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Test hook — clears the in-memory token cache. Used by integration tests
 * and the rare "force re-auth" admin action. Production code should not
 * call this directly.
 */
export function __resetDvsaTokenCacheForTests(): void {
  tokenCache = null;
}
