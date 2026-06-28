// Throwaway sandbox probe for the AutoTrader Connect *Advertisers API*.
//
// Reads creds from .env.local, authenticates, then probes the Advertisers
// endpoint so we can capture the REAL response envelope + pagination param
// names + the CF-RAY response header before writing the typed service.
//
// Companion to scripts/autotrader-probe.mjs (which covers /vehicles + /stock).
//
// SECURITY: never prints the secret or the full access token — the token is
// reported as length + first 6 chars only. Advertiser data is not secret, but
// we print structure (keys + types) rather than dumping everything verbatim.
//
// Run:  node scripts/autotrader-advertisers-probe.mjs [ADVERTISER_ID]
// e.g.  node scripts/autotrader-advertisers-probe.mjs 10008899

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

function topKeys(obj, depth = 3) {
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

// CF-RAY is the Cloudflare ray id we must capture on failures for Go-Live.
function rayId(res) {
  return res.headers.get("cf-ray") || "(no cf-ray header)";
}

async function authenticate(base, KEY, SECRET) {
  const res = await fetch(`${base}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: KEY, secret: SECRET }),
  });
  const json = await res.json().catch(() => null);
  console.log(`POST /authenticate -> HTTP ${res.status} (cf-ray: ${rayId(res)})`);
  const tok = json?.access_token || json?.accessToken || json?.token || null;
  console.log("token:", scrubToken(tok));
  return tok;
}

async function probe(label, url, token) {
  console.log(`--- ${label} ---`);
  console.log("GET", url);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-json */
    }
    console.log(`HTTP ${res.status}  cf-ray: ${rayId(res)}`);
    if (json) {
      console.log("top-level keys:", Object.keys(json));
      console.log("structure:", JSON.stringify(topKeys(json, 3), null, 2));
      // Surface common pagination meta names so we map the right ones.
      for (const k of [
        "page",
        "pageSize",
        "totalResults",
        "totalPages",
        "totalResultCount",
        "results",
        "advertisers",
      ]) {
        if (json[k] !== undefined && !Array.isArray(json[k])) {
          console.log(`  meta ${k} =`, json[k]);
        }
      }
    } else {
      console.log("non-JSON (first 240):", text.slice(0, 240));
    }
  } catch (e) {
    console.log("ERROR", String(e).slice(0, 240));
  }
  console.log("");
}

async function main() {
  const env = loadEnvLocal();
  const KEY = env.AUTOTRADER_KEY;
  const SECRET = env.AUTOTRADER_SECRET;
  const ADV = process.argv[2] || env.AUTOTRADER_ADVERTISER_ID;
  const base =
    env.AUTOTRADER_SANDBOX === "true"
      ? "https://api-sandbox.autotrader.co.uk"
      : "https://api.autotrader.co.uk";

  console.log("=== AutoTrader Advertisers API probe ===");
  console.log("base:", base);
  console.log("advertiserId:", ADV);
  console.log("key present:", !!KEY, "secret present:", !!SECRET);
  console.log("");

  const token = await authenticate(base, KEY, SECRET);
  if (!token) {
    console.log("No token obtained — stopping.");
    return;
  }
  console.log("");

  // 1) Paginated list — try the documented page/pageSize params.
  await probe(
    "Advertisers list (page=1, pageSize=10)",
    `${base}/advertisers?page=1&pageSize=10`,
    token,
  );
  // 2) Second page to confirm paging behaviour.
  await probe(
    "Advertisers list (page=2, pageSize=10)",
    `${base}/advertisers?page=2&pageSize=10`,
    token,
  );
  // 3) Single advertiser — path-style (preferred if it exists).
  if (ADV) {
    await probe(
      "Single advertiser (path style)",
      `${base}/advertisers/${ADV}`,
      token,
    );
    // 4) Single advertiser — query-style fallback.
    await probe(
      "Single advertiser (query style)",
      `${base}/advertisers?advertiserId=${ADV}`,
      token,
    );
  }

  console.log(
    "NOTE: record the working path, the exact pagination param names, the\n" +
      "response envelope (results[] vs advertisers[]) and the paging meta keys,\n" +
      "plus whether cf-ray is present — then append to\n" +
      "docs/autotrader-sandbox-shapes.md. For the notification hash scheme, see\n" +
      "AutoTrader's 'Advertiser update notifications' reference (HMAC alg +\n" +
      "header name + signed string) — it can't be probed from here.",
  );
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
