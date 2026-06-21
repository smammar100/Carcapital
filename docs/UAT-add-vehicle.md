# UAT — Add Vehicle (guided wizard)

Scope: the Add Vehicle arrival form, rebuilt as a 5-step guided wizard
(Variation E). File: `src/components/vehicles/arrival-form.tsx`. Steps:
Vehicle Identity → Source & Docs → Purchase Costs → Receiving & Pricing →
Review & Submit. Reg-first hero auto-fills from DVLA/AutoTrader; live cost
receipt; sticky action bar.

Pre-reqs: signed in; **Inventory → Add Vehicle** (note: DVLA auto-fill needs
`SUPABASE_SERVICE_ROLE_KEY` configured — see open items).

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Wizard layout | Open Add Vehicle | Left step rail (5 steps), focused panel, live **Cost Summary** receipt on the right, sticky Back / Save as Draft / Continue bar. | ☐ |
| 2 | Step navigation | Click rail steps / Continue / Back | Active step changes; completed steps show a green check; Back disabled on step 1. | ☐ |
| 3 | Reg hero | Step 1 | Registration input + **Fetch DVLA** button + live reg-plate preview. | ☐ |
| 4 | DVLA lookup (if creds set) | Type a real reg → Fetch DVLA | Status "Checking…" → "Matched" (or "incorrect"/"already in stock book"); Make/Year/Colour/Fuel auto-fill with **DVLA** pills; compliance + valuation populate. | ☐ |
| 5 | Duplicate guard | Enter a reg already in stock | "already in your stock book as <stock>" with a link. | ☐ |
| 6 | Fields persist across steps | Enter values on step 1, go to step 3, return | Step-1 values are retained (RHF keeps values across step changes). | ☐ |
| 7 | Cost breakdown + VAT | Step 3 — enter Buying Price | VAT column (20%) + Total Buying recompute; receipt updates live. | ☐ |
| 8 | Live receipt | Enter costs / listing price | Receipt recalculates Buying / Fees / Base cost / Listing / Est. profit. | ☐ |
| 9 | AutoTrader strip | After a valuation lookup | "Use as listing price" sets the listing price. | ☐ |
| 10 | Things to Do (step 4) | Add a to-do row | Item added to the list; persists on submit. | ☐ |
| 11 | Review step | Reach **Review & Submit** | Summary cards (Vehicle / Source & Docs / Costs & Pricing) each with **Edit** jumping back to that step. | ☐ |
| 12 | Validation summary | Submit with required fields missing | Error summary lists the missing/invalid fields; submit blocked. | ☐ |
| 13 | Submit | Complete required fields → **Submit Vehicle** | Creates the vehicle; toast "Vehicle <stock> added"; navigates to its detail page; to-dos + dealer-partner link persisted. | ☐ |
| 14 | Enter doesn't submit early | Press Enter in a field on steps 1–4 | Does not submit (no submit button until Review). | ☐ |
| 15 | Reg-hero width | Visual | Registration is a fixed-width control with Fetch DVLA beside it (no stretched bar). | ☐ |
| 16 | Light + dark | Toggle OS theme | Rail, panels, receipt, action bar read correctly. | ☐ |
