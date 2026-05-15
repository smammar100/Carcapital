# Codebase map (machine-readable)

> **Audience:** AI agents (Claude Code, Copilot, automation)
> **Format:** flat tables, sectioned by directory, one row per file
> **Last verified against `main` HEAD:** `86f9d91`

This document is structured for cold-read ingestion. If a row says "owns X", that file is the single authoritative implementation of X. If a row says "uses Y", grep elsewhere for Y to find its owner.

---

## `src/app/` — routes and layouts

### App router root

| File | Role |
|---|---|
| `src/app/layout.tsx` | Root HTML shell; loads fonts, mounts toast container |
| `src/app/globals.css` | Tailwind v4 `@theme inline` block: colors, surfaces, shadows, fonts, radii — light + dark mode |
| `src/app/page.tsx` | Root redirect (`/` → `/dashboard` or `/login` depending on auth) |
| `middleware.ts` (repo root) | Supabase session refresh on every request; public-path allow-list |

### Auth routes (`(auth)/`)

| File | Route | Role |
|---|---|---|
| `src/app/(auth)/login/page.tsx` | `/login` | Email + password sign-in |
| `src/app/(auth)/forgot-password/page.tsx` | `/forgot-password` | Trigger reset email |
| `src/app/(auth)/reset-password/page.tsx` | `/reset-password` | Set new password from reset link |

### Dashboard shell

| File | Role |
|---|---|
| `src/app/(dashboard)/layout.tsx` | Sidebar + header + main grid; mounts `<SurfaceProvider value={0}>`; redirects unauth in `useEffect` |

### Dashboard routes

| Route | File | Module |
|---|---|---|
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | Dashboard |
| `/vehicles` | `src/app/(dashboard)/vehicles/page.tsx` | Inventory |
| `/vehicles/[id]` | `src/app/(dashboard)/vehicles/[id]/page.tsx` | Inventory |
| `/inventory/add-vehicle` | `src/app/(dashboard)/inventory/add-vehicle/page.tsx` | Inventory |
| `/maintenance` | `src/app/(dashboard)/maintenance/page.tsx` | Maintenance |
| `/maintenance/calendar` | `src/app/(dashboard)/maintenance/calendar/page.tsx` | Maintenance |
| `/maintenance/inspection` | `src/app/(dashboard)/maintenance/inspection/page.tsx` | Maintenance |
| `/maintenance/workshop` | `src/app/(dashboard)/maintenance/workshop/page.tsx` | Maintenance |
| `/maintenance/jobs/[id]` | `src/app/(dashboard)/maintenance/jobs/[id]/page.tsx` | Maintenance |
| `/advert/work-list` | `src/app/(dashboard)/advert/work-list/page.tsx` | Advert |
| `/advert/photo-processing` | `src/app/(dashboard)/advert/photo-processing/page.tsx` | Advert |
| `/advert/listings` | `src/app/(dashboard)/advert/listings/page.tsx` | Advert |
| `/advert/performance` | `src/app/(dashboard)/advert/performance/page.tsx` | Advert |
| `/sales` | `src/app/(dashboard)/sales/page.tsx` | Sales |
| `/sales/leads` | `src/app/(dashboard)/sales/leads/page.tsx` | Sales |
| `/sales/appointments` | `src/app/(dashboard)/sales/appointments/page.tsx` | Sales |
| `/sales/pipeline` | `src/app/(dashboard)/sales/pipeline/page.tsx` | Sales |
| `/sales/deals` | `src/app/(dashboard)/sales/deals/page.tsx` | Sales |
| `/sales/invoice-generation` | `src/app/(dashboard)/sales/invoice-generation/page.tsx` | Sales |
| `/warranties` | `src/app/(dashboard)/warranties/page.tsx` | Warranties (root) |
| `/warranties/in-house` | `src/app/(dashboard)/warranties/in-house/page.tsx` | Warranties |
| `/warranties/external` | `src/app/(dashboard)/warranties/external/page.tsx` | Warranties |
| `/warranties/claims` | `src/app/(dashboard)/warranties/claims/page.tsx` | Warranties |
| `/admin/master-sheet` | `src/app/(dashboard)/admin/master-sheet/page.tsx` | Administrative |
| `/admin/master-calendar` | `src/app/(dashboard)/admin/master-calendar/page.tsx` | Administrative |
| `/admin/users-and-permissions` | `src/app/(dashboard)/admin/users-and-permissions/page.tsx` | Administrative |
| `/admin/vehicle-returns` | `src/app/(dashboard)/admin/vehicle-returns/page.tsx` | Administrative |
| `/admin/invoicing` | `src/app/(dashboard)/admin/invoicing/page.tsx` | Administrative |
| `/admin/vendors` | `src/app/(dashboard)/admin/vendors/page.tsx` | Administrative |
| `/admin/activity` | `src/app/(dashboard)/admin/activity/page.tsx` | Administrative |
| `/admin/settings` | `src/app/(dashboard)/admin/settings/page.tsx` | Administrative |

