# UAT — All Vehicles & Master Sheet (shared grid) + tab consistency

Scope: the Master Sheet grid was extracted into a shared `VehicleSheet`
component now used by **both** Master Sheet and All Vehicles, so they stay
identical by construction. Files: `src/components/vehicles/vehicle-sheet.tsx`,
`src/app/(dashboard)/admin/master-sheet/page.tsx`,
`src/app/(dashboard)/vehicles/page.tsx`. Also: Locations/Invoicing/vehicle-detail
tabs unified on the shared `Tabs` component.

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | All Vehicles renders as the sheet | Open **All Vehicles** | Spreadsheet-style grid: sticky row-counter + Stock ID, gridlines, `bg-muted` sticky header, chip-bar filter — matches Master Sheet. | ☐ |
| 2 | Columns differ per page | Compare All Vehicles vs Master Sheet | All Vehicles shows its curated columns (Vehicle, Make/Model, Variant, Fuel, Body, Mileage, Days, Status, Total cost, Web price, Profit, MOT); Master Sheet shows the full ~44-field set. | ☐ |
| 3 | Chip-bar filter — add | Click **+ Add filter**, choose field/op/value, Add | A filter chip appears; rows filter; "N matching" updates. | ☐ |
| 4 | Chip-bar filter — remove | Click the × on a chip | Filter removed; rows restore. | ☐ |
| 5 | Search | Type a reg / stock / make in the search box | Rows filter live; pagination resets to page 1. | ☐ |
| 6 | Columns popover | Open **Columns**, toggle a column off/on | Column hides/shows; count "(n/total)" updates. | ☐ |
| 7 | Row counter + select all | Hover rows / use the header checkbox | Row numbers show; header checkbox selects all filtered; "· k selected" appears. | ☐ |
| 8 | Inline edit (editable cols) | Click an editable cell (e.g. Mileage), change, Enter/blur | Optimistic update + toast "<reg>: <col> updated"; reverts + error toast on failure. | ☐ |
| 9 | Sticky behaviour | Scroll right and down | Stock ID column + header stay pinned; no text bleed-through. | ☐ |
| 10 | Pagination | >25 rows | Pager appears; page changes work; "Showing 1–25 of N". | ☐ |
| 11 | Export CSV (Master Sheet) | Master Sheet → **Export CSV** | Downloads `master-sheet-<date>.csv` with visible columns. | ☐ |
| 12 | All Vehicles header | Open All Vehicles header actions | **Add Vehicle** is the trailing CTA; **no Export CSV** button (removed there); Columns present. | ☐ |
| 13 | All Vehicles has no quick-add row | Scroll to bottom of All Vehicles | No quick-add footer row (Master Sheet keeps its quick-add). | ☐ |
| 14 | Profit colour | Rows with web price set | Profit shows green when >0, rose when <0, "—" when no web price. | ☐ |
| 15 | Status pills consistent | Compare status cells across All Vehicles / Master Sheet / Locations | Same flat tone pills (Listed violet, Reserved pink, Sold grey, Returned red, etc.). | ☐ |
| 16 | Tab style consistency | Compare tabs on Locations, Invoicing, vehicle-detail | All use the shared segmented `Tabs` (muted track, white active pill, animated indicator). | ☐ |
| 17 | Light + dark | Toggle OS theme | Grid, chips, pills, tabs all read correctly in both. | ☐ |
