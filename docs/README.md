# Car Capital UK — Documentation

This folder is the single source of truth for what the app **does today**. It is shipped behaviour only — roadmap and planned features live in the build plan, not here.

> **Last verified against `main` HEAD:** `86f9d91` (pure-white surface ladder, 15 May 2026)

---

## Pick your role

| If you are… | Start here |
|---|---|
| 🧑‍💼 **A stakeholder or buyer** — you want to know what this app *is* and what it can *do* for a UK independent dealer | [`overview.md`](./overview.md) → then any module in [`modules/`](./modules/) |
| 👩‍🔧 **A user** — Bass Bhai's team, learning how to operate the app | [`modules/`](./modules/) — pick the section that matches the sidebar group you're working in |
| 👨‍💻 **A developer** — you're onboarding to the codebase or shipping a change | [`reference/architecture.md`](./reference/architecture.md) → then [`reference/services.md`](./reference/services.md) and [`reference/data-model.md`](./reference/data-model.md) |
| 🤖 **An AI agent** — Claude Code, Copilot, or another automation reading this repo | [`for-ai-agents/codebase-map.md`](./for-ai-agents/codebase-map.md) — flat file→owner table, no prose |

---

## What's where

| Path | Purpose |
|---|---|
| `overview.md` | 1-page elevator pitch — what Car Capital UK does for a dealer |
| `glossary.md` | UK dealer + app jargon (V5, MOT, SIV, stocking, capability, surface, etc.) |
| `flows/arrival.md` | End-to-end: login → Add Vehicle → DVLA → inspection → "ready" |
| `flows/sale.md` | End-to-end: lead → appointment → deal stages → invoice → "sold" |
| `flows/warranty.md` | End-to-end: warranty issued → claim filed → claim resolved → certificate |
| `modules/dashboard.md` | Home dashboard: KPI tiles, Recent Deals, Calendar, Deals in Progress, Repairs |
| `modules/inventory.md` | All Vehicles, Add Vehicle, Vehicle Detail, Inspection |
| `modules/maintenance.md` | Pipeline, Calendar, Inspection Queue, Workshop Jobs |
| `modules/advert.md` | Work List, Photo Processing, Listings, Performance |
| `modules/sales.md` | Leads, Appointments, Pipeline, Deals, Invoice Generation |
| `modules/warranties.md` | In-House, External, Claims (+ Warranty Detail) |
| `modules/administrative.md` | Master Sheet, Master Calendar, Users, Returns, Invoicing, Vendors, Activity, Settings |
| `reference/architecture.md` | Stack, app-router layout, request flow, env-var contract |
| `reference/data-model.md` | Entities, relationships, ERD |
| `reference/services.md` | Indexed catalogue of all 24 services in `src/lib/services/` |
| `reference/auth-and-permissions.md` | Supabase auth, middleware, the 38 capabilities, `useCan()` |
| `reference/api-routes.md` | `/api/dvla/lookup`, `/api/photo/generate`, `/api/photo/vehicle` |
| `reference/design-system.md` | Surface elevation ladder, Card primitive, design tokens |
| `reference/pdfs.md` | Invoice, Job Card, Warranty Certificate templates |
| `for-ai-agents/codebase-map.md` | One row per source file → role mapping. Machine-readable. |

---

## How to read a module doc

Every file in `modules/` follows the same six-section template:

1. **What it is** — plain English for stakeholders
2. **What users can do** — task bullets for users
3. **Routes** — table for devs + AI
4. **Components** — `src/components/<module>/*` listed for devs + AI
5. **Services & data** — which services and entities back this module
6. **Workflow** — a Mermaid diagram everyone reads

If you only have 60 seconds, read sections 1 + 2 + 6. If you're implementing, read 3 + 4 + 5.

## How to read a flow doc

Files in `flows/` describe a single end-to-end user journey. They tell you the trigger, the step-by-step path, the files involved at each step, the permissions required, and what can go wrong. Every flow ends with a Mermaid sequence diagram.

## How to keep this current

When you ship a change that touches a routed page, a service, an entity, or a capability:

1. Update the module doc whose Routes table contains the affected page.
2. If you added a new entity or a new capability, update `reference/data-model.md` or `reference/auth-and-permissions.md`.
3. Update the "Last verified against HEAD" line in the affected doc with the new SHA.
4. If the change crosses modules (a new end-to-end journey), update or add a `flows/` doc.
5. `for-ai-agents/codebase-map.md` should be regenerated mechanically when files are added or removed.

The verification gates in the build plan (§D12) describe how a reviewer confirms a documentation change is complete.