Dynamic detail routes: `/vehicles/[id]/inspection/page.tsx`, `/warranties/[id]/page.tsx` also exist (under their respective module trees).

### API routes (`src/app/api/`)

| File | Endpoint | Owns |
|---|---|---|
| `src/app/api/dvla/lookup/route.ts` | POST `/api/dvla/lookup` | DVLA VES proxy + 60-min LRU cache |
| `src/app/api/photo/generate/route.ts` | POST `/api/photo/generate` | OpenAI Images proxy |
| `src/app/api/photo/vehicle/route.ts` | GET / POST `/api/photo/vehicle` | Supabase Storage upload/read helper |

---

## `src/components/`

### `components/ui/` — shadcn primitives

| File | Owns |
|---|---|
| `card.tsx` | `<Card>` + sub-components — wraps `<Elevated offset={1}>` |
| `button.tsx` | `<Button>` |
| `input.tsx` | `<Input>` |
| `textarea.tsx` | `<Textarea>` |
| `select.tsx` | `<Select>` + trigger/content/item |
| `dialog.tsx` | `<Dialog>` modal |
| `sheet.tsx` | `<Sheet>` drawer (uses Radix Dialog under the hood) |
| `popover.tsx` | `<Popover>` |
| `dropdown-menu.tsx` | `<DropdownMenu>` |
| `tooltip.tsx` | `<Tooltip>` |
| `avatar.tsx` | `<Avatar>` initials + image |
| `badge.tsx` | `<Badge>` variants |
| `tabs.tsx` | `<Tabs>` + `<TabsList>` + `<TabsContent>` |
| `switch.tsx` | `<Switch>` |
| `checkbox.tsx` | `<Checkbox>` |
| `calendar.tsx` | `<Calendar>` date picker (uses react-day-picker) |
| `command.tsx` | `<Command>` palette (uses cmdk) |
| `sidebar.tsx` | Sidebar primitives used by `components/layout/app-sidebar.tsx` |
| `table.tsx` | `<Table>` + `<TableHeader>` etc. |
| `sonner.tsx` | Toast container mounting sonner |
| `breadcrumb.tsx` | `<Breadcrumb>` |
| `form.tsx` | Form helpers wrapping react-hook-form |
| `label.tsx` | `<Label>` |
| `separator.tsx` | `<Separator>` |
| `skeleton.tsx` | `<Skeleton>` loading state |
| `scroll-area.tsx` | `<ScrollArea>` |
| `collapsible.tsx` | `<Collapsible>` |
| `alert.tsx` | `<Alert>` |
| `input-group.tsx` | `<InputGroup>` (Input with prefix/suffix) |

### `components/layout/`

| File | Owns |
|---|---|
| `app-header.tsx` | Top header: breadcrumb, reg-search, notifications, profile menu |
| `app-sidebar.tsx` | Left navigation rail; collapsible |
| `sidebar-config.ts` | The canonical sidebar groups + items + `titleFromPath()` |
| `sidebar-badges.tsx` | Notification badge dots on sidebar items |

### `components/shared/`

