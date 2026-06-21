# UAT — Vehicle Detail · Overview (price meter) + Details tab

Scope: Overview tab's AutoTrader Valuation card now includes a price-vs-market
meter; Details tab rebuilt as grouped cards (Variation D). Files:
`src/components/vehicle-detail/overview-tab.tsx`,
`src/components/vehicle-detail/details-tab.tsx`.

## Overview — price-vs-market meter

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Meter present | Open **Overview** on a vehicle with an AutoTrader valuation | AutoTrader Valuation card shows Trade / Part Ex / Retail, then a **"Your price vs market"** meter below. | ☐ |
| 2 | Marker position | Compare web price to Trade/Retail | Marker sits proportionally on the Trade→Retail band (clamped to the ends). | ☐ |
| 3 | Verdict chip | Vary the relationship | Chip reads **Below market** (≤0.97×retail), **Within market** (≤1.03×), or **Above market** (else), tone-coded. | ☐ |
| 4 | Hidden when no data | Vehicle with no valuation or no web price | Meter is hidden (card still shows the cells / refresh). | ☐ |
| 5 | Refresh valuation | Click **Refresh** (creds permitting) | Pulls a live valuation, persists, meter + cells update. | ☐ |
| 6 | Light + dark | Toggle OS theme | Gradient bar + marker + chip read correctly. | ☐ |

## Details tab — grouped cards

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 7 | Four grouped cards | Open **Details** | Identity / Acquisition / Documentation / Registration & Compliance cards, each with an icon header. | ☐ |
| 8 | No hero strip | Visual | There is **no** reg/identity hero strip above the cards (removed per request); the page's own vehicle header remains at top. | ☐ |
| 9 | All fields present | Compare to old Details | Every field retained — Make/Model, Variant, Year, Colour, Mileage, Engine, Body, Fuel, Transmission; Stock ID, Received, Seller, Purchase Source, Service History; V5, Keys, Lock Nut, MOT Expiry; MOT Status, Tax Status, Tax Due, CO₂, Euro, Wheelplan, First Registered, Last V5C. | ☐ |
| 10 | Compliance pills | View Registration & Compliance | MOT Status / Tax Status render as tone-coded pills (Valid→green, Untaxed→amber, etc.); missing values show "—". | ☐ |
| 11 | Layout / padding | Visual, light + dark | Label-left / value-right rows align; consistent padding; no overflow. | ☐ |
