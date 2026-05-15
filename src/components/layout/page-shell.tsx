import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Page-level content wrapper. Every dashboard route's main content sits
 * inside one of these — the dashboard layout wraps `{children}` in
 * `<PageShell>` by default, capping content at 1152px and adding the
 * per-breakpoint padding that matches the LeafyGreen grid spec (see
 * plan §G3 in `.claude/plans/`).
 *
 * **Default cap = 1152px.** This is the LeafyGreen "content" width — a
 * comfortable line-length for paragraphs, forms, and most dashboards.
 *
 * **Opt-in `wide` = 1400px.** Use for data-heavy pages — the Master
 * Sheet, wide tables, side-by-side comparison views. Render the page's
 * own `<PageShell wide>` *inside* the route's return; that inner shell
 * wins over the default one (an inner `max-w-[1400px]` placed on a
 * `mx-auto` container relaxes the parent's narrower cap because the
 * inner block is allowed to grow up to its own max).
 *
 * Padding tokens (`px-4 py-6` on mobile, `md:px-6 md:py-8` on tablet+)
 * mirror `--grid-*-margin` from globals.css.
 */
export function PageShell({
  children,
  wide,
  className,
}: {
  children: React.ReactNode;
  /** Opt into the 1400px outer cap for data-heavy pages. Default 1152px. */
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      data-page-shell={wide ? "wide" : "default"}
      className={cn(
        // Padding is symmetric on all four sides: the visual space above
        // the page title equals the space on the left and right. Each
        // breakpoint uses a single token (p-6 = 24px on mobile, md:p-8 =
        // 32px on tablet+) so designers can eyeball the layout without
        // wondering why the top gap doesn't match the side gap.
        "mx-auto w-full p-6 md:p-8",
        wide ? "max-w-[1400px]" : "max-w-[1152px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * 12-column grid primitive for pages that want to lay out their content
 * in explicit columns (forms with mixed widths, dashboards that aren't
 * just KPI tiles). Mobile-first: 4 cols on mobile → 8 on tablet → 12
 * on desktop, matching the LeafyGreen grid regime.
 *
 * Children typically span columns via Tailwind's `col-span-*` utilities:
 *
 *   <PageGrid gap={6}>
 *     <div className="col-span-4 sm:col-span-5 lg:col-span-8">…</div>
 *     <div className="col-span-4 sm:col-span-3 lg:col-span-4">…</div>
 *   </PageGrid>
 *
 * `gap` accepts a Tailwind spacing step (2 → 8px, 3 → 12px, 4 → 16px,
 * 6 → 24px, 8 → 32px) — these match the LeafyGreen gutter values.
 */
export function PageGrid({
  children,
  gap = 6,
  className,
}: {
  children: React.ReactNode;
  gap?: 2 | 3 | 4 | 6 | 8;
  className?: string;
}) {
  return (
    <div
      data-page-grid=""
      className={cn(
        "grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12",
        gap === 2 && "gap-2",
        gap === 3 && "gap-3",
        gap === 4 && "gap-4",
        gap === 6 && "gap-6",
        gap === 8 && "gap-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
