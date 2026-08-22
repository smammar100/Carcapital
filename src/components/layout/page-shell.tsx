import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Page-level content wrapper. Every dashboard route's main content sits
 * inside one of these — the dashboard layout wraps `{children}` in
 * `<PageShell>` by default. Content fills the full available width
 * (minus the symmetric p-6 / md:p-8 padding) up to a 1400px outer cap.
 *
 * **Default cap = 1400px.** Earlier iterations used a 1152 "content"
 * cap inspired by LeafyGreen, but on the dealer's typical 1366px /
 * 1920px monitors that left a visibly empty band on each side of the
 * dashboard. Switching to 1400 makes content go effectively edge-to-
 * edge on a 1366 viewport (1366 − 260 sidebar − 64 padding ≈ 1042px
 * of content area, well below the cap) while still centring on
 * extra-wide monitors so paragraph line-lengths don't get absurd.
 *
 * **Opt-in `wide` = 1400px (same as default for now).** The prop is
 * kept so pages can declare intent ("this page needs the full width")
 * even though the visual is identical today. If we later want a
 * narrower default for forms, the wide variant stays as an escape
 * hatch and existing consumers don't change.
 */
export function PageShell({
  children,
  wide,
  className,
}: {
  children: React.ReactNode;
  /**
   * Reserved opt-in for data-heavy pages. Currently visually identical
   * to the default; declaring it documents intent and future-proofs
   * the consumer against later width changes.
   */
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      data-page-shell={wide ? "wide" : "default"}
      // Symmetric padding on all four sides — left/right gap equals the
      // top gap at every breakpoint. No max-width cap; content fills the
      // available width inside <main>.
      //
      // Flat 24px, not 24-then-32: Genaro fixes page padding at 24px, and the
      // desktop 32px left a visibly dead band between the top bar and the
      // first line of content.
      className={cn("w-full p-6", className)}
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
