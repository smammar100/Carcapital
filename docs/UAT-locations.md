# UAT — Locations page + Move dialog

Scope: Locations redesign (Variation E — minimal segmented list) and the
shared Move dialog. Files: `src/app/(dashboard)/admin/locations/page.tsx`,
`src/components/locations/location-tab.tsx`,
`src/components/locations/move-dialog.tsx`. 4 locations: Forecourt / Yard /
Garage / Staff (Garage & Staff are off-site).

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Segmented tabs w/ counts | Open **Locations** | Shared segmented `Tabs` (Forecourt/Yard/Garage/Staff) each with a live count badge; active tab = white pill. | ☐ |
| 2 | Switch location | Click each tab | List updates to that location's cars; URL `?tab=` updates; active count badge styled. | ☐ |
| 3 | List rows | View a populated tab | Each row: reg plate, make/model + stock ID, status pill, days-here chip, **Move** button. | ☐ |
| 4 | Off-site context | Open **Garage** / **Staff** | Rows show the workshop/staff name; Staff rows show "· back <date/time>" when set. | ☐ |
| 5 | Sub-filter chips | Garage/Staff with multiple vendors/staff | "All / <name>" chips filter the list. | ☐ |
| 6 | Search | Type in the search box | Filters by reg/stock/make; footer "x of y cars". | ☐ |
| 7 | Export CSV | Click **Export CSV** | Downloads `locations-<tab>-<date>.csv`. | ☐ |
| 8 | Vehicle link | Click a row's make/model | Navigates to that vehicle's detail page. | ☐ |
| 9 | Empty location | Open a tab with 0 cars | Shows "No cars at <location>." (no broken layout). | ☐ |
| 10 | Move — open | Click **Move** on a row | Move dialog opens: title "Move <stock> — <make> <model>", current location shown. | ☐ |
| 11 | Move — destination tiles | Inspect "Move to" | Four selectable tiles with icons + visible borders; current location is **dashed/disabled ("Current")**; others selectable. | ☐ |
| 12 | Move — select | Click a destination tile | Tile gets primary border/ring + check; **Move →** button enables. | ☐ |
| 13 | Move — garage/staff branch | Pick **Garage** or **Staff** | Reveals required Workshop / Staff member + Expected-back fields; can't submit until filled. | ☐ |
| 14 | Move — dialog padding | Visual check | Header / body / footer share consistent padding; footer has its top border; body scrolls if tall. | ☐ |
| 15 | Move — submit | Choose destination + (branch fields) → **Move** | Vehicle moves; toast; source tab count −1, destination +1; list refreshes. | ☐ |
| 16 | Move — cancel | Open Move → **Cancel** | Closes; nothing changes. | ☐ |
| 17 | Light + dark | Toggle OS theme | List rows, pills, chips, dialog all read correctly. | ☐ |
