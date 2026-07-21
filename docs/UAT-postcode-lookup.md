# UAT — Postcode address lookup (GEN-68)

Scope: Invoice Generation → **B. Buyer Details** → Post code / Address line.
Also `src/components/enquiries/postcode-lookup-field.tsx` (enquiry form),
`src/hooks/use-postcode-lookup.ts`, `src/lib/services/address-lookup-service.ts`.

Pre-reqs: signed in with Generate Invoice permission. Test postcodes used
below are real: **TW3 4BZ** (Heston East, Hounslow, London) and
**UB1 3DZ** (Southall Broadway, Ealing, London).

---

## Read this before testing

**How many addresses the dropdown shows depends on the provider, and the
current one cannot show more than one.**

`postcodes.io` (free, currently wired) is a *geographic* service: postcode →
ward, district, region. It holds no street names, house numbers or flat
numbers. Verified 2026-07-21: it returns 46 fields, **none** address-related;
Nominatim returns only the postcode centroid; OSM/Overpass has no address
nodes for these postcodes. No free source closes this gap.

So:

- **Section A** — the behaviour that must work today, one suggestion per
  postcode, user types their own house number.
- **Section B** — the multi-address behaviour. **Cannot pass until a PAF
  provider (getAddress.io / Ideal Postcodes / Loqate) is wired.** Recorded so
  it's testable the day a key exists. Do not raise these as bugs before then.

---

## A. Current behaviour — must pass now

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| A1 | No Lookup button | Open Invoice Generation, look at Post code | There is **no** "Lookup" button. The field stands alone. | ☐ |
| A2 | Suggestions appear while typing | Type `TW3 4BZ` | Within ~1s a dropdown appears below the field showing "Heston East, Hounslow, London / TW3 4BZ". No click needed. | ☐ |
| A3 | Fires before the postcode is finished | Type only `TW3 4` | The search still runs — the list doesn't wait for the final character. | ☐ |
| A4 | Nothing wasted on a stub | Type `T`, then `TW` | No lookup fires; no dropdown. | ☐ |
| A5 | Selecting fills the address | Click the suggestion | Address line becomes `HESTON EAST, HOUNSLOW, LONDON`. Dropdown closes. Post code normalises to `TW3 4BZ`. | ☐ |
| A6 | Enter selects the only match | Retype the postcode, press **Enter** | Same as A5 without touching the mouse. | ☐ |
| A7 | **No contamination between lookups** | Select `TW3 4BZ`, then type `UB1 3DZ` and select it | Address line reads **`SOUTHALL BROADWAY, EALING, LONDON`** and contains **no** trace of "HESTON" or "HOUNSLOW". *This was the reported bug.* | ☐ |
| A8 | Reopen after selecting | After accepting an address, edit the postcode again | The list reappears for the new postcode. *(Behaved inconsistently under automation — check carefully.)* | ☐ |
| A9 | House number survives | Select an address, then type `12 HIGH STREET, ` in front of it | Your text stays; only a further selection replaces the line. | ☐ |
| A10 | Deleting back clears the list | Type a full postcode, then delete characters | Stale suggestions disappear rather than lingering for a postcode no longer on screen. | ☐ |
| A11 | Unknown postcode | Type `ZZ1 1ZZ` | "No match for that postcode — enter the address manually." No dropdown, no hang. | ☐ |
| A12 | Provider down | Block `api.postcodes.io` in devtools, type a postcode | "Address lookup unavailable — enter the address manually." Distinct from A11. Form still submittable. | ☐ |
| A13 | Loading state | Watch the hint while a lookup runs | Shows "Searching…" then resolves. | ☐ |
| A14 | Cached repeat is instant | Look up `TW3 4BZ`, change to something else, come back | Second time returns immediately with no visible delay. | ☐ |
| A15 | A miss isn't cached | Type `ZZ1 1ZZ` twice | It re-checks both times — a postcode that starts resolving later must not be stuck on "no match". | ☐ |
| A16 | Spacing and case | Try `tw34bz`, `TW3  4BZ`, ` TW3 4BZ ` | All find the same place. | ☐ |
| A17 | Manual entry still allowed | Ignore the dropdown, type an address by hand | Accepted; the invoice saves with it. | ☐ |
| A18 | Honest hint | Read the text under the field | Says to pick the area and add your own house number and street — it does not promise a full address. | ☐ |
| A19 | Enquiry form unaffected | Enquiries → customer step → postcode | Still fills town/county and **keeps** whatever is on address line 1. | ☐ |
| A20 | Dark mode | Repeat A2 and A5 in dark mode | Dropdown legible, correct contrast, sits above the fields below it. | ☐ |

---

## B. Multi-address behaviour — blocked on a PAF provider

**Expected to fail with the current provider. Do not raise as bugs yet.**

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| B1 | Several addresses listed | Type a residential postcode covering 5–6 properties | The dropdown lists each property separately, not one locality row. | ☐ |
| B2 | House number auto-fills | Select "12 High Street" | Address line includes the house number — nothing left to type. | ☐ |
| B3 | Flat / unit addresses | Pick a postcode with flats, select "Flat 2, 123 …" | The flat portion is captured correctly in the address line. | ☐ |
| B4 | Long lists scroll | A postcode with 20+ delivery points | The dropdown scrolls within its own bounds. | ☐ |
| B5 | Ordering | Any multi-address postcode | Listed in a sensible order (house number ascending), not arbitrary. | ☐ |
| B6 | Separate fields | Select any address | If town/county columns are added to the invoice, each populates its own field rather than one concatenated line. | ☐ |

**Blocking decisions for the team:**

1. Which PAF provider, and who owns the key/billing.
2. Whether the invoice gains separate **town** / **county** columns, or keeps
   one `buyerAddress` line. B6 and GEN-68's original test case 2 depend on this.

---

## Sign-off

| Field | Value |
|---|---|
| Tester | _________________________ |
| Date | _________________________ |
| Section A cases | ___ / 20 passed |
| Section B | blocked — provider not wired |
| Commit SHA tested | _________________________ |
| Notes | _________________________ |

**Status:**
- ☐ Section A approved
- ☐ Approved with follow-ups
- ☐ Rejected — return to dev