| File | Owns |
|---|---|
| `reg-plate.tsx` | UK number plate display (yellow background) |
| `status-badge.tsx` | Vehicle / deal / warranty status pill |
| `vehicle-image.tsx` | Image carousel + lightbox |
| `days-in-stock-chip.tsx` | Day-count badge with green/amber/red bands |
| `big-calendar.tsx` | Month-view calendar (react-big-calendar) |
| `week-calendar.tsx` | 7-day grid |
| `event-preview-dialog.tsx` | Read-only event details modal |
| `event-edit-dialog.tsx` | Create/edit calendar event modal |
| `add-event-sheet.tsx` | Bottom sheet for quick event creation |
| `empty-state.tsx` | Zero-state placeholder |
| `coming-soon.tsx` | Not-yet-implemented stub |

### `components/dashboard/`

| File | Owns |
|---|---|
| `dashboard-greeting.tsx` | "Welcome back" header |
| `dashboard-kpi-row.tsx` | 6 KPI tiles grid |
| `dashboard-stat-card.tsx` | Single KPI tile |
| `dashboard-recent-deals.tsx` | Recent 7 deals table |
| `dashboard-calendar.tsx` | Today + tomorrow event card with carousel |
| `deals-in-progress.tsx` | Open deals grouped by stage |
| `ongoing-repairs.tsx` | Active maintenance jobs |
| `find-vehicle-card.tsx` | Registration search → jump |
| `dashboard-revenue-chart.tsx` | recharts revenue summary (not on primary layout) |
| `master-calendar-preview.tsx` | Compact calendar preview |
| `your-stock-card.tsx` | Stock summary card |
| `kpi-tile.tsx` | Generic KPI tile primitive |
| `action-tile.tsx` | Quick-action card |

### `components/vehicles/` + `components/vehicle-detail/`

| File | Owns |
|---|---|
| `vehicles/arrival-form.tsx` | 7-section Add Vehicle form |
| `vehicles/cost-summary-receipt.tsx` | Sticky right-side cost panel |
| `vehicles/cost-summary-panel.tsx` | Inline cost summary used elsewhere |
| `vehicles/inspection-checklist.tsx` | 20-point pass/fail toggles |
| `vehicles/things-to-do-list.tsx` | TodoItem list with status transitions |
| `vehicles/vehicle-detail-tabs.tsx` | 8-tab strip + content |
| `vehicle-detail/vehicle-detail-shell.tsx` | Tab state coordinator |
| `vehicle-detail/vehicle-header-card.tsx` | Header tile (reg plate + thumbnail + status) |
| `vehicle-detail/overview-tab.tsx` | Overview tab content |
| `vehicle-detail/financials-tab.tsx` | Financials tab content |
| `vehicle-detail/todo-tab.tsx` | Things to Do tab content |
| `vehicle-detail/inspection-tab.tsx` | Inspection tab content |
| `vehicle-detail/photos-tab.tsx` | Photos tab content |
| `vehicle-detail/listing-tab.tsx` | Listing tab content |
| `vehicle-detail/appointments-tab.tsx` | Appointments tab content |
| `vehicle-detail/activity-tab.tsx` | Activity tab content |
| `vehicle-detail/primitives.tsx` | Shared layout primitives for tab panels |

### `components/sales/` and `components/enquiries/`

| File | Owns |
|---|---|
| `enquiries/add-enquiry-dialog.tsx` | Multi-step add-enquiry dialog (top-level) |
| `enquiries/customer-search-step.tsx` | Step 1 — customer dedup search |
| `enquiries/customer-result-row.tsx` | One customer match row |
| `enquiries/create-new-customer-row.tsx` | "No match — create new" row |
| `enquiries/customer-profile-fields.tsx` | Name + phone + email + postcode inputs |
| `enquiries/postcode-lookup-field.tsx` | Postcode → address lookup (canned) |
| `enquiries/enquiry-details-fields.tsx` | Vehicle / type / source inputs |
| `enquiries/enquiry-type-dropdown.tsx` | Quick / Full / Sold-to-another |
| `enquiries/source-dropdown.tsx` | Lead source picker |
| `enquiries/salesperson-dropdown.tsx` | Assignee picker |
| `enquiries/quick-enquiry-form.tsx` | Quick single-step form |
| `enquiries/full-enquiry-form.tsx` | Full multi-step form |
| `enquiries/step-actions.tsx` | Back/Next/Save buttons |

### `components/maintenance/`, `components/admin/`, `components/warranties/`, `components/inspection/`

