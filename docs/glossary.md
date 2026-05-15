# Glossary

Terms used across the codebase, the UI, and these docs. UK-dealer-specific terms first, then app-internal terms.

## UK dealership terms

| Term | Meaning |
|---|---|
| **Registration / reg / plate** | The UK vehicle registration number (e.g. `LU17 JHZ`). Yellow rear plate, white front plate. The unique key dealers use day-to-day. |
| **V5 / V5C** | The vehicle log book issued by DVLA. Proves the registered keeper. Sale completes only when the V5 transfers to the buyer. |
| **DVLA** | Driver and Vehicle Licensing Agency. The government source for vehicle records. The app calls DVLA's free Vehicle Enquiry Service (VES) to pre-fill arrival forms. |
| **MOT** | The annual roadworthiness test required for vehicles >3 years old. The app stores the MOT expiry date returned by DVLA. |
| **VAT margin scheme** | UK tax mechanism for used cars — VAT is paid only on the **profit margin** (sale price − purchase price) rather than the full sale price. The opposite is the "VAT qualifying" / standard scheme. |
| **SIV** | Stand-In Value — the trade-buy-back price a dealer would offer if the car came back. Used as a floor for sale pricing. |
| **Stocking** | Floor-plan finance — a finance provider (e.g. Next Gear, Close Brothers, BCA Partner Finance) advances the cash for a vehicle in exchange for a daily charge until it sells. |
| **Stocking charges** | The cumulative daily cost of stocking finance — loading fee + daily charge × days held + unloading fee. |
| **Auction house** | Where many used cars are bought — BCA, Copart, Manheim, Pameer, etc. Vehicles bought here carry a "buyer's fee" on top of the hammer price. |
| **Things to Do** | Tasks attached to a specific vehicle — inspection failures, prep work, photography, paperwork. Each has an owner (internal user or external vendor), a cost, and a status. |
| **Job card** | The work order PDF given to a mechanic/vendor for a maintenance task. |
| **Test drive** | An appointment where a prospective buyer drives the vehicle. Tracked as an Appointment record. |
| **In-house warranty** | Warranty cover sold by the dealer itself, with the dealer paying claim costs. The opposite is "external" warranty (third-party underwriter). |
| **Workshop** | Internal mechanic bay where prep work happens. Maintenance jobs assigned to workshop staff vs external vendors. |
| **Return** | A sold vehicle that comes back to the dealer (refund, replacement, or finance-resolution). Rare but tracked. |

## App-internal terms

| Term | Meaning |
|---|---|
| **Stock ID** | The app's internal vehicle identifier (e.g. `CC-0042`). `CC` = Car Capital, four-digit zero-padded sequence. Monotonic counter on the `Company` row (`nextStockSeq`). Survives changes to registration or other identity fields. |
| **Service** | A function module in `src/lib/services/` that owns reads and writes for one domain entity. Always async, always returns plain objects, always caches via `src/lib/cache.ts`. |
| **Capability** | A granular permission string (e.g. `invoice:generate`, `vehicle:create`). 38 of them defined in `src/lib/capabilities.ts`. Users are granted capabilities via role bundles or direct grants. |
| **Role** | A named bundle of capabilities (e.g. `owner`, `sales`, `inspector`). Defined in `src/lib/roles.ts`. A user can hold multiple roles; the effective capability set is the union. |
| **Substrate level** | The current "depth" in the elevation system (0 = page background, 1 = top-level card, 2 = nested card, …, 8 = deep modal). Read via `useSurface()` from a React context. |
| **Surface offset** | The depth a component adds above its parent substrate. `<Card>` uses `offset={1}`; `<Elevated offset={4}>` jumps to dialog depth. |
| **Surface ladder** | The 1–8 progression of background + shadow combinations. In light mode every level is `#FFFFFF` — depth is purely shadow. |
| **Activity log** | Append-only audit table (`ActivityLogEntry`) recording every state-changing action with the actor, timestamp, vehicle (when relevant), and an `actionType` enum. |
| **Cache** | In-memory key-value cache used by every service (`src/lib/cache.ts`). Keyed by entity name + filter. Invalidated on writes. Refreshed by `useRealtimeTable` subscriptions. |
| **Realtime subscription** | A Supabase `postgres_changes` listener (`src/hooks/use-realtime-table.ts`) that invalidates the cache and re-renders consumers when rows mutate. |
| **Mock fallback** | Compatibility code that serves seeded mock data when a Supabase or external API call fails — kept so the app stays usable in offline dev. The DVLA service uses this pattern. |
| **DVLA proxy** | The Next.js API route `/api/dvla/lookup` that holds the `DVLA_API_KEY` and forwards arrival-form lookups to gov.uk. Keeps the key out of the browser. |
| **Elevated surfaces** | The fluidfunctionalism design pattern adopted in May 2026. See [`reference/design-system.md`](./reference/design-system.md). |
| **Master Sheet** | The admin spreadsheet view (`/admin/master-sheet`) that shows every vehicle in a wide, paginated table — the digital replacement for Bass Bhai's Excel file. |
| **Master Calendar** | The admin calendar view (`/admin/master-calendar`) showing every appointment, maintenance job, and event in one place. |
| **Pipeline** | Stage-based progression view. The Maintenance Pipeline shows vehicles by prep state; the Sales Pipeline shows deals by negotiation stage. |
| **Surface-2 / Surface-1 etc.** | Background utilities (`bg-surface-1` through `bg-surface-8`) plus matched shadows (`shadow-surface-1` etc.). All resolve to `#FFFFFF` in light mode; differentiation is shadow weight. |
