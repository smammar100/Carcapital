# UAT — DVLA + DVSA Combined Vehicle Lookup

**Spec:** `Module_F_External_Verification.md` (Spec v3.0 · Phase 5 · 26 May 2026)
**Migration anchor:** `db/migrations/0017_vehicle_dvsa_dvla_fields.sql`
**Status:** Draft · ready for Ali walkthrough · **NOT YET COMMITTED**
**Author:** Claude · 2026-05-26

---

## 1. Scope

| In | Out |
|---|---|
| Combined `/api/vehicle/lookup` route — fans out DVLA + DVSA in parallel | Per-test MOT history (mileage, advisories, defects) — V1.1 |
| DVSA OAuth 2.0 client-credentials flow + in-memory token cache | DVLA bulk re-fetch (whole stock at once) |
| 8 new vehicle columns persisted: `co2_emissions`, `euro_status`, `tax_status`, `tax_due_date`, `mot_status`, `wheelplan`, `automated_vehicle`, `date_of_last_v5c_issued` | Push-based DVSA webhooks |
| **Compliance & Verification** card on Add Vehicle form (read-only with override pencils) | Vehicle Detail "MOT History" tab |
| Re-fetch button (cache-busting via `force: true` on the body or `?force=1` on the query) | Per-company DVSA quotas / billing |
| Graceful degradation when DVSA is down — DVLA's MOT fields fall back | Caching the merged payload in Postgres |
| Provenance markers (`sources.dvla` / `sources.dvsa`) surfaced on the card | Bulk import via DVSA's batch endpoints |

---

## 2. Pre-requisites

1. Migration `0017_vehicle_dvsa_dvla_fields.sql` applied — confirmed live
   on `tbhtdurpvysfuqzfvaol` ("Carcapital"). All 8 columns present and
   nullable.
2. `.env.local` contains the 5 DVSA env vars: `DVSA_CLIENT_ID`,
   `DVSA_CLIENT_SECRET`, `DVSA_API_KEY`, `DVSA_SCOPE_URL`,
   `DVSA_TOKEN_URL`. `.env.local.example` has been updated with empty
   keys + a tenant-ID placeholder.
3. `DVLA_API_KEY` already present (unchanged from existing v3.0 stack).
4. Tester accounts available with at least:
   - **Owner / Super User** (bypasses caps).
   - **Inventory Manager** (can run Add Vehicle).

---

## 3. Test environment

| Setting | Value |
|---|---|
| URL | `http://localhost:3000` (dev) / Vercel preview after PR |
| Browser | Chrome ≥ 124, Safari ≥ 17, Firefox ≥ 125 — desktop ≥ 1280 px |
| Default landing | `/inventory/add-vehicle` |

---

## 4. Test cases

> Severity codes — **B** = blocker (must fix before launch);
> **M** = major (should fix); **L** = polish.
> Status codes — **P** = pass · **F** = fail · **N** = not run.

### 4.1 · Schema (migration 0017)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| MF-S1 | Migration idempotent | `apply_migration` twice. | Re-run prints zero errors; every column already present. | B | **P** (verified live) |
| MF-S2 | All 8 columns present + nullable | `SELECT column_name FROM information_schema.columns WHERE table_name='vehicles' AND column_name IN (…)`. | Returns 8 rows. Every `is_nullable` is `YES`. | B | **P** (verified live) |
| MF-S3 | Existing rows back-fill to NULL | Any pre-0017 vehicle row. | All 8 new columns are NULL — no invented data. | B | **P** (verified live) |
| MF-S4 | Insert with values persists | `INSERT INTO vehicles (..., co2_emissions, mot_status, ...) VALUES (..., 147, 'Valid', ...)`. | Row written, columns readable on SELECT. | M | N |
| MF-S5 | Column comments | `SELECT pg_catalog.col_description(...)` on each column. | Comments present (set by migration). | L | N |

