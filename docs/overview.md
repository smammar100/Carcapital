# Car Capital UK — Overview

> **Audience:** stakeholders + new users + new developers + AI agents
> **Read time:** 3 minutes

Car Capital UK is an operating system for an independent UK used-car dealership. It replaces the patchwork of spreadsheets, WhatsApp threads, paper inspection sheets, and standalone tools (incumbent dealer SaaS, AutoTrader portal, Excel master sheet) that a typical 50-150-vehicle yard relies on to run day-to-day operations.

## What it does for a dealer

The app covers the full vehicle lifecycle, from the moment a buyer collects a car at auction until the warranty on that car expires and the customer moves on.

- **Buying a vehicle** — registration is typed into an arrival form, DVLA's Vehicle Enquiry Service pre-fills make/year/colour/fuel/engine/MOT, the dealer enters costs (buying price, fees, transport), and the system assigns a stock ID (e.g. `CC-0042`).
- **Preparing it for sale** — a 20-point inspection produces a pass/fail snapshot; any failures auto-create "Things to Do" tasks routed to mechanics, photographers, valeters, or external vendors. Each task tracks who owns it, what it costs, and whether it's done.
- **Listing and pricing it** — once a vehicle is "ready", a listing can be published to the website (and, in future versions, to AutoTrader / eBay / Facebook). Photos are processed via OpenAI image generation for background removal and consistent backdrops.
- **Selling it** — leads come in from various sources, get qualified into enquiries, convert to appointments (test drives), become deals (negotiation → offer → deposit → completion), and finally generate a VAT-margin or qualifying invoice in PDF form.
- **Standing behind it** — warranties (in-house or external third-party) cover the vehicle after sale. When the customer reports an issue, a claim is filed, reviewed, approved or rejected, and resolved with a documented resolution.
- **Closing the loop** — every action is captured in the activity log. The master sheet exports the full lot. The returns flow handles the rare case where a sold vehicle comes back.

## Who uses it

A single-tenant deployment serves one company (currently Car Capital UK Limited). Inside the company, role bundles map to specific capabilities:

| Role | Typical user | What they mostly do |
|---|---|---|
| Owner | Bass Bhai | Sees everything, signs invoices, manages users |
| Admin | Office manager | Master sheet, vendor admin, settings |
| Inventory Manager | Yard supervisor | Arrival forms, stock book, ready-status decisions |
| Inspector | Mechanic / prep lead | 20-point inspection, things-to-do completion |
| Sales | Sales staff | Leads, appointments, deal pipeline, invoice generation |
| Driver | Vehicle mover | Workshop / maintenance updates |

Permissions are granular — there are 38 distinct capabilities (e.g. `invoice:generate`, `vehicle:status:change`, `warranty:claim:resolve`) bundled into roles. Anyone with `isSuperUser` bypasses every check. See [`reference/auth-and-permissions.md`](./reference/auth-and-permissions.md) for the full list.

## How it's built (one paragraph for the curious)

Next.js 16 App Router on top of Supabase Postgres + Auth + Storage, with TypeScript end-to-end. The UI is shadcn/ui primitives over Tailwind v4, augmented by a custom "elevation system" that walks a surface ladder from level 1 (top-level cards) up to level 8 (deep modals) so nesting reads correctly regardless of how deep a component sits. DVLA and OpenAI calls are proxied through Next.js API routes so secret keys never reach the browser. PDFs are generated with `@react-pdf/renderer`. For the full stack and request flow, see [`reference/architecture.md`](./reference/architecture.md).

## What this app does **not** do (yet)

So nobody is surprised by what's missing:

- No AutoTrader / eBay / Facebook live feed (listing is single-channel for now).
- No multi-tenancy (one company per deployment).
- No mobile-native apps (desktop-first responsive web).
- No HPI checks, no real MOT history pull (the MOT date comes from DVLA but the full history feed is on the roadmap).
- No customer-facing portal (everything is internal-staff-only).
- No accounting integration (the invoice is generated; the bookkeeping happens elsewhere).

The build plan in `.claude/plans/` tracks roadmap features. Documentation here is deliberately shipped-only — what you see in `modules/` works today.

## Where to go next

- **Stakeholder demo prep** — read this page, then `modules/inventory.md` and `modules/sales.md`. These two are the bulk of what the app does end-to-end.
- **Training a new user** — start with `flows/arrival.md` (the most common task), then `flows/sale.md`, then `flows/warranty.md`.
- **Onboarding a developer** — `reference/architecture.md` → `reference/services.md` → pick a module doc to spot-check.
- **Programmatic ingest** — `for-ai-agents/codebase-map.md`.
