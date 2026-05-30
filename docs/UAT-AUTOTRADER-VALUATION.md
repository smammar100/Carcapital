# UAT — AutoTrader live valuation on Vehicle Detail

**Feature:** Replace the placeholder valuation math on the Vehicle Detail →
Overview tab with **real AutoTrader values**, plus a **Refresh** button that
pulls a live valuation and persists it.
**Status:** Built + verified live against the sandbox. UI walkthrough
pending Ali.
**Author:** Claude · 2026-05-31

---

## 1. The problem this fixes

The Overview "AutoTrader Valuation" card and the "AT Retail Avg" KPI were
**fake placeholder math** — `listing_price × 0.78 / 0.76 / 0.99` — with a
misleading "Updated just now · live feed" caption. The DB already stored
*real* AutoTrader valuations (migration 0018) but only the Financials tab
used them; the Overview ignored them.

**Proof (AK69 HZH — Range Rover Evoque, the screenshot car, listing
£17,450, mileage 31,900):**

| | Old placeholder math | **Real AutoTrader API** |
|---|---|---|
| Retail | £17,276 (`17450×0.99`) | **£18,481** |
| Trade | £13,611 (`17450×0.78`) | **£14,673** |
| Part-ex | £13,262 (`17450×0.76`) | **£14,596** |

The placeholder under-valued retail by £1,205. The real figure is
mileage-sensitive (31,900 mi → £18,481; the same car at 45,000 mi values
at £17,022).

---

## 2. What changed

- **Overview "AutoTrader Valuation" card** now reads
  `vehicle.atRetailValuation` / `atTradeValuation` /
  `atPartExchangeValuation` (the real stored values), with a truthful
  "Updated {relative time} · live feed" caption (or "Not yet valued" when
  null).
- **"AT Retail Avg" KPI** reads `vehicle.atRetailValuation`; the hint
  compares the web price to it ("Priced below market" / "Within market
  range" / "Above market").
- **"Refresh" button** on the card → `/api/vehicle/lookup` (server-side,
  creds stay there) → persists via `vehicleService.updateValuation` (RLS,
  user session — no service-role key) → patches page state instantly.
  Also refreshes derivative/generation/trim.

---

## 3. Test cases

> Sev: **B** blocker · **M** major · **L** polish.
> Status: **P** pass · **F** fail · **N** not run.

### 3.1 · Display (real values, no math)

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| V-D1 | No placeholder math | Card values are NOT `listing_price ×` multipliers. | B | **P** (code) |
| V-D2 | Reads stored valuation | Card shows `vehicle.at*Valuation`. Vehicle valued at intake shows real figures immediately. | B | **P** (code) |
| V-D3 | Not-yet-valued state | `atRetailValuation == null` → cells show "—", caption "Not yet valued — refresh to pull live". | M | N |
| V-D4 | Truthful timestamp | Caption shows "Updated {Xm/h ago / date}", not a hardcoded "just now". | M | **P** (code) |
| V-D5 | AT Retail Avg KPI | Reads `atRetailValuation`; hint reflects web-price-vs-market. | M | **P** (code) |

### 3.2 · Refresh (live API → persist → display)

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| V-R1 | Lookup returns real value | `/api/vehicle/lookup {AK69HZH, mileage 31900}` → retail 18481 / trade 14673 / part-ex 14596, `sources.autotrader: ok`. | B | **P** (live) |
| V-R2 | Mileage sensitivity | Same reg at 45,000 mi → retail 17022 (lower value at higher miles). | M | **P** (live — probe) |
| V-R3 | Persist | After Refresh, `vehicles.at_retail_valuation` etc. + `at_valuation_at` updated in DB. | B | N (UI — pending Ali) |
| V-R4 | Instant UI update | Card + KPI reflect new values without a full page reload (state patch). | B | N (UI) |
| V-R5 | Price indicator | `at_price_indicator` derived from listing price vs retail (great/good/fair/high). AK69 HZH: 17450/18481 = 0.94 → "great". | M | **P** (logic) |
| V-R6 | Spinner + disable | Button shows "Refreshing…" + spinner; disabled mid-flight. | L | N |
| V-R7 | Unknown reg | A reg AutoTrader doesn't know → toast "AutoTrader returned no valuation", no DB write. | M | N |
| V-R8 | Taxonomy refresh | Derivative/generation/trim updated too (Make/Model/Derivative completeness stays accurate). | L | **P** (code) |

### 3.3 · Architecture / robustness

| ID | Title | Expected | Sev | Status |
|---|---|---|---|---|
| V-A1 | No service-role dependency | Refresh works without `SUPABASE_SERVICE_ROLE_KEY` (client-orchestrated via RLS). | B | **P** (refactored away from admin client after a 500) |
| V-A2 | Creds stay server-side | AutoTrader key/secret never reach the browser — only `/api/vehicle/lookup` touches them. | B | **P** (server-only service) |
| V-A3 | Cache bypass | Refresh passes `force: true` so it doesn't return a stale 60-min cached payload. | M | **P** (code) |
| V-A4 | tsc / build / eslint | All green. | B | **P** |

---

## 4. Known issues / follow-ups

| ID | Title | Sev | Notes |
|---|---|---|---|
| FV-1 | Stock route needs service-role key | M | `/api/autotrader/stock` (the publish route) uses `createAdminClient`, which 500s locally without `SUPABASE_SERVICE_ROLE_KEY`. Either add the key to env (prod likely has it) or refactor it client-orchestrated like this valuation refresh. The stock *contract* is verified (probe → 201); the *route* is untested end-to-end for the same reason this valuation route was. |
| FV-2 | No auto-refresh on page load | L | Valuation refreshes only on button click (deliberate — avoids burning AutoTrader quota on every vehicle view; the 60-min cache also helps). |
| FV-3 | MOT not refreshed here | L | This refresh updates valuations + taxonomy only. MOT is already populated at intake (tiered DVSA→AutoTrader→DVLA). A "refresh MOT" could be added if needed. |

---

## 5. Walkthrough (for Ali · 5 min)

1. Open a Vehicle Detail → Overview for a car added before this feature
   (valuation columns null) — e.g. AK69 HZH. The AutoTrader Valuation card
   shows "Not yet valued".
2. Click **Refresh**. Spinner runs ~1–2 s. Card fills with the real
   trade/part-ex/retail; caption flips to "Updated just now · live feed";
   the AT Retail Avg KPI updates.
3. Hard-refresh the page → values persist (read from the DB).
4. Confirm the numbers match AutoTrader (retail ~£18,481 for AK69 HZH at
   31,900 mi).

---

## 6. Round-1 findings (2026-05-31 — live sandbox)

| Case | Result | Notes |
|---|---|---|
| Real-value proof | **PASS** | AK69 HZH @ 31,900 mi → retail £18,481 / trade £14,673 / part-ex £14,596 (vs fake £17,276 / £13,611 / £13,262). |
| Mileage sensitivity | **PASS** | Same car @ 45,000 mi → retail £17,022. |
| Lookup provenance | **PASS** | `sources.autotrader: "ok"`. |
| 500 on admin client | **FOUND + FIXED** | First route impl used `createAdminClient` → 500 (`SUPABASE_SERVICE_ROLE_KEY` absent). Refactored to client-orchestrated (lookup route + RLS update). Logged FV-1 for the stock route's identical dependency. |
| tsc / build / eslint | **PASS** | All green. |

**Pending (UI walkthrough with Ali):** V-D3, V-R3/R4/R6/R7, V-R5 visual.
