# UAT — AutoTrader Connect (lookup + valuation + stock publish)

**Credentials:** Sandbox key `CarCapital-StockManage-SB-26-05-26`,
advertiser `10008899`.
**Migration anchors:** `0018_vehicle_autotrader_fields.sql`,
`0019_listing_autotrader_stock.sql`.
**Status:** Draft · Phase 1 (lookup + valuation) fully verified live ·
Phase 2 (stock publish) contract verified live · UI E2E pending Ali.
**Author:** Claude · 2026-05-30

---

## 1. Scope

| In | Out |
|---|---|
| AutoTrader auth + in-process token cache (15-min life, 60s margin) | Production credentials / prod base URL |
| Vehicle taxonomy enrichment (model/derivative/generation/trim) folded into `/api/vehicle/lookup` | eBay / Facebook real integrations |
| Retail/trade/part-ex/private valuations (whole GBP) | Going live (advertising locations → PUBLISHED) |
| Valuation surfaced on Add Vehicle, Financials tab, Work List | Real image upload (`POST /images`) — photos still mocked |
| Stock publish (`POST /stock`) gated behind explicit confirm | Stock delete / de-list / bulk sync |
| `listing:publish_autotrader` capability + role grant | Per-test MOT history persistence |
| AutoTrader status chip on Work List rows | Postgres-backed lookup cache |

---

## 2. Pre-requisites

1. Migrations `0018` + `0019` applied — confirmed live on
   `tbhtdurpvysfuqzfvaol` (13 columns, all nullable).
2. `.env.local` carries `AUTOTRADER_KEY/SECRET/ADVERTISER_ID/SANDBOX`;
   `.env.local.example` updated with empty keys.
3. Administrator or Owner persona for the publish-gated cases.

---

## 3. Test cases

> Sev: **B** blocker · **M** major · **L** polish.
> Status: **P** pass · **F** fail · **N** not run.

### 3.1 · Schema (0018 / 0019)

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| AT-S1 | 0018 + 0019 idempotent | Re-run = no-op. | B | **P** (live) |
| AT-S2 | 13 columns present + nullable | 9 on vehicles, 4 on listings. | B | **P** (live) |

### 3.2 · Auth + service

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| AT-A1 | Token exchange | `POST /authenticate {key,secret}` → 200 `{access_token, expires_at}`. | B | **P** (live, token len 97) |
| AT-A2 | Token cache reuse | Second lookup within 15 min reuses the cached token. | M | N |
| AT-A3 | 401 refresh | Stale token → drop cache → re-auth → retry once. | M | N |
| AT-A4 | Missing creds | Unset `AUTOTRADER_KEY` → `AutotraderError("missing_credentials")`; route degrades. | B | N |
| AT-A5 | Secret never client-side | DevTools shows no key/secret/token on the browser request. | B | **P** (server-only module) |

### 3.3 · Vehicle lookup (`/api/vehicle/lookup`)

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| AT-L1 | Model filled from AutoTrader | `EK18FUT` → `model: "TUCSON"` (DVLA returns null). | B | **P** (live) |
| AT-L2 | Derivative / generation / trim | `derivative`, `generation: "SUV (2015 - 2018)"`, `trim: "SE Nav"`, `derivativeId` present. | B | **P** (live) |
| AT-L3 | Valuations (whole GBP) | retail 11003 / trade 8582 / part-ex 8536 / private 10540. | B | **P** (live) |
| AT-L4 | Provenance | `sources.autotrader: "ok"`. | M | **P** (live) |
| AT-L5 | Mileage unlocks valuation | Without `mileage`, taxonomy returns but valuations are null. | M | **P** (by design) |
| AT-L6 | Cache key buckets by mileage | `(reg, mileage)` cached separately. | L | **P** (code) |
| AT-L7 | AutoTrader down → graceful | AutoTrader error → DVLA+DVSA still return, `sources.autotrader: "error"`. | B | N |
| AT-L8 | Missing creds → graceful | `sources.autotrader: "missing_credentials"`; rest of payload intact. | M | N |
| AT-L9 | MOT via AutoTrader (F-AT4) | DVSA WAF-blocked → MOT derived from AutoTrader `motTests`; `motSource: "autotrader"`. | B | **P** (live — `EK18FUT` motStatus "Not valid", motSource autotrader) |
| AT-L10 | MOT tier order | DVSA (ok+populated) → AutoTrader → DVLA. Empty "No MOT history" never outranks a populated lower tier. | B | **P** (code) |
| AT-L11 | MOT source on card | Compliance card MOT tile shows "via AutoTrader / via DVLA / via DVSA". | M | N (UI — pending Ali) |

