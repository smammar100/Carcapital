// Throwaway probe to discover the AutoTrader POST /stock request shape.
//
// Strategy: send progressively richer bodies and print the API's validation
// errors (AutoTrader returns helpful field-level messages telling you what's
// missing). Read the errors, add fields, repeat — until a Stock ID comes back.
//
// SECURITY: reads creds from .env.local; never prints token/secret values.
// This WRITES to the sandbox advertiser — sandbox only, never prod.
//
// Run:  node scripts/autotrader-stock-probe.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

async function authenticate(base, key, secret) {
  const res = await fetch(`${base}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, secret }),
  });
  if (!res.ok) throw new Error(`auth ${res.status}`);
  const j = await res.json();
  return j.access_token;
}

async function tryStock(base, token, advertiserId, body, label) {
  console.log(`\n=== ${label} ===`);
  const res = await fetch(`${base}/stock?advertiserId=${advertiserId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
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
    // Print warnings/errors which guide the required shape.
    if (json.warnings) console.log("warnings:", JSON.stringify(json.warnings, null, 2));
    if (json.errors) console.log("errors:", JSON.stringify(json.errors, null, 2));
    if (json.metadata) console.log("metadata:", JSON.stringify(json.metadata, null, 2));
    if (!json.warnings && !json.errors && !json.metadata) {
      console.log("body keys:", Object.keys(json));
      console.log(JSON.stringify(json, null, 2).slice(0, 800));
    }
  } else {
    console.log("non-JSON (first 300):", text.slice(0, 300));
  }
  return { status: res.status, json };
}

async function main() {
  const env = loadEnvLocal();
  const base =
    env.AUTOTRADER_SANDBOX === "true"
      ? "https://api-sandbox.autotrader.co.uk"
      : "https://api.autotrader.co.uk";
  const advertiserId = env.AUTOTRADER_ADVERTISER_ID;
  const token = await authenticate(base, env.AUTOTRADER_KEY, env.AUTOTRADER_SECRET);
  console.log("authenticated OK; advertiser", advertiserId, "base", base);

  // EK18FUT derivativeId captured from the vehicle probe.
  const derivativeId = "35eef09b60b1422b8d4902aa22f841cd";

  const advertLocations = {
    autotraderAdvert: { status: "NOT_PUBLISHED" },
    advertiserAdvert: { status: "NOT_PUBLISHED" },
    locatorAdvert: { status: "NOT_PUBLISHED" },
    exportAdvert: { status: "NOT_PUBLISHED" },
    profileAdvert: { status: "NOT_PUBLISHED" },
  };

  // Iterate: each attempt adds the field the previous error asked for.
  const attempts = [
    {
      label: "Attempt 2 — + vehicleType",
      body: {
        vehicle: {
          vehicleType: "Car",
          registration: "EK18FUT",
          make: "Hyundai",
          model: "Tucson",
          generation: "SUV (2015 - 2018)",
          derivative: "1.6 GDi Blue Drive SE Nav SUV 5dr Petrol Manual Euro 6 (s/s) (132 ps)",
          derivativeId,
          fuelType: "Petrol",
          bodyType: "SUV",
          transmissionType: "Manual",
          odometerReadingMiles: 45000,
        },
        adverts: {
          retailAdverts: {
            suppliedPrice: { amountGBP: 10995 },
            attentionGrabber: "Full service history",
            description: "Stunning blue Hyundai Tucson, drives superb.",
            ...advertLocations,
          },
        },
        metadata: { lifecycleState: "FORECOURT" },
      },
    },
  ];

  for (const a of attempts) {
    const r = await tryStock(base, token, advertiserId, a.body, a.label);
    if (r.status >= 200 && r.status < 300) {
      console.log("\nSUCCESS — stockId:", r.json?.metadata?.stockId);
      break;
    }
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
