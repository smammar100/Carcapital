# Car Capital UK

Used-car dealership management platform for **Car Capital UK**. Replaces ~£500/month of disjointed third-party tools (Click Dealer, Spine, Visitor Chat) plus paper job cards and Excel sheets.

This is **v1** — single-tenant, mock data, demo-style login. The architecture is designed so Supabase can be plugged in later by swapping internals of `src/lib/services/*` — UI never changes.

## Run

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build    # production build with type checking
pnpm lint     # eslint
```

## Demo credentials

There is no password — `/login` is a user picker. Click any tile to sign in.

| User | Role |
|---|---|
| **Abbas Bhai** | Owner (super-user) |
| Amjad Bhai | Inventory Manager |
| Raza | Driver |
| Mohsin | Driver |
| Kami | Inspector |
| Sikander | Sales |
| Shan Bhai | Prep Lead |

## Demo flow (v4.1)

1. Sign in as **Abbas Bhai** → dashboard shows live KPIs.
2. **Add Vehicle** (`/inventory/add-vehicle`) — type `YB19 XMD` then tab out → DVLA auto-populates Ford Fiesta data. Stock ID is the next sequential `CC-NNNN`.
3. Open the new vehicle → click **Open Inspection** → side-panel slides in from the right. Fail 3 items (e.g. "Replace" / "Faulty" / "Active") → **Complete Inspection** → side-panel closes; failed items appear in **Things to Do**.
4. Mark some todos complete → manually move vehicle to `ready`.
5. Go to **Work List** (`/advert/work-list`) → **Create Listing** → publish to website.
6. Create a **Lead** (`/sales/leads`), link it to a stock vehicle, then book an appointment from the lead drill modal.
7. Open the **Sales Pipeline** (`/sales/pipeline`) → drag the deal to `deposit_taken` → click **Generate Invoice** → deep-links to `/sales/invoice-generation?vehicleId=…` with the vehicle, buyer, and £500 deposit pre-filled.
8. Add a **Warranty** add-on (£350) and a **Polish** add-on (£40), choose **Margin Scheme**, enter finance details → **Generate PDF** → invoice PDF opens with grouped line items + structured payment block (deposit / finance / balance).
9. **Email** + **Mark Paid** from `/admin/invoicing`.
10. Create a **Warranty** for the sold vehicle → **Generate Certificate** PDF. Open a claim → it surfaces under `/warranties/claims`.
11. **Process Return** (`/admin/vehicle-returns`) with `g_trader` resolution → vehicle status flips to `returned`.
12. **Master Calendar** (`/admin/master-calendar`) shows appointments + workshop + maintenance in one view. **Activity Log** (`/admin/activity`) lists every step above.

### Try the capability grid

In `/admin/users-and-permissions`, switch the user picker to **Sikander**, untick `Send Invoice`, click **Save permissions**. Sign out, sign in as Sikander, navigate to `/admin/invoicing` — the **Email** button is disabled.

## Architecture

- **Next.js 16** (App Router, Turbopack) + **TypeScript** strict + **Tailwind v4** + **shadcn/ui**.
- **Service layer is the only data access point.** UI calls `src/lib/services/*-service.ts`; services read/write `src/lib/mock-data.ts`. Every service function has a `// TODO: Supabase` comment showing the future query.
- **Single-tenant** in v1 (Car Capital UK only). Entities still carry a `companyId` for forward-compat with the Supabase migration.
- **Forms** use `react-hook-form` + `zod` resolver everywhere.
- **PDF generation** via `@react-pdf/renderer`, dynamically imported so the runtime never lands in the initial client bundle.
- **Calendar views** use `react-big-calendar` with the `date-fns` localizer.
- **Charts** use `recharts`.
- **Activity log** is written by every mutating service so the audit trail is part of the feature, not an add-on.

## Modules (v4.1)

Sidebar grouping per `CLAUDE_CODE_PROMPT_v4_1.md` §10:

- **Admin** — Master Sheet, Master Calendar, Users & Permissions, Vehicle Returns, Invoicing, Vendors, Activity Log, Settings
- **Inventory** — All Vehicles, Add Vehicle
- **Maintenance** — Pipeline, Calendar, Inspection Queue, Workshop Jobs
- **Advert** — Work List, Photo Processing, Listings, Performance
- **Sales** — Leads, Appointments, Pipeline, Deals, Invoice Generation
- **Warranties** — Active, Open Claims

## Out of scope (v2)

Real Supabase backend, real DVLA / Auto-Trader integrations, real WhatsApp / SendGrid notifications, real photo background removal, payments, customer chat, PWA.