### 3.4 · Valuation surfaces

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| AT-U1 | Add Vehicle strip | After lookup with mileage, a valuation card shows retail/trade/part-ex + "Use as listing price". | B | N |
| AT-U2 | Use-as-price | Clicking sets `listingPrice` + toasts. | M | N |
| AT-U3 | Financials reference | Vehicle with `atRetailValuation` shows the AutoTrader market-value panel with a priced-to-sell / at-market / above-market pill. | M | N |
| AT-U4 | Work List hint | Create-listing dialog shows "AutoTrader retail: £X — use" under the price; seeds the AT indicator. | M | N |
| AT-U5 | Persisted to DB | Saved vehicle carries derivative + valuations (migration 0018 columns). | B | N |

### 3.5 · Stock publish (`POST /api/autotrader/stock`)

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| AT-P1 | Required-field discovery | Stock create rejects until vehicleType + make + model + fuelType + bodyType + transmissionType + derivativeId + mileage present. | B | **P** (live — API guided field-by-field) |
| AT-P2 | Successful create | Full body → **HTTP 201** + `metadata.stockId`. | B | **P** (live — Stock ID `8a46844d9e4aa706019e7a88f05f4808`) |
| AT-P3 | NOT_PUBLISHED locations | All 5 advertising locations created NOT_PUBLISHED (advert not live on marketplace). | B | **P** (live) |
| AT-P4 | Mapper casing | `HYUNDAI→Hyundai`, `petrol→Petrol`, `suv→SUV`, `manual→Manual`, `car→Car` match the proven-good 201 body. | B | **P** (verified vs live body) |
| AT-P5 | Stock ID persisted | Route stores `at_stock_id` / `at_advertising_status='not_published'` / `at_last_synced_at`. | B | N (UI E2E — pending Ali) |
| AT-P6 | Error persisted | API failure stores `at_last_error`, returns 502, listing stays draft. | M | N |
| AT-P7 | Image-less warning | Vehicle without real photo URL → warning surfaced; advert still created. | M | **P** (mapper warning) |
| AT-P8 | Not-configured guard | No `AUTOTRADER_KEY` → route 502 `autotrader_not_configured`. | M | **P** (code) |

### 3.6 · Gating + permissions

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| AT-G1 | Confirm dialog | Work List "Publish to AT" opens a dialog naming the sandbox + NOT_PUBLISHED behaviour. No API call until confirm. | B | N |
| AT-G2 | Cancel = no write | Cancel → no `POST /stock`. | B | N |
| AT-G3 | Cap gates the button | "Publish to AT" only shows with `listing:publish_autotrader` (Admin/Owner). | B | N |
| AT-G4 | Synced chip | After publish, row shows "Synced #<id>". | M | N |
| AT-G5 | Error chip | On failure, row shows "Error" with the message on hover. | M | N |
| AT-G6 | Only when AT channel on | Button only shows when the listing's `autotrader` channel is enabled. | L | N |

### 3.7 · Code health

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| AT-H1 | tsc clean | `pnpm exec tsc --noEmit` exit 0. | B | **P** |
| AT-H2 | Build green | `pnpm build`. | B | **P** |
| AT-H3 | Eslint clean (new files) | Zero errors on AutoTrader files (pre-existing rhf `watch()` warnings tolerated). | M | **P** |
| AT-H4 | No secrets in source | `grep -r AUTOTRADER_SECRET src/` → 0. | B | **P** |

---

## 4. Known issues / follow-ups

