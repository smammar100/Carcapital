# UAT — Reports & Analytics dashboard (GEN-71)

Scope: `/admin/reports`, `src/lib/reports.ts`.

Pre-reqs: signed in with **View Financials**. Have the master sheet open in a
second tab — several cases check the two agree.

Both read the same source (`vehicleService.getAll`), so any disagreement is a
bug, not a rounding difference.

## Filters

"Year" means the year of the event being reported: the **sale** year for a car
that sold, the **arrival** year for one still in stock.

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 1 | Sensible default | Open the page | All-time snapshot with real numbers — not an empty state waiting for a filter. | ☐ |
| 2 | Year filter | Pick a year | Every KPI and chart recalculates. Units sold matches the master sheet's count of cars sold that year. | ☐ |
| 3 | Make filter | Pick a make | Numbers scope to that make; charts redraw. | ☐ |
| 4 | Models cascade | Pick a make, then open **Model** | Only that make's models are listed. | ☐ |
| 5 | Make reset | Change the make after choosing a model | Model resets to "All models" rather than keeping a mismatched value. | ☐ |
| 6 | Status filter | Pick a status | Scopes to cars in that state. | ☐ |
| 7 | **Filters intersect** | Apply year + make together where the make has no sale in that year | Units sold shows **0** — the result is the intersection, not the last filter applied. | ☐ |
| 8 | Empty state per chart | With #7 applied | Charts read "No sales yet." — no crash, no stale bars. | ☐ |
| 9 | Filter summary | With filters applied | The line under the bar names them ("Year 2024 · Make FORD") and a chip offers "Clear N filters". | ☐ |
| 10 | Clear | Click the clear chip | All filters reset; numbers return to the all-time snapshot. | ☐ |

## Reports

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 11 | Sales by year | Set granularity to **Year** | Profit and Revenue charts bucket by year. | ☐ |
| 12 | Granularity | Switch Month / Quarter / Year | Buckets and axis labels re-scale. | ☐ |
| 13 | Best-selling model | Read the **Best-selling models** card | Models ranked by units sold, most first, capped at 8. | ☐ |
| 14 | Profit margin by model | Read the **Profit margin by model** card | Ranked by profit as a % of revenue, with each model's unit count in brackets so a one-car outlier is visible as one. | ☐ |
| 15 | Margin maths | Pick a model and check by hand | Margin = profit ÷ revenue × 100 for that model's sold cars. | ☐ |
| 16 | Reports follow filters | Apply a make filter | Both model cards re-rank within that make. | ☐ |

## Export

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 17 | Export | Click **Export report** | `reports-analytics-<date>.xlsx` downloads. | ☐ |
| 18 | Filters recorded | Export with filters applied, open Summary | A **Filters** row names them — a filtered workbook can't be mistaken for an all-time one. | ☐ |
| 19 | By-model sheet | Open the **By model** sheet | Every model with units, revenue, profit and margin — not just the charted top 8. | ☐ |
| 20 | Numbers are numbers | Inspect money cells | Raw numbers, not formatted strings, so the file stays usable in Excel. | ☐ |

## Out of scope

An LLM / chat interface over the data was explicitly deferred on the UAT call
and is **not** part of this work.