### 4.2 · DVSA service — `src/lib/services/dvsa-service.ts`

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| MF-D1 | Token exchange happy path | Hit `/api/vehicle/lookup` with a real reg. | Service requests + caches an access token from the configured `DVSA_TOKEN_URL`. Token logged length-only, never echoed. | B | **P** (live HTTP 200 from Entra) |
| MF-D2 | Token cache reuse | Hit lookup twice within 1 hr. | Second call reuses cached token (no token exchange in logs). | M | N |
| MF-D3 | Token refresh on expiry | Force `tokenCache.expiresAt = past` in dev. | Next call refreshes. | M | N |
| MF-D4 | 401 retry | Simulate stale token (set tokenCache.accessToken = "expired"). | First request 401; service drops cache + re-auths + retries; final 200/404 from history endpoint. | M | N |
| MF-D5 | Missing credentials | Unset `DVSA_CLIENT_ID` and restart. | `lookupMotHistory()` throws `DvsaError("missing_credentials")`; route surfaces as `sources.dvsa = "missing_credentials"` (not "error"). | B | N |
| MF-D6 | Status derivation — Valid | Mock tests array containing one PASSED test with `expiryDate >= today`. | `deriveMotStatus()` returns `"Valid"`. | B | N |
| MF-D7 | Status derivation — Not valid | Mock tests array containing one PASSED test with `expiryDate < today`. | `"Not valid"`. | B | N |
| MF-D8 | Status derivation — No details | Empty tests array. | `"No details held by DVLA"`. | B | N |
| MF-D9 | 404 from data endpoint | Reg unknown to DVSA. | Returns `{ motStatus: "No details held by DVLA", motExpiryDate: null }` (does NOT throw). | M | N |
| MF-D10 | Timeout (12 s) | Mock DVSA endpoint to hang. | Service aborts after 12 s; throws `DvsaError("timeout")`. | M | N |
| MF-D11 | 429 surfaces | Mock DVSA endpoint returning 429. | Service throws `DvsaError("rate_limited", status: 429)`. | M | N |

