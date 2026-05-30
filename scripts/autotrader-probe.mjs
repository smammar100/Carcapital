// Throwaway sandbox probe for the AutoTrader Connect API.
//
// Reads creds from .env.local, authenticates, then probes the vehicle
// lookup endpoint with a few flag combinations so we can capture the REAL
// taxonomy + valuation JSON shapes before writing the service mappers.
//
// SECURITY: never prints the secret or the full access token — the token
// is reported as length + first 6 chars only. Vehicle data is not secret.
//
// Run:  node scripts/autotrader-probe.mjs [REG]
// e.g.  node scripts/autotrader-probe.mjs EK18FUT

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const path = join(__dirname, "..", ".env.local");
  const raw = readFileSync(path, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function scrubToken(t) {
  if (!t) return "(none)";
  return `len=${t.length} prefix=${t.slice(0, 6)}…`;
}

function topKeys(obj, depth = 2) {
  // Print the structure (keys + value types) up to `depth`, eliding arrays
  // to their first element's shape.
  function walk(o, d) {
    if (o === null) return "null";
    if (Array.isArray(o)) {
      return o.length ? [`array[${o.length}] of`, walk(o[0], d)] : "array[0]";
    }
    if (typeof o === "object") {
      if (d <= 0) return "{…}";
      const out = {};
      for (const k of Object.keys(o)) out[k] = walk(o[k], d - 1);
      return out;
    }
    return typeof o;
  }
  return walk(obj, depth);
}

async function main() {
  const env = loadEnvLocal();
  const KEY = env.AUTOTRADER_KEY;
  const SECRET = env.AUTOTRADER_SECRET;
  const ADV = env.AUTOTRADER_ADVERTISER_ID;
  const base =
    env.AUTOTRADER_SANDBOX === "true"
      ? "https://api-sandbox.autotrader.co.uk"
      : "https://api.autotrader.co.uk";
  const reg = process.argv[2] || "EK18FUT";

  console.log("=== AutoTrader sandbox probe ===");
  console.log("base:", base);
  console.log("advertiserId:", ADV);
  console.log("key present:", !!KEY, "secret present:", !!SECRET);
  console.log("");

  // --- Step 1: authenticate (form-encoded AND json variants) ---
  console.log("--- POST /authenticate ---");
  let token = null;
  for (const variant of ["json", "form"]) {
    try {
      const res = await fetch(`${base}/authenticate`, {
        method: "POST",
        headers: {
          "Content-Type":
            variant === "json"
              ? "application/json"
              : "application/x-www-form-urlencoded",
        },
        body:
          variant === "json"
            ? JSON.stringify({ key: KEY, secret: SECRET })
            : new URLSearchParams({ key: KEY, secret: SECRET }).toString(),
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* non-json */
      }
      console.log(`[${variant}] HTTP ${res.status}`);
      if (json) {
        console.log(`[${variant}] response keys:`, Object.keys(json));
        // Common token field names
        const tok =
          json.access_token || json.accessToken || json.token || null;
        const exp =
          json.expires || json.expiresIn || json.expiry || json.exp || null;
        console.log(`[${variant}] token:`, scrubToken(tok), "expires:", exp);
        if (tok && !token) token = tok;
      } else {
        console.log(`[${variant}] non-JSON body (first 160):`, text.slice(0, 160));
      }
    } catch (e) {
      console.log(`[${variant}] ERROR`, String(e).slice(0, 160));
    }
  }
  console.log("");

  if (!token) {
    console.log("No token obtained — stopping before vehicle lookup.");
    return;
  }

  // --- Step 2: vehicle lookup with a few flag combinations ---
  // Valuations require a mileage (you can't value a car without it) and a
  // first-registration date, so the valuation calls pass odometerReadingMiles.
  const flagSets = [
    { valuations: "true", odometerReadingMiles: "45000" },
    {
      valuations: "true",
      odometerReadingMiles: "45000",
      firstRegistrationDate: "2018-03-28",
    },
    { motTests: "true" },
    { competitors: "true", valuations: "true", odometerReadingMiles: "45000" },
  ];
  for (const flags of flagSets) {
    const qs = new URLSearchParams({
      advertiserId: ADV,
      registration: reg,
      ...flags,
    });
    const url = `${base}/vehicles?${qs.toString()}`;
    console.log(`--- GET /vehicles?${qs.toString()} ---`);
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* non-json */
      }
      console.log(`HTTP ${res.status}`);
      if (json) {
        // Top-level keys tell us whether a valuations / motTests block appeared.
        console.log("top-level keys:", Object.keys(json));
        // Print the valuations block in FULL (real numbers, not secret).
        if (json.valuations) {
          console.log(
            "VALUATIONS (full):",
            JSON.stringify(json.valuations, null, 2),
          );
        }
        if (json.motTests) {
          console.log(
            "MOT TESTS structure:",
            JSON.stringify(topKeys(json.motTests, 3), null, 2),
          );
        }
      } else {
        console.log("non-JSON (first 200):", text.slice(0, 200));
      }
    } catch (e) {
      console.log("ERROR", String(e).slice(0, 200));
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
