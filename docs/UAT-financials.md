# UAT — Vehicle Detail · Financials tab + External Invoices + invoice/vendor modals

Scope: Financials tab rebuilt as "money-in vs money-out" (Variation B);
External Invoices section redesigned; New-invoice and New-vendor modals fixed.
Files: `src/components/vehicle-detail/financials-tab.tsx`,
`src/components/vehicle-detail/external-invoices-section.tsx`,
`src/components/external-invoices/external-invoice-form.tsx`,
`src/components/external-invoices/vendor-inline-add.tsx`. HMRC margin-scheme aware.

## Financials tab (Variation B)

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Compact intro | Open **Financials** | One-line muted helper (no bulky banner) explaining the margin scheme. | ☐ |
| 2 | Money-in / money-out | View top | **Money out · Expenses** (full ledger, all rows incl £0) ↔ chevron ↔ **Money in · Revenue** (Retail + add-ons), each with a total. | ☐ |
| 3 | Net result | Below ledgers | Centred "Net profit after margin VAT" with Gross − Margin VAT explanation. | ☐ |
| 4 | AutoTrader position | If valuation present | Card with Retail/Trade/Part-ex/Private + a market-position bar and Priced-to-sell / At / Above market verdict. | ☐ |
| 5 | Purchase Information | View | Supplier, VAT scheme, source, buying price, total buying, stocking provider + Print Invoice. | ☐ |
| 6 | VAT Margin Scheme | View | Gross Profit / Margin VAT / Car Margin / Net Profit (SIV) with formulas. | ☐ |
| 7 | No info lost | Compare to old tab | All KPIs/values present across the new sections. | ☐ |

## External Invoices section

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 8 | Summary tiles | View section | Three tiles: Auction Purchase / External Jobs / **Total Logged** (icons + invoice counts). | ☐ |
| 9 | Slim empty state | Vehicle with no external invoices | A single muted line "No external invoices logged yet — use Purchase or External Job above…" (the old big dashed panel + duplicate buttons removed). | ☐ |
| 10 | Header CTAs | Click **Purchase** / **External Job** | Opens the New-invoice modal with the matching kind preselected. | ☐ |
| 11 | Row list + totals | With invoices present | Rows show kind chip, attachment, description, vendor, date, total; tiles + totals reflect them. | ☐ |
| 12 | Permission gate | User without create permission | Add buttons hidden / total pill shown instead. | ☐ |

## New invoice modal

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 13 | Vehicle chip (locked) | Open from a vehicle | Vehicle field shows a **reg-plate + make/model + stock + "Locked"** chip — **not** a raw UUID. | ☐ |
| 14 | Vendor + inline add | Pick vendor / **Add new vendor** | Vendor select works; inline-add creates + selects a vendor. | ☐ |
| 15 | Amounts | Enter Total + VAT | Pre-VAT computes; "VAT can't exceed Total" guard blocks submit. | ☐ |
| 16 | Attachment | Drag/choose a file | Uploads; draft cleaned up on cancel. | ☐ |
| 17 | Padding / scroll | Visual | Body uses consistent padding (DialogPanel) and scrolls on short viewports. | ☐ |
| 18 | Save | Fill required → Save | Invoice persists; section tiles/rows update. | ☐ |

## New vendor modal

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 19 | Padding | Open "Add new vendor" | Body padding matches header/footer (DialogPanel); label/field spacing correct; Speciality select full-width. | ☐ |
| 20 | Create + dedupe | Add a vendor; try a duplicate name | Creates + selects; duplicate name is caught with a friendly message. | ☐ |
