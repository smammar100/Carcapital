# Car Capital UK

Dealership management software for an independent UK used-car dealer. It carries a
car through its whole life in the business — bought in, inspected, prepped,
photographed, advertised, sold, invoiced, warranted, and occasionally returned —
in one system.

It replaces roughly **£500/month** of disjointed third-party tools (Click Dealer,
Spine, Visitor Chat) plus paper job cards and spreadsheets.

The organising idea is that **a registration is the only thing you should have to
type**. Enter a plate and DVLA fills the make, model, fuel and tax status, DVSA
supplies the MOT history, and AutoTrader returns a valuation. Everything
downstream — inspection, jobs, advert, invoice, warranty — hangs off that one
record rather than being re-keyed at each stage.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build, type-checked
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm test       # vitest
```

Needs a `.env.local` with the Supabase URL, publishable key and
`SUPABASE_SERVICE_ROLE_KEY`. Without the service-role key the server routes that
mint accounts or read profiles will fail — that key is not optional, and
`vercel env pull` returns it blank because it is marked sensitive.

## How it fits together

**Next.js 16** (App Router, Turbopack), **TypeScript** strict, **Tailwind v4**,
**Base UI** and **Nord** components, **Supabase** (Postgres + Auth + RLS).

- **Services are the only data access point.** UI calls
  `src/lib/services/*-service.ts`; those talk to Supabase. Nothing else queries
  the database directly.
- **Postgres owns the invariants.** RLS scopes every table by company, and
  derived values that used to drift are maintained by triggers rather than by
  call sites remembering (see `db/migrations/0049`).
- **Server routes hold anything privileged** — `src/app/api/*` for account
  creation, AutoTrader publishing, DVLA lookups and cron. `requireUser()`
  authenticates the caller and resolves capabilities; routes never trust a
  company or actor id from the request body.
- **Forms** are `react-hook-form` + `zod` throughout.
- **PDFs** (invoices, job cards, warranty certificates) via
  `@react-pdf/renderer`, dynamically imported so the runtime stays out of the
  initial bundle.
- **Activity log** is written by every mutating service, so the audit trail is
  part of each feature rather than bolted on.
- **48 SQL migrations** in `db/migrations` (numbered to `0049`), applied in order.
  After a schema change, regenerate `src/lib/supabase/database.types.ts`.

## Permissions

Access is a flat list of **48 capabilities** (`src/lib/capabilities.ts`) granted
per user, not role bundles. The sidebar, the route guard and the API routes all
read the same set, so a driver, an inspector and the owner each see only their
own work, and a view that is hidden is also refused server-side.

Staff can be created without email: the admin sets a username and a temporary
password, and the account carries an internal synthetic address
(`<username>@<slug>.staff.carcapital.uk`) that is never shown to anyone.

## Modules

- **Inventory** — All Vehicles, Locations
- **Maintenance** — Inspection Queue, Prep & Repair, Job Pipeline, Calendar,
  Workshop Jobs
- **Advert** — Work List, Performance, Advertisers
- **Sales** — Leads, Appointments, Pipeline, Completed Sale, Invoice Generation
- **Warranties** — In-House, External, Claims, Returns and Cancellations
- **Administrative** — Master Sheet, Master Calendar, Reports, Invoicing,
  Vendors, Users & Permissions, Activity Log, Settings

Several of these are configurable rather than hardcoded: sales pipeline stages,
the inspection checklist and lead channels are all editable in Settings.

## Integrations

| Service | Used for |
|---|---|
| DVLA | Vehicle lookup from a registration |
| DVSA | MOT history and expiry |
| AutoTrader | Valuations, stock publishing, advertiser sync |
| Resend | Staff credential and notification email |
| LLM | Advert description generation, photo processing |

## Tenancy

**Single-tenant today** — one dealership. Every table carries `company_id` and
RLS scopes by it, so the model is multi-tenant-ready, but nothing has yet run
against a second dealer with different processes. That is the main thing
standing between this and a product: pipeline stages, checklists and lead
channels are already user-configurable, while finance providers and add-on
prices are still hardcoded.

## Conventions worth knowing before changing code

- Read `AGENTS.md` first. This is **Next.js 16** — APIs and file conventions
  differ from older versions, and the relevant guide lives in
  `node_modules/next/dist/docs/`.
- `pnpm typecheck && pnpm lint && pnpm test` before committing. Lint currently
  reports a known baseline; leave it no worse than you found it.
- Migrations are applied by hand, in order, and the generated Supabase types are
  regenerated separately. Shipping code that reads a column before its migration
  runs will break the deploy.
