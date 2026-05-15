# Dashboard

> **Sidebar group:** (root)
> **Routes owned:** 1
> **Primary entities:** `Vehicle`, `SalesDeal`, `Appointment`, `MaintenanceJob`, `Notification`

## What it is  *(stakeholder)*

The dashboard is the first thing a logged-in user sees. It compresses the state of the business into one screen: how much stock the dealer is sitting on, how many cars are ready to sell, what was sold this month, which warranty claims are open, who's enquired in the last 24 hours, and how stale the inventory is on average. Below that, a Recent Deals table summarises the latest sales activity next to a Calendar showing today and tomorrow's appointments. The bottom row tracks Deals in Progress and Ongoing Repairs.

It is *not* a deep analytics tool. Everything on the dashboard either links to a deeper view or surfaces a single number for a quick reality-check.

## What users can do  *(end-user)*

- Glance at the **6 KPI tiles** to see stock count, readiness count, sold-this-month, open warranty claims, new leads in 24h, and average days in stock.
- Click any KPI tile to drill into the source page (e.g. clicking "Cars in Stock" jumps to `/vehicles`).
- Read the **Recent Deals** table (last 7 deals across all stages) and filter by registration or customer.
- Click a vehicle in Recent Deals to open its detail page.
- Use the **Calendar** card to see today's appointments and tomorrow's events. Carousel through individual events when a day has multiple.
- Scroll to **Deals in Progress** — open negotiations grouped by stage.
- Scroll to **Ongoing Repairs** — active maintenance jobs.
- Open the **Find vehicle card** to type a registration and jump straight to a vehicle.

## Routes  *(developer + AI)*

| Route | Page file | Primary components | What it shows |
|---|---|---|---|
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | `DashboardKpiRow`, `DashboardRecentDeals`, `DashboardCalendar`, `DashboardDealsInProgress`, `DashboardOngoingRepairs`, `FindVehicleCard` | KPI row + 3 row layout |

## Components  *(developer + AI)*

Located in `src/components/dashboard/`:

| Component | Purpose |
|---|---|
| `dashboard-greeting.tsx` | "Welcome back, <name>!" header |
| `dashboard-kpi-row.tsx` | The 6-tile KPI grid (CSS `xl:grid-cols-6`) |
| `dashboard-stat-card.tsx` | Individual KPI tile (label, icon, current value, trend) |
| `dashboard-recent-deals.tsx` | Last-7-deals table with reg search + filter |
| `dashboard-calendar.tsx` | Today + tomorrow calendar widget with event carousel |
| `dashboard-deals-in-progress.tsx` | Open negotiations grouped by stage |
| `dashboard-ongoing-repairs.tsx` | Active maintenance jobs |
| `find-vehicle-card.tsx` | Registration search → vehicle detail page |
| `dashboard-revenue-chart.tsx` | recharts revenue summary (currently not in primary layout) |
| `sales-by-make-card.tsx` | Make-distribution donut (lives here but not on the dashboard route today) |
| `master-calendar-preview.tsx` | Compact calendar preview (used elsewhere too) |

## Services & data  *(developer + AI)*

| Source | Reads | Writes |
|---|---|---|
| `vehicle-service.ts` | `getAll`, `getByStatus` (for KPI counts + days-in-stock) | — |
| `claim-service.ts` | `getAll` (open claims count) | — |
| `lead-service.ts` | `getRecent` (new leads in 24h) | — |
| `sales-service.ts` | `getAll` (Recent Deals + Deals in Progress) | — |
| `appointment-service.ts` | `getAll` (Calendar card) | — |
| `maintenance-service.ts` | `getAll` (Ongoing Repairs) | — |
| `notification-service.ts` | `getForUser` (header bell) | `markRead` |

The KPI row fires off three parallel reads (`vehicles`, `claims`, `leads`) on mount via `Promise.all`. All cached via the standard service-layer cache.

## Workflow  *(everyone)*

```mermaid
flowchart LR
  A[Login] --> B[/dashboard]
  B --> C{User action}
  C -->|click KPI| D[Drill-down page]
  C -->|click deal row| E[Vehicle detail]
  C -->|search reg| F[Find Vehicle - jump]
  C -->|click calendar event| G[Event preview]
```

## Edge cases & gotchas  *(developer)*

- **Card height parity** — Recent Deals and Calendar are on Row 2 of the layout. They sit in a `grid lg:grid-cols-[2fr_1fr]` and the calendar carousel exists specifically so both cards match height regardless of how many events exist for the visible day. If you add a third widget to Row 2, the layout breaks.
- **`bg-card` vs surface system** — KPI tiles use `bg-card` (always `#FFFFFF`). Bigger cards use the `<Card>` primitive which uses `<Elevated offset={1}>`. Since the May 2026 white-surface decision, both render the same colour; before that they didn't.
- **No realtime subscription** — the dashboard cards do not currently subscribe to `useRealtimeTable`. KPIs refresh on page mount or full reload. If you make the dashboard the canonical "live" view, wire subscriptions to `vehicles` + `sales_deals` + `appointments`.
- **KPI thresholds** — Average days in stock is colour-coded via `DAYS_IN_STOCK_THRESHOLDS` in `src/lib/constants.ts` (green / amber / red bands). Adjust there, not in the component.
