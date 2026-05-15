# Design system

> **Audience:** developers + designers + AI agents
> **Last verified against `main` HEAD:** `86f9d91`

## Stack

- **Tailwind v4** — `@theme inline` block in `src/app/globals.css` defines tokens.
- **shadcn/ui** primitives — Radix-based, lightly customised in `src/components/ui/`.
- **fluidfunctionalism elevation system** — a React-context-driven surface ladder, adopted May 2026, sits on top of Tailwind.

## Surfaces (the elevation system)

Every surface in the app belongs to one of **8 levels**. A level encodes both a background color and a shadow stack. As cards nest, the level increases, and the shadow gets heavier — but in light mode the *background stays pure white* at every level. Depth is read entirely through shadow.

### How it works in code

| File | Role |
|---|---|
| `src/lib/surface-context.tsx` | A React context (`SurfaceProvider`, `useSurface`) tracking the current substrate level. |
| `src/lib/elevated.tsx` | The `<Elevated offset={N}>` component — reads the substrate, computes `min(substrate + offset, 8)`, renders a `<div>` with `surfaceClasses(level)`, and re-provides the new level to descendants. |
| `src/lib/surface-classes.ts` | Static lookup tables (`SURFACE_BG`, `SURFACE_SHADOW`) and the `surfaceClasses(bg, shadow?)` helper. Necessary because Tailwind v4's static scanner can't see template-literal class names. |
| `src/components/ui/card.tsx` | The shadcn `<Card>` now wraps `<Elevated offset={1}>`. Every `<Card>` automatically sits one step above its parent substrate. |
| `src/app/globals.css` | Defines `--surface-1` through `--surface-8` (all `#FFFFFF` in light mode) and `--shadow-1` through `--shadow-8` (progressively heavier). |

### Substrate ladder

| Substrate | Typical content | Card depth |
|---|---|---|
| 0 | `(dashboard)/layout.tsx` mounts `<SurfaceProvider value={0}>` over the muted page background | — |
| 1 | Top-level `<Card>` on a dashboard page | shadow-1 |
| 2 | Card nested inside a card; popovers / dropdowns | shadow-2 |
| 3 | Doubly-nested card | shadow-3 |
| 4 | Dialog / modal | shadow-4 |
| 5–8 | Reserved for unusually deep nesting (alert dialogs inside dialogs, etc.) | shadow-5..8 |

Conventional offsets: `offset={1}` for cards, `offset={2}` for popovers, `offset={4}` for dialogs.

### Why all-white in light mode

Originally the ladder ran `#FAFAFA → #FCFCFC → #FFFFFF`. The KPI tiles use `bg-card` (always `#FFFFFF`) and looked visibly brighter than the bigger Cards — distracting. Decision (15 May 2026): every surface level is `#FFFFFF` in light mode. The shadow stacks already give enough visual separation. In dark mode the ladder retains a color ramp (`#171717 → #1E1E1E → …`) because depth is harder to read on dark backgrounds via shadow alone.

### Shadow stacks (light mode)

```
--shadow-color: rgb(0 0 0 / 0.06);
--shadow-1: 0 0 0 1px var(--shadow-color);
--shadow-2: 0 0 0 1px …, 0 1px 1px -0.5px …;
--shadow-3: …, 0 3px 3px -1.5px …;
--shadow-4: …, 0 6px 6px -3px …;
--shadow-5: …, 0 12px 12px -6px …;
--shadow-6: …, 0 24px 24px -12px …;
…
```

Each level layers an additional shadow octave on top of the previous level. The first level is essentially a 1px hairline ring — replaces a Tailwind `border` for top-level cards.

## Card primitive

`src/components/ui/card.tsx` is the canonical surface for content. Its API is unchanged from shadcn — `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` — but the root now uses `<Elevated offset={1}>` instead of `border bg-card`. Side effect: nesting Cards walks the ladder for free.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Top-level card</CardTitle>
  </CardHeader>
  <CardContent>
    <Card>
      {/* Automatically renders at surface-2 / shadow-2 — no manual prop needed */}
    </Card>
  </CardContent>
</Card>
```

## Design tokens (`src/app/globals.css`)

Two `@theme inline` blocks (light mode under `:root`, dark mode under `.dark`). Token categories:

| Category | Examples |
|---|---|
| Colors | `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--accent`, `--destructive`, `--border`, `--muted`, `--ring` |
| Sidebar | `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border` |
| Charts | `--chart-1` through `--chart-5` (used by recharts) |
| Surfaces | `--surface-1` through `--surface-8`, `--shadow-color`, `--shadow-1` through `--shadow-8` |
| Radii | Tailwind extends with `rounded-4xl` (32px) for Card corners |
| Typography | `--font-sans` (Figtree), `--font-mono` (Geist Mono), `--font-heading` (Geist) |

## Shared components

Reusable across modules — in `src/components/shared/`:

| Component | Purpose |
|---|---|
| `reg-plate.tsx` | UK number plate display with the legally required yellow background |
| `status-badge.tsx` | Vehicle / deal / warranty status pill with color coding |
| `vehicle-image.tsx` | Image carousel + lightbox with placeholder for vehicles missing photos |
| `days-in-stock-chip.tsx` | Day-count badge, colour-coded by `DAYS_IN_STOCK_THRESHOLDS` (green / amber / red) |
| `big-calendar.tsx` | Full-month calendar (used by maintenance + appointments) |
| `week-calendar.tsx` | 7-day calendar grid |
| `event-preview-dialog.tsx`, `event-edit-dialog.tsx`, `add-event-sheet.tsx` | Calendar event CRUD modals |
| `empty-state.tsx` | Zero-state placeholder |
| `coming-soon.tsx` | Stub for not-yet-implemented features |

## When to introduce a new primitive

1. If the shadcn primitive exists (`Button`, `Dialog`, `Tooltip`, `Sheet`, `Input`, etc.) — use it. Don't customise unless absolutely necessary.
2. If it's a domain-specific composition (e.g. a vehicle-status row), put it in `src/components/<module>/`, not `ui/`.
3. If it's a generic primitive that doesn't exist in shadcn (e.g. `RegPlate`) — put it in `src/components/shared/`.
4. New layer in the surface ladder? Don't add one — 8 levels is plenty. If you reach for a 9th, you're probably nesting too deeply.