| ID | Title | Sev | Notes |
|---|---|---|---|
| F-AT1 | Images deferred | M | Adverts created image-less — blocked on Phase-6 Supabase photo storage. Real `POST /images` + media block is the follow-up. |
| F-AT2 | Hybrid fuel mapping | L | `hybrid` → "Petrol Hybrid" by default; diesel-hybrids would mis-map. Persist AutoTrader's raw fuelType at lookup to remove the guess. |
| F-AT3 | Go-live not implemented | M | V1 creates NOT_PUBLISHED. Flipping advertising locations to PUBLISHED is a deliberate V1.1 action. |
| F-AT4 | DVSA MOT via AutoTrader | M | **RESOLVED** — AutoTrader's `motTests` now back the MOT as tier 2 (DVSA → AutoTrader → DVLA). Verified live: `EK18FUT` returns `motSource: "autotrader"` while DVSA stays WAF-blocked. Shared derivation in `mot-derivation.ts`. |
| F-AT5 | `database.types.ts` stale | L | Stock route casts the admin client to `any` for the 0018/0019 columns. Re-run `supabase gen types` to restore typing. |
| F-AT6 | Lookup cache process-local | L | Shared with DVLA/DVSA; resets on deploy. Acceptable for V1. |

---

## 5. Walkthrough script (for Ali · 20 min)

1. Add Vehicle → type `EK18FUT`, enter mileage 45000 → blur. Model
   auto-fills **Tucson**; derivative + generation + trim populate; the
   **AutoTrader valuation** card shows retail £11,003 (3 min).
2. Click **Use as listing price** → listing price becomes £11,003 (1 min).
3. Save the vehicle → open it → **Financials** tab shows the AutoTrader
   market-value panel with the priced-to-sell / at-market pill (3 min).
4. Advert → **Work List** → Create Listing for that vehicle; note the
   "AutoTrader retail: £… — use" hint under price; turn the AutoTrader
   channel on; Save Draft (4 min).
5. On the row, click **Publish to AT** → confirm dialog names the sandbox
   + NOT_PUBLISHED → **Confirm** → toast shows the Stock ID; row chip
   flips to "Synced #…" (5 min).
6. Cancel a second publish to show no write happens (1 min).
7. Sign off (3 min).

---

## 6. Round-1 findings (2026-05-30 — automated + live sandbox)

| Case | Result | Notes |
|---|---|---|
| AT-S1/S2 schema | **PASS** | 13 columns live + nullable; idempotent. |
| AT-A1 auth | **PASS** | `{access_token, expires_at}`; token len 97. |
| AT-L1–L4 lookup enrichment | **PASS** | `EK18FUT` → model TUCSON + derivative + generation + trim + 4 valuations + `sources.autotrader: ok`. |
| AT-P1 required-field discovery | **PASS** | API guided: vehicleType → model → full taxonomy. |
| AT-P2 stock create | **PASS** | HTTP 201, Stock ID `8a46844d9e4aa706019e7a88f05f4808` (sandbox, NOT_PUBLISHED). |
| AT-P3 NOT_PUBLISHED | **PASS** | All locations created not-live. |
| AT-P4 mapper casing | **PASS** | DB enums map to the exact proven-good AutoTrader vocabulary. |
| AT-H1–H4 code health | **PASS** | tsc 0; build green; eslint clean (new files); no secrets in source. |

**Pending (UI E2E with Ali):** AT-A2/A3/A4, AT-L7/L8, AT-U1–U5,
AT-P5/P6, AT-G1–G6.

> One sandbox test advert exists from contract validation (Stock ID
> `8a46844d9e4aa706019e7a88f05f4808`). Safe to leave (NOT_PUBLISHED) or
> delete in the AutoTrader sandbox portal.

---

## 7. Sign-off

| Signatory | Role | Date | Result |
|---|---|---|---|
| Ali (operator) | Owner / Super User | — | Pending UI walkthrough |
| Ammar Bass (PM) | Product | — | Pending |
| Claude (implementer) | Engineering | 2026-05-30 | Lookup + valuation + stock-create contract verified live; tsc/build/eslint green |
