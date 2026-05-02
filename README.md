# Car Capital UK

Used-car dealership management platform for **Car Capital UK** and its sister company **Car Giant**. Replaces ~£500/month of disjointed third-party tools (Click Dealer, Spine, Visitor Chat) plus paper job cards and Excel sheets.

This is **v1** — mock data, demo-style login, all 17 modules. The architecture is designed so Supabase can be plugged in later by swapping internals of `src/lib/services/*` — UI never changes.

## Run

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build    # production build with type checking
pnpm lint     # eslint
```

## Demo credentials

There is no password — `/login` is a user picker. Click any tile to sign in.

| User | Company | Role |
|---|---|---|
| **Bass Bhai** | Car Capital UK | Owner (can switch companies) |
| Amjad Bhai | Car Capital UK | Inventory Manager |
| Raza | Car Capital UK | Driver |
| Mohsin | Car Capital UK | Driver |
| Kami | Car Capital UK | Inspector |
| Sikander | Car Capital UK | Sales |
| Shan Bhai | Car Capital UK | Prep Lead |
| Tariq | Car Giant | Admin |

The owner sees both companies and can switch via the header dropdown. Everyone else is scoped to their `companyId`.

## Demo flow

1. Sign in as **Bass Bhai** → dashboard shows live KPIs.
2. **Add Vehicle** (`/vehicles/new`) — type `YB19 XMD` then tab out → DVLA auto-populates Ford Fiesta data.
3. Open the new vehicle → **Inspection** tab → **Start Inspection** → fail 3 items (e.g. select "Replace" / "Faulty" / "Active" statuses).
4. Complete inspection — failed items become **Things to Do**.
5. Mark some todos complete → manually move vehicle to `ready`.
6. Go to **Work List** → **Create Listing** → publish to website.
7. Create a **Lead**, link it to a stock vehicle, then book an appointment from the lead drill modal.
8. Open the **Sales Pipeline** → drag the deal to `deposit_taken` → **Generate Invoice** CTA appears.
9. Open **Invoicing** → **Email** the invoice → **Print PDF**.
10. Create a **Warranty** for the sold vehicle → **Generate Certificate** PDF.
11. **Process Return** with `g_trader` resolution → vehicle status flips to `returned`.
12. **Activity Log** shows every step.

## Architecture

- **Next.js 16** (App Router, Turbopack) + **TypeScript** strict + **Tailwind v4** + **shadcn/ui**.
- **Service layer is the only data access point.** UI calls `src/lib/services/*-service.ts`; services read/write `src/lib/mock-data.ts`. Every service function has a `// TODO: Supabase` comment showing the future query.
- **Multi-tenancy** via `companyId` on every entity. Owner role can override company scope.
- **Forms** use `react-hook-form` + `zod` resolver everywhere.
- **PDF generation** via `@react-pdf/renderer`, dynamically imported so the runtime never lands in the initial client bundle.
- **Calendar views** use `react-big-calendar` with the `date-fns` localizer.
- **Charts** use `recharts`.
- **Activity log** is written by every mutating service so the audit trail is part of the feature, not an add-on.

## Modules

Inventory · Maintenance (pipeline + calendar + inspection queue) · Workshop · Advert (Work List + Photo Processing) · Leads · Appointments · Sales Pipeline · Master Calendar · Warranties · Invoicing · Vehicle Returns · Vendors · Users & Authority Matrix · Master Sheet · Settings · Activity Log · Insights (preview) · Messages (placeholder).

## Out of scope (v2)

Real Supabase backend, real DVLA / Auto-Trader integrations, real WhatsApp / SendGrid notifications, real photo background removal, payments, customer chat, PWA.
