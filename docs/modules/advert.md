# Advert

> **Sidebar group:** Advert
> **Routes owned:** 4
> **Primary entities:** `Listing`, `VehiclePhoto`, `Vehicle`

## What it is  *(stakeholder)*

Once a vehicle is prepared and ready, it needs to be advertised. The Advert module handles the path from "ready" to "live on the website". It covers a **Work List** of vehicles waiting on advert prep, **Photo Processing** for cleaning up images with AI (background removal, consistent backdrops), **Listings** for publishing to channels, and **Performance** for tracking impressions and clicks (currently a stub).

In v1 there is one publish channel: the dealer's own website. Listing to AutoTrader, eBay, and Facebook is on the roadmap.

## What users can do  *(end-user)*

- See the **Work List** of vehicles that need advert action (waiting for photos, missing description, missing price, etc.).
- **Process photos** — upload raw images, the app calls OpenAI to remove backgrounds and place vehicles on a consistent dealer backdrop.
- See all **Listings** with their status (draft / active / sold / archived).
- **Publish a draft** to the website.
- **Unpublish** a vehicle (e.g. when reserved).
- See **performance** data (stub today — pageviews and conversion are placeholder).

Permissions: `advert:create`, `advert:publish`, `advert:unpublish`, `photo:upload`, `photo:process`, `photo:delete`.

## Routes  *(developer + AI)*

| Route | Page file | Primary component | What it shows |
|---|---|---|---|
| `/advert/work-list` | `src/app/(dashboard)/advert/work-list/page.tsx` | `AdvertWorkList` | Master-detail of every listing (all statuses) — build, price, toggle channels, publish, push to AutoTrader, delete |
| `/advert/photo-processing` | `src/app/(dashboard)/advert/photo-processing/page.tsx` | `PhotoProcessing` queue | Upload + OpenAI image-gen pipeline (nav item currently hidden) |
| `/advert/performance` | `src/app/(dashboard)/advert/performance/page.tsx` | (stub) | Placeholder for view metrics |

> The standalone `/advert/listings` page was merged into the Work List (it only
> showed a read-only live subset the Work List already covers). The route now
> redirects to `/advert/work-list`.

## Components  *(developer + AI)*

Shared: `src/components/shared/vehicle-image.tsx` (carousel + lightbox), `empty-state.tsx`, `coming-soon.tsx` (used on Performance).

Module-specific advert components are sparse — most logic is inline in the page files. The Work List is a master-detail layout (searchable listing list + advert preview panel) reusing `reg-plate`, `vehicle-image`, `days-in-stock-chip`, the data-grid `AtIndicatorCell`, and the `Dialog` primitives.

## Services & data  *(developer + AI)*

| Service | Used for |
|---|---|
| `listing-service.ts` | Listing CRUD + publish state |
| `photo-storage.ts` | Read / write photo records in Supabase Storage |
| `photo-service.ts` | Build OpenAI prompts + call `/api/photo/generate` |
| `vehicle-service.ts` | Look up vehicles for the Work List |

API routes used: `/api/photo/generate` (OpenAI proxy) and `/api/photo/vehicle` (storage helper). See [`reference/api-routes.md`](../reference/api-routes.md).

Entities: `Listing`, `VehiclePhoto`.

## Workflow  *(everyone)*

```mermaid
flowchart LR
  A[Vehicle status=ready] --> B[/advert/work-list]
  B -->|Photos missing| C[/advert/photo-processing]
  C -->|Upload raw photos| D[OpenAI background-remove]
  D --> E[Save to Supabase Storage]
  E --> F[Photos linked to vehicle]
  B -->|Photos done| G[Create listing draft]
  G --> H[Work List detail panel]
  H -->|Publish| I[Listing status=active<br/>Vehicle status=listed]
  I --> J[Visible on website]
  H -->|Delete advert| K[Listing removed<br/>Vehicle status=ready]
```

## Edge cases & gotchas  *(developer)*

- **Single channel today** — `Listing.channel` defaults to `website`. Other channels are in the type union but no publish path exists for them.
- **OpenAI cost** — every photo upload triggers an OpenAI image-gen call. Batch uploads can rack up cost. Plan: add a daily quota.
- **No image cropping** — the OpenAI flow returns a square image. If the source photo is letterboxed or oddly cropped, the result inherits that. Manual touch-up not supported in v1.
- **Performance page is a stub** — `ComingSoon` placeholder. No analytics integration today.
- **Photo Processing queue is in-memory** — closing the tab loses pending uploads. Plan: persist queue state.
- **`/api/photo/generate` data URL** — returns base64 in the response. Large; do not store the data URL itself, upload to Storage and reference the URL.
