# Typography UAT — full-app verification

**Date:** 2026-05-31 · **Scope:** every page, view, overlay, and auth page ·
**Result:** ✅ **0 off-scale offenders across every surface audited**

This documents the user-acceptance sweep that verified the consolidated type
system is *actually rendered* correctly on every screen — not just present in the
source. The audit reads **computed** styles in the live browser, so it catches
whatever truly paints, regardless of which class or cascade produced it.

---

## The canonical type system

One crafted scale — **4 sizes + 1 locked micro, 3 weights**. Emphasis is weight
and colour, never a new size.

| Token        | Size  | Role                                                        |
| ------------ | ----- | ----------------------------------------------------------- |
| `text-2xl`   | 24px  | **Display** — page/modal `<h1>`, KPI & stat hero numbers     |
| `text-base`  | 18px  | **Title** — card / panel / dialog / section titles, key nums |
| `text-sm`    | 14px  | **Body** — prose, descriptions, table cells, nav, inputs     |
| `text-xs`    | 12px  | **Label** — eyebrows, captions, meta, table headers          |
| `text-2xs`   | 10px  | **Micro** — *locked*; glyphs in fixed sub-12px boxes only    |

**Weights:** `400` normal · `500` medium · `600` semibold. `font-bold` (700) is
permitted **only** paired with `font-mono` (reg-plates, stock IDs, mono price).
Canonical eyebrow: `text-xs font-medium uppercase tracking-wide`.

Source of truth: `src/app/globals.css` (`@theme` type tokens).

---

## Method

A computed-style auditor (`scripts/audit-typography.js`) walks every
text-bearing element on a surface, reads its rendered `font-size` / `font-weight`,
and flags anything outside `{10,12,14,18,24}px` or `{400,500,600}` weight
(mono `600`/`700` exempt). It was run via the in-browser MCP on every route and on
live overlays. A clean surface reports `OFF(0)` with only canonical sizes present.

To re-run: open any route, paste `scripts/audit-typography.js` into the DevTools
console, then call `auditTypography()` (or `auditTypography(modalEl)` for a modal).

---

## Results — all surfaces `OFF(0)`

Representative computed-size snapshots (size×count) captured during the sweep:

| Surface                        | Computed sizes (px×count)             | Offenders |
| ------------------------------ | ------------------------------------- | --------- |
| Dashboard `/`                  | 24 · 18 · 14 · 12 · 10                 | **0**     |
| `/sales/*` (pipeline, deals, appointments, invoice-generation) | 24 · 18 · 14 · 12 | **0** |
| `/maintenance/*` (board, inspection, calendar, workshop)       | 24 · 18 · 14 · 12 | **0** |
| `/admin/*` (master-sheet, master-calendar, settings, invoicing, activity, locations, vendors) | 24 · 14 · 12 · 10 | **0** |
| `/admin/vehicle-returns`       | 24×1 · 14×33 · 12×49 · 10×5            | **0**     |
| `/warranties/claims`, `/in-house` | 24 · 18 · 14 · 12                   | **0**     |
| `/warranties/external`         | 24×5 · 14×60 · 12×56 · 10×7            | **0**     |
| `/advert/*` (work-list, photo-processing, performance, listings) | 24 · 18 · 14 · 12 · 10 | **0** |
| `/inventory/add-vehicle`       | 24×1 · 18×1 · 14×117 · 12×40 · 10×2    | **0**     |
| Vehicle detail `/vehicles/[id]`| 24×5 · 18×7 · 14×70 · 12×54 · 10×9     | **0**     |
| Advert editor `/vehicles/[id]/advert` | 18×10 · 14×54 · 12×249 · 10×3   | **0**     |
| Dashboard `/dashboard` (logged-in + logged-out states) | 24×7 · 18×2 · 14 · 12 · 10 | **0** |
| **Overlay** — user dropdown menu | 14×5 · 12×1                         | **0**     |
| **Modal** — "New event" booking Sheet | title **18px/600** · 14×3      | **0**     |
| **Auth** — `/login`, `/forgot-password`, `/reset-password` | 24 brand · 14 · 12 | **0** |

The dropdown and the "New event" Sheet confirm overlays inherit the system: the
Sheet title renders at the **18px title tier / 600** exactly as designed. All
dialog/sheet/drawer/alert-dialog primitives share these migrated titles, so every
modal is correct by construction.

> **Auth pages (logged-out pass):** `/login`, `/forgot-password`, and
> `/reset-password` render the centred-card layout on-scale — 24px brand title,
> 14px labels/inputs, 12px hints — all `OFF(0)`. `/set-password` redirects to
> `/login` without an invite token; the landing page is clean.

---

## Issues found & fixed

| # | Issue                                                                 | Root cause                                                                 | Fix                                                                                       |
| - | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1 | **"A lot of screens not applied properly"** — stale CSS app-wide       | Turbopack wedged its `@theme` HMR after a large edit batch; the dev server kept serving pre-migration tokens | **Restarted the dev server** from a clean state — every migrated token then served correctly. *This was the dominant cause.* |
| 2 | Title tier too flat — card/section titles (16px) ≈ body (14px)        | `--text-base` was 16px, too close to the 14px body tier to read as a title | `--text-base` **16 → 18px** (`+ line-height 1.3 / letter-spacing -0.015em`) in `globals.css` |
| 3 | Sonner toasts rendered at **13px** (off-scale)                        | The toast library hardcodes 13px                                           | `toastOptions.style.fontSize = 0.875rem` (14px) in `src/components/ui/sonner.tsx`          |
| 4 | `<strong>` / `<b>` rendered at **700** (off the 3-weight scale)        | Browser/preflight default `font-weight: bolder` → 700                      | `strong, b { font-weight: 600 }` in `globals.css` — normalizes all emphasis to semibold    |

Files touched by the fixes:
- `src/app/globals.css` — `--text-base` 18px tuning; `strong, b → 600` rule.
- `src/components/ui/sonner.tsx` — inline 14px toast font-size.

All four fixes were verified live: title tier reads as 18px on every surface, the
toast measured 14px, and the previously-700 `<strong>` on `/warranties/external`
now computes to 600 with the page returning `OFF(0)`.

---

## How to re-run the UAT

1. Start the dev server: `pnpm dev` (a fresh start avoids stale-`@theme` HMR).
2. Open a route, paste `scripts/audit-typography.js` into the DevTools console.
3. `auditTypography()` → expect `✓ … 0 offenders`.
4. For modals/sheets: open the overlay, then
   `auditTypography(document.querySelector('[role=dialog]'))`.