| File | Owns |
|---|---|
| `admin/invite-team-members-dialog.tsx` | Invite-user form |
| `admin/edit-roles-dialog.tsx` | Per-user role assignment |
| `admin/remove-member-dialog.tsx` | Deactivate user confirmation |
| `inspection/inspection-side-panel.tsx` | Inspection point side panel |
| `warranties/warranty-table.tsx` | Reusable warranty table |
| `warranties/kpi-strip.tsx` | Warranty KPI tiles |
| `warranties/filter-chips.tsx` | Status / type filter chips |
| `warranties/status-pill.tsx` | Color-coded status indicator |
| `warranties/provider-badge.tsx` | External provider badge |
| `warranties/pending-purchase-banner.tsx` | Pending-payment prompt |
| `warranties/mark-purchased-dialog.tsx` | Mark warranty paid |
| `warranties/new-warranty-dialog.tsx` | Issue new warranty |
| `warranties/new-claim-dialog.tsx` | File new claim |
| `warranties/warranty-detail-sheet.tsx` | Right-side detail drawer |

### `components/data-grid/`

| File | Owns |
|---|---|
| `data-grid.tsx` | Generic data-grid wrapper (used by Master Sheet) |
| `cells.tsx` | Cell renderers (reg-plate, status, currency, etc.) |

### `components/pdf/`

| File | Owns |
|---|---|
| `invoice-template.tsx` | Invoice PDF (sale + purchase) |
| `job-card-template.tsx` | Maintenance Job Card PDF |
| `warranty-certificate-template.tsx` | Warranty Certificate PDF |

---

## `src/lib/`

### Services (`src/lib/services/`) — see `reference/services.md` for full method index

| File | Entity / domain | Data source |
|---|---|---|
| `_base.ts` | `delay`, `newId`, `nowIso` helpers | — |
| `vehicle-service.ts` | Vehicle | Supabase |
| `customer-service.ts` | Customer | Supabase |
| `enquiry-service.ts` | Enquiry | Supabase |
| `lead-service.ts` | Lead (legacy) | Supabase |
| `appointment-service.ts` | Appointment | Supabase |
| `sales-service.ts` | SalesDeal | Supabase |
| `listing-service.ts` | Listing | Supabase |
| `warranty-service.ts` | Warranty | Supabase |
| `claim-service.ts` | WarrantyClaim | Supabase |
| `invoice-service.ts` | Invoice | Supabase |
| `inspection-service.ts` | InspectionCheck | Supabase |
| `inspection-note-service.ts` | InspectionNote | Supabase |
| `maintenance-service.ts` | MaintenanceJob | Supabase |
| `maintenance-note-service.ts` | MaintenanceJobNote | Supabase |
| `workshop-service.ts` | WorkshopJob | Supabase |
| `vendor-service.ts` | Vendor | Supabase |
| `todo-service.ts` | TodoItem | Supabase |
| `return-service.ts` | VehicleReturn | Supabase |
| `activity-service.ts` | ActivityLogEntry | Supabase |
| `notification-service.ts` | Notification | Supabase |
| `permission-service.ts` | UserPermission | Supabase |
| `team-service.ts` | User (team mgmt) | Supabase |
| `auth-service.ts` | User (read) | Supabase |
| `dvla-service.ts` | Vehicle lookup | DVLA via API route |
| `pdf-service.ts` | PDF rendering helpers | client-side |
| `photo-service.ts` | OpenAI prompt builder | calls API route |
| `photo-storage.ts` | Supabase Storage helpers | Supabase Storage |

### Supabase integration (`src/lib/supabase/`)

| File | Owns |
|---|---|
| `client.ts` | Browser Supabase client singleton + env validation |
| `server.ts` | SSR Supabase client (cookie-aware) |
| `admin.ts` | Service-role client (server-only) |
| `middleware.ts` | `updateSession()` — refresh + redirect logic |
| `database.types.ts` | Generated Postgres types |

### Other `src/lib/` files