### 4.3 · DVLA server module — `src/lib/services/dvla-server.ts`

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| MF-V1 | Full-mapping path | EK18FUT lookup. | All 17 keys present in `DvlaLookupResult`. `co2Emissions=147`, `wheelplan="2 AXLE RIGID BODY"`, `taxStatus="Untaxed"`, etc. | B | **P** (live HTTP 200 from DVLA) |
| MF-V2 | `model` always null | Any reg. | DVLA VES never returns model; mapper sets `model: null`. | B | **P** (existing behaviour preserved) |
| MF-V3 | `registrationDate` derivation | EK18FUT. | `monthOfFirstRegistration` "2018-03" → `registrationDate` = "2018-03-01" (day-of-month = 1, documented). | M | **P** (matches the user's reference payload modulo the day-of-month) |
| MF-V4 | Fuel-type mapping | Each of PETROL / DIESEL / ELECTRIC / HYBRID ELECTRIC. | Maps to lowercase canonical: petrol / diesel / electric / hybrid. | B | N |
| MF-V5 | Colour title-cases | DVLA returns "BLUE". | Stored as "Blue" (consistent with existing arrival-form behaviour). | L | **P** (verified live) |
| MF-V6 | Invalid reg format | "!!!". | Throws `DvlaError("invalid_format")`. Route translates to 400. | B | **P** |
| MF-V7 | 404 returns null | Unknown but well-formed reg. | Returns `null`. Route caches and replies 200 with body null. | B | N |
| MF-V8 | Rate limit | Mock 429. | Throws `DvlaError("rate_limited")`. Route → 429. | M | N |

### 4.4 · Combined route — `src/app/api/vehicle/lookup/route.ts`

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| MF-R1 | Happy path | POST `{ "registrationNumber":"EK18FUT" }`. | 200 with all 17 keys + `sources.dvla="ok"`. Roundtrip ~1–2 s. | B | **P** (live, 8.2 s on cold start, ~1.5 s warm) |
| MF-R2 | Cache miss → hit | POST twice. | First call `x-cache: miss` + warm time. Second call `x-cache: hit` + ~10 ms. | B | **P** (verified live: 8.2 s → 8 ms) |
| MF-R3 | Force flag (body) | POST with `{ "registrationNumber":"EK18FUT", "force": true }`. | Bypasses cache; `x-cache: miss`; takes warm-call time. | M | **P** |
| MF-R4 | Force flag (query) | POST `?force=1`. | Same as MF-R3. | M | **P** |
| MF-R5 | Reg normalisation — spaces | POST `"EK18 FUT"`. | Cache key = `"EK18FUT"`; hits the same entry as the no-space form. | B | N |
| MF-R6 | Reg normalisation — dashes | POST `"EK18-FUT"`. | Same cache key + same hit. | L | N |
| MF-R7 | Invalid JSON body | Send `not-json`. | 400 `{"error":"invalid_json"}`. | B | **P** |
| MF-R8 | Missing reg | Send `{}`. | 400 `{"error":"registration_required"}`. | B | **P** |
| MF-R9 | Bad-format reg | Send `"!!!"`. | 400 `{"error":"invalid_registration"}`. | B | **P** |
| MF-R10 | Too-long reg | Send `"ABCDEFGHIJK"`. | 400 `{"error":"invalid_registration"}`. | B | **P** |
| MF-R11 | DVLA 404 | Send well-formed but unknown reg. | 200 with body `null`. Cached as null so repeat 404s are instant. | B | N |
| MF-R12 | DVLA upstream error | DVLA returns 400. | Route returns 502 `{"error":"dvla_unavailable"}`. | M | **P** (live, observed with GK666NX) |
| MF-R13 | DVLA rate-limit propagation | DVLA returns 429. | Route returns 429 `{"error":"dvla_rate_limited"}`. | M | N |
| MF-R14 | DVSA error → DVLA MOT fallback | DVSA fails, DVLA succeeds. | Response uses DVLA's `motStatus` / `motExpiryDate`; `sources.dvsa = "error"`. | B | **P** (verified — see Known Issue F-MOT-A) |
| MF-R15 | DVSA success | Once DVSA WAF allow-lists us. | `sources.dvsa = "ok"`; `motStatus` derived from DVSA (may differ from DVLA's stale value — exactly the scenario the integration is for). | B | **F** — see F-MOT-A |
| MF-R16 | Both 404 | Reg unknown to both. | DVLA returns null → route returns 200 null. (DVSA result ignored when DVLA is null.) | M | N |
| MF-R17 | Missing DVSA creds | Unset `DVSA_CLIENT_ID`. | Route returns 200 with DVLA fields + `sources.dvsa = "missing_credentials"`. | M | N |

### 4.5 · Client lookup service — `src/lib/services/dvla-service.ts`

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| MF-C1 | Targets the new route | Inspect `fetch` call site. | Points at `/api/vehicle/lookup`, not the legacy `/api/dvla/lookup`. | B | **P** (code inspection) |
| MF-C2 | Mock fallback shape | Pull the connection in dev tools → run lookup for `GK66 6NX`. | Service falls back to `DVLA_MOCK`; returns the 6 legacy fields + 8 null compliance fields + `registrationDate: null`. | M | N |
| MF-C3 | Find-vehicle-card still works | Dashboard → enter reg in Find Vehicle card. | Card surfaces the make/year/model from the lookup; no type errors. | M | N |
| MF-C4 | 12 s client timeout | Block `/api/vehicle/lookup` for 13 s. | Client aborts at 12 s; returns null + console.warn. | L | N |

### 4.6 · ComplianceCard UI

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| MF-U1 | Card renders empty initially | Open Add Vehicle form. | "Enter a registration above and click DVLA to populate." italic muted line. All tiles show "—". | B | N |
| MF-U2 | Card populates after lookup | Type EK18FUT → blur. | Tax rose "Untaxed" (due 25 Mar 2026), MOT — currently rose "Valid" via DVLA fallback (will flip to "Not valid" when F-MOT-A resolves). CO₂ 147. Wheelplan "2 AXLE RIGID BODY". Last V5C 22 Feb 2021. Registration date 1 Mar 2018. | B | N |
| MF-U3 | Source badges | After lookup. | Top-right shows "DVLA ✓ · DVSA ✗" (or ✓ when F-MOT-A resolves). | M | N |
| MF-U4 | Re-fetch button | Click "Re-fetch" with the same reg. | Lookup spinner spins; bus the cache; values refresh; `verifiedAt` timestamp updates. | M | N |
| MF-U5 | Override pencil — tax status | Click pencil next to Tax tile → type "Taxed" → blur. | Tile flips to badge "Taxed" (emerald). State propagates to parent. | M | N |
| MF-U6 | Override pencil — CO₂ | Pencil next to CO₂ → type "138" → blur. | Field shows "138". Submit persists 138 to DB. | M | N |
| MF-U7 | Override pencil — clear value | Pencil → empty the input → blur. | Field flips back to "—" (null in state). | L | N |
| MF-U8 | Escape cancels override | Open pencil → type → Escape. | Reverts to displayed value, no change to parent state. | L | N |
| MF-U9 | Automated Vehicle is read-only | Tile has no pencil. | Verified by inspection. | L | N |
| MF-U10 | Card tones | Untaxed / SORN → rose; Taxed → emerald; null → neutral. Valid → emerald; Not valid → rose; null → neutral. | All combos rendered. | L | N |

### 4.7 · Form integration

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| MF-F1 | DVLA lookup populates form + card | EK18FUT lookup. | Make/year/colour/fuel/engineCC fill in section 1. MOT Expiry fills in section 3. ALL 10 compliance fields fill in section 3.5. | B | N |
| MF-F2 | Manually-typed model not overwritten | Type "TUCSON" → then lookup EK18FUT. | Model stays "TUCSON" (DVLA returns null model — guard preserves user input). | M | N |
| MF-F3 | Submit persists all 14 fields | Fill form + submit. | Row written. SELECT confirms make=HYUNDAI, co2Emissions=147, taxStatus="Untaxed", motStatus=DVLA's value, etc. | B | N |
| MF-F4 | Override flows through to DB | Override taxStatus → submit. | DB row reflects override. | M | N |
| MF-F5 | Compliance card position | Inspect form. | Sits between Documentation (section 3) and Purchase Cost Breakdown (section 4). | L | N |
| MF-F6 | Lookup state during compliance render | Mid-lookup. | Card shows skeleton-ish state; Re-fetch disabled. | L | N |

### 4.8 · Cross-cutting & adversarial

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| MF-X1 | Secret never reaches the browser | DevTools → Network → inspect request to `/api/vehicle/lookup`. | No `DVSA_CLIENT_SECRET` / `DVSA_API_KEY` / `DVLA_API_KEY` headers on the client. | B | N |
| MF-X2 | Server log scrubbing | Trigger a DVSA failure. | Log line is `[vehicle-lookup] DVSA failed: …WAF Incapsula incident_id=…`. No tokens or keys in log. | B | **P** (verified — incident ID extraction works) |
| MF-X3 | Concurrent lookups | Fire 5 different regs in parallel. | All complete cleanly; cache populated with 5 entries; no token-cache thrash. | M | N |
| MF-X4 | Cache eviction (≥200 entries) | Issue 250 unique-reg lookups. | LRU evicts oldest 50; size stays ≤200. | L | N |
| MF-X5 | Mobile / tablet | 768 px width. | Compliance card 1-col; tiles stack; pencils still reachable. | L | N |
| MF-X6 | `.env.local` not committed | `git status` after editing `.env.local`. | File doesn't appear in untracked / modified (already gitignored). | B | **P** (verified — `.env*` in `.gitignore`) |

### 4.9 · Code health

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| MF-H1 | tsc clean | `pnpm exec tsc --noEmit`. | Exit 0. | B | **P** |
| MF-H2 | Build green | `pnpm build`. | Exit 0. | B | **P** |
| MF-H3 | Eslint clean on new files | `pnpm exec eslint <new files>`. | Zero errors on the 5 files this PR adds/modifies. | M | **P** |
| MF-H4 | No secrets in source | `grep -r "DVSA_CLIENT_SECRET\|EFvPmku" src/`. | Zero matches. | B | **P** |

---

## 5. Known issues / follow-ups

| ID | Title | Severity | Owner | Notes |
|---|---|---|---|---|
| **F-MOT-A** | **DVSA WAF (Incapsula) blocks our requests with HTTP 403** | **B** | **DVSA support + Ops** | The MS Entra token exchange succeeds (HTTP 200, valid access_token), but the subsequent GET against `history.mot.api.gov.uk/v1/.../EK18FUT` returns a generic Incapsula 403 HTML page. **Incident IDs:** `687000630139686925-230409151341072327`, `…-136579238503321538`, `…-202349507226046412`. **Likely cause:** DVSA provisioning lag — the Entra app was approved 2026-05-26 but the API key + IP may not yet be allow-listed at the WAF. **Action:** email `dvsa-tech@dft.gov.uk` with the incident IDs, the originating IP (visible in their logs), and our DVSA app reference. **Mitigation in code:** the route falls back to DVLA's `motStatus` + `motExpiryDate` (`sources.dvsa = "error"`), so the form still surfaces an MOT badge — just from DVLA's slower-updating dataset. **UPDATE (2026-05-30):** AutoTrader Connect's `motTests` now backstops this as MOT **tier 2** (DVSA → AutoTrader → DVLA) — see F-AT4 in `UAT-AUTOTRADER.md`. While DVSA stays blocked, MOT is derived from AutoTrader's per-test data (`motSource: "autotrader"`) instead of DVLA's coarse fields. DVSA silently retakes tier 1 the moment its WAF is unblocked — no code change needed. |
| F-MOT-B | `registrationDate` day-of-month is always `01` | L | Product | DVLA returns `monthOfFirstRegistration` (YYYY-MM); we synthesise day = 01. The user's reference payload shows `2018-03-28` for EK18FUT, which is a per-vehicle real day that DVLA doesn't expose. Either accept the YYYY-MM-01 approximation, or pull the day from the V5C document image during vehicle intake. |
| F-MOT-C | Per-test MOT history not stored | M | Product | DVSA returns the full motTests array; we currently extract only `motStatus` + `motExpiryDate`. Follow-up: `vehicles.mot_tests jsonb` column + "MOT History" tab on Vehicle Detail. |
| F-MOT-D | Storage of merged payload not persisted across deploys | L | Ops | The LRU cache lives in-process; Vercel cold starts drop it. Acceptable for V1 (DVLA + DVSA are both fast). Future: Postgres-backed cache table. |
| F-MOT-E | No rate-limiter on our route | L | Ops | A bad actor could call `/api/vehicle/lookup` repeatedly and burn through DVLA's 1000-req/day quota. Add a per-user rate limit before exposing the route publicly. |

---

## 6. Walkthrough script (for Ali · 20 min)

1. Open `/inventory/add-vehicle`. Point out the new Compliance section (3 min).
2. Type `EK18FUT` in Registration → blur. Watch the spinner. Section 1 + 3 fill. The new Compliance card populates with Tax / MOT / CO₂ / Wheelplan / etc. (5 min).
3. Click the pencil next to Tax → type "Taxed" → click out. The badge flips emerald (2 min).
4. Click **Re-fetch** in the card header. Spinner spins; values re-pull from DVLA + DVSA (3 min).
5. Hover the "DVLA ✓ · DVSA ✗" provenance line — note that DVSA is currently failing per **F-MOT-A** (talk through the chase with DVSA support) (3 min).
6. Fill the rest of the arrival form (seller, mileage, buying price) and **Save**. Land on Vehicle Detail. Confirm Compliance section data persisted (4 min).
7. Sign off in writing or async video.

---

## 7. Round-1 findings (2026-05-26 — automated + smoke)

| Case | Result | Notes |
|---|---|---|
| MF-S1/S2/S3 migration 0017 | **PASS** | All 8 cols present + nullable + back-fill to NULL. |
| MF-D1 token exchange | **PASS** | Entra returns HTTP 200 + access_token (length verified, value not logged). |
| MF-V1/V3/V6 DVLA mapping | **PASS** | Full payload for EK18FUT matches reference modulo F-MOT-B and colour case. |
| MF-R1 happy path | **PASS** | 17 keys present; warm call ~1.5 s, cold ~8 s. |
| MF-R2 cache miss → hit | **PASS** | First call 8.2 s `miss`, second call 8 ms `hit`. |
| MF-R3/R4 force flag | **PASS** | `?force=1` and `{force:true}` both bypass cache. |
| MF-R7/R8/R9/R10 input validation | **PASS** | invalid_json / registration_required / invalid_registration all return 400. |
| MF-R12 DVLA upstream error | **PASS** | 502 dvla_unavailable surfaces upstream 4xx (observed with GK666NX). |
| **MF-R15** DVSA success | **🔴 FAIL** | **Bug F-MOT-A**: Incapsula WAF returns generic 403 HTML on every request. Route gracefully falls back to DVLA's MOT fields. |
| MF-X2 log scrubbing | **PASS** | Incident ID extraction works; no token/key in log. |
| MF-X6 secrets not committed | **PASS** | `.env*` gitignored; `.env.local.example` only carries empty keys. |
| MF-H1/H2/H3/H4 code health | **PASS** | tsc 0; build green; eslint clean on new files; no secrets in source. |

**Pending (require live browser walk-through with Ali):** MF-S4/S5,
MF-D2–D11, MF-V4/V7/V8, MF-R5/R6/R11/R13/R16/R17, MF-C2/C3/C4,
MF-U1–U10, MF-F1–F6, MF-X1/X3/X4/X5.

---

## 8. Commit gate

**Per user instruction (2026-05-26): do not commit until every case in §4
is `P` or has an explicit known-issue entry in §5, AND F-MOT-A has either
been resolved or Ali has signed off on shipping with the documented DVLA
fallback.**

If F-MOT-A is still red at commit time:

1. Either await DVSA's allow-list update, **or**
2. Ship with the fallback documented (the user experience degrades to
   the DVLA-only MOT fields — usable, just less current than DVSA).

When greenlit:

```bash
git add \
  db/migrations/0017_vehicle_dvsa_dvla_fields.sql \
  src/lib/services/dvsa-service.ts \
  src/lib/services/dvla-server.ts \
  src/lib/services/dvla-service.ts \
  src/lib/services/vehicle-service.ts \
  src/app/api/vehicle/lookup/route.ts \
  src/components/vehicles/compliance-card.tsx \
  src/components/vehicles/arrival-form.tsx \
  src/app/\(dashboard\)/admin/master-sheet/page.tsx \
  src/lib/types.ts \
  src/lib/mock-data.ts \
  .env.local.example \
  docs/UAT-DVLA-DVSA-LOOKUP.md
git commit -m "DVLA + DVSA combined vehicle lookup (Module F)" \
  -m "..." \
  -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

`.env.local` is **never** staged.

---

## 9. Sign-off

| Signatory | Role | Date | Result |
|---|---|---|---|
| Ali (operator) | Owner / Super User | — | Pending |
| Ammar Bass (PM) | Product | — | Pending |
| Claude (implementer) | Engineering | 2026-05-26 | DB + service + tsc / build / eslint green · DVSA blocked by F-MOT-A · awaiting DVSA support |
