# Service layer

> **Audience:** developers + AI agents
> **Last verified against `main` HEAD:** `86f9d91`

24 services in `src/lib/services/`. One file per domain entity. All Supabase-backed except where flagged. All follow the shape documented in [`architecture.md`](./architecture.md#service-layer-contract).

## Index

| Service file | Owns | Main methods | Data source |
|---|---|---|---|
| `vehicle-service.ts` | `Vehicle` | `getAll`, `getById`, `getByRegistration`, `getByStatus`, `create`, `update`, `changeStatus` | Supabase |
| `customer-service.ts` | `Customer` | `getAll`, `getById`, `searchCustomers`, `findOrCreate` | Supabase |
| `enquiry-service.ts` | `Enquiry` | `getAll`, `getForVehicle`, `create`, `updateStatus` | Supabase |
| `lead-service.ts` | `Lead` *(legacy)* | `getAll`, `getById`, `getByStatus`, `getRecent`, `create`, `update` | Supabase |
| `appointment-service.ts` | `Appointment` | `getAll`, `getById`, `create`, `update`, `updateStatus` | Supabase |
| `sales-service.ts` | `SalesDeal` | `getAll`, `getById`, `create`, `updateStage`, `complete` | Supabase |
| `listing-service.ts` | `Listing` | `getAll`, `getByVehicle`, `create`, `publish`, `updateStatus` | Supabase |
| `warranty-service.ts` | `Warranty` | `getAll`, `getById`, `create`, `update`, `getWithClaims` | Supabase |
| `claim-service.ts` | `WarrantyClaim` | `getAll`, `getById`, `create`, `updateStatus`, `resolve` | Supabase |
| `invoice-service.ts` | `Invoice` | `getAll`, `getByType`, `getById`, `create`, `update`, `markSent` | Supabase |
| `inspection-service.ts` | `InspectionCheck` | `getForVehicle`, `start`, `updateCheck` | Supabase |
| `inspection-note-service.ts` | `InspectionNote` | `getForVehicle`, `add` | Supabase |
| `maintenance-service.ts` | `MaintenanceJob` | `getAll`, `getById`, `create`, `update`, `complete` | Supabase |
| `maintenance-note-service.ts` | `MaintenanceJobNote` | `getForJob`, `add` | Supabase |
| `workshop-service.ts` | `WorkshopJob` | `getAll`, `getById`, `create`, `update`, `complete` | Supabase |
| `vendor-service.ts` | `Vendor` | `getAll`, `getById`, `create`, `update` | Supabase |
| `todo-service.ts` | `TodoItem` | `getForVehicle`, `create`, `updateStatus`, `complete` | Supabase |
| `return-service.ts` | `VehicleReturn` | `getAll`, `getById`, `create`, `updateStatus`, `resolve` | Supabase |
| `activity-service.ts` | `ActivityLogEntry` | `getAll`, `getForVehicle`, `log` | Supabase |
| `notification-service.ts` | `Notification` | `getForUser`, `create`, `markRead`, `markAllRead` | Supabase |
| `permission-service.ts` | `UserPermission` | `getForUser`, `grantCapability`, `revokeCapability` | Supabase |
| `team-service.ts` | `User` (team management) | `inviteUser`, `updateUserRole`, `deactivateUser` | Supabase |
| `auth-service.ts` | `User` (read/write) | `getUser`, `getAllUsers`, `updateUser` | Supabase |
| `dvla-service.ts` | `Vehicle` lookup | `lookup` | DVLA (via `/api/dvla/lookup` proxy) |

## Non-Supabase services

| Service file | Purpose |
|---|---|
| `pdf-service.ts` | Generate Invoice / Job Card / Warranty Certificate PDFs via `@react-pdf/renderer`. Helpers: `downloadBlob()`, `openBlobInNewTab()`. |
| `photo-service.ts` | Build prompts for AI image generation; calls `/api/photo/generate` |
| `photo-storage.ts` | Read / write vehicle photos in Supabase Storage |
| `_base.ts` | Shared helpers: `delay(ms)`, `newId(prefix)`, `nowIso()` |

## Calling convention

All services are imported and called directly from React components:

```typescript
import { vehicleService } from "@/lib/services/vehicle-service";

const vehicles = await vehicleService.getAll(company.id);
```

No hooks layer for most services. The exceptions live in `src/hooks/`:

| Hook | Wraps |
|---|---|
| `use-customer-search` | `customerService.searchCustomers` with debounce |
| `use-postcode-lookup` | Manual-trigger address lookup (canned data) |
| `use-realtime-table` | Supabase `postgres_changes` subscription + cache invalidation |

## Caching contract

Every read method first calls `cacheGet(key)` from `src/lib/cache.ts`. Every write method calls `cacheInvalidate(key)` after the Supabase write returns. Keys are namespaced per entity:

- `vehicles:<companyId>`
- `vehicles:by-status:<companyId>:<status>`
- `leads:<companyId>`
- etc.

The cache is reset on full page reload. `useRealtimeTable` invalidates relevant keys when Supabase notifies of a change.

## Audit logging

Services that mutate user-relevant state call `activityService.log()` to append to `ActivityLogEntry`. The action types are exported from `src/lib/types.ts` as the `ActivityActionType` union.