| File | Owns |
|---|---|
| `types.ts` | All TypeScript domain types + unions (~25 entities, ~30 unions) |
| `mock-data.ts` | Seed data for dev (114 vehicles + users + customers + …) |
| `capabilities.ts` | 38 capabilities + `CAPABILITY_GROUPS` + `CAPABILITY_LABELS` |
| `roles.ts` | Role bundles → capability sets |
| `cache.ts` | In-memory key-value cache (used by every service) |
| `cache-warmup.ts` | Eager cache prefill after login |
| `vat.ts` | `calculateVat`, `formatVatLabel`, margin scheme arithmetic |
| `formatters.ts` | Currency / date / phone formatters |
| `utils.ts` | `cn`, `formatRegPlate`, `delay`, generic helpers |
| `constants.ts` | App-wide constants (`BODY_TYPES`, `DAYS_IN_STOCK_THRESHOLDS`, etc.) |
| `enquiry-constants.ts` | Lead/enquiry-specific dropdown options |
| `elevated.tsx` | `<Elevated>` component (surface ladder root) |
| `surface-context.tsx` | `SurfaceProvider` + `useSurface` |
| `surface-classes.ts` | `surfaceClasses()` lookup function |
| `toast.ts` | Sonner toast wrapper |

---

## `src/hooks/`

| File | Owns |
|---|---|
| `use-permissions.ts` | `useCan(capability)` checker |
| `use-customer-search.ts` | Debounced customer search hook |
| `use-postcode-lookup.ts` | Postcode → address lookup hook |
| `use-realtime-table.ts` | Supabase `postgres_changes` subscription + cache invalidation |
| `use-mobile.ts` (alias `use-is-mobile`) | `useIsMobile()` media query |

---

## `src/contexts/`

| File | Owns |
|---|---|
| `auth-context.tsx` | `useAuth()` — user + company + signIn/signOut |
| `sidebar-state-context.tsx` | `useSidebarState()` — collapsed/expanded |

---

## `scripts/`

| File | Purpose |
|---|---|
| `seed.ts` | Seed Supabase from `mock-data.ts` (requires `SUPABASE_SERVICE_ROLE_KEY`) |
| `migrate-seed-images.ts` | Upload seed vehicle photos to Supabase Storage |
| `csv-to-seeds.mjs` | Convert CSV → TypeScript seed entries |
| `patch-mock-data.mjs` | In-place patcher for `src/lib/mock-data.ts` |
| `seeds.generated.txt`, `seeds.stats.txt` | Tooling output (gitignored) |

---

## Top-level config

| File | Owns |
|---|---|
| `next.config.ts` | Next.js config |
| `tsconfig.json` | TypeScript config |
| `package.json` | Dependencies + scripts |
| `.env.local` (gitignored) | Local secrets (DVLA, Supabase, OpenAI) |
| `.env.local.example` | Documentation of expected env vars |
| `netlify.toml` | Netlify build + secret-scanner config |
| `.mcp.json` | MCP servers config (Supabase, Spectrum, Shadcn UI, Claude_Preview, etc.) |
| `middleware.ts` | Root middleware |

---

## Conventions an AI agent should know

1. **Every service follows the same shape** — `getAll(companyId)`, `getById(id)`, `create(input, actorUserId)`, `update(id, patch, actorUserId)`. Mutations call `activity-service.log()` and `cacheInvalidate()`.
2. **Mutations come from the client** — there are no Next.js server actions. Components import services directly and call them in event handlers.
3. **Permissions are capabilities, not roles** — always `useCan(capability)`, never `user.role === "owner"`.
4. **Surfaces are contexts** — never hard-code `bg-card` or `border` on a card. Wrap content in `<Card>` (which is `<Elevated offset={1}>`) and let the substrate context drive the level.
5. **DVLA returns null for `model`** — the field is intentionally missing from the upstream; arrival form handles it.
6. **`Activity log userId` is nullable** — null means system or vendor-portal action.
7. **Stock IDs are monotonic** — `Vehicle.stockId` comes from `Company.nextStockSeq`. Never reassign.
8. **Margin VAT formula** — `(saleNet - vehicleCost) / 6` in `src/lib/vat.ts`. Single source.
9. **Mock fallback** — DVLA service falls back to `DVLA_MOCK` when the live API is unreachable. Only DVLA does this; other services throw on failure.
10. **PDF generation is client-side** — `@react-pdf/renderer` runs in the browser. Templates in `src/components/pdf/`.
