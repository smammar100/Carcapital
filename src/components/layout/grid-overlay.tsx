"use client";

import { useSearchParams } from "next/navigation";

/**
 * Dev-only grid overlay. Gated on `?grid=1` in the URL — so it never
 * shows for end users (they don't type that), and any developer or
 * designer can flip it on / off without touching code.
 *
 * Draws 12 translucent column tracks separated by 24px gutters, plus
 * a 4px baseline rhythm. `pointer-events-none` ensures the overlay
 * never intercepts clicks — every interactive element underneath
 * stays clickable while the overlay is up.
 *
 * Sits inside `<main>` in the dashboard layout so it tracks the
 * scroll position naturally. Aligned to the 1152px content cap so
 * what you see is exactly what `<PageShell>` is laying out.
 *
 * See plan §G4 (path: `.claude/plans/`) for the spec.
 */
export function GridOverlay() {
  const params = useSearchParams();
  if (params.get("grid") !== "1") return null;

  const columnTracks = `
    repeating-linear-gradient(
      to right,
      rgba(59, 130, 246, 0.08) 0 calc((1152px - 11 * 24px) / 12),
      transparent calc((1152px - 11 * 24px) / 12) calc(((1152px - 11 * 24px) / 12) + 24px)
    )
  `.trim();

  const baselineRhythm = `
    repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.04) 0 1px,
      transparent 1px 4px
    )
  `.trim();

  return (
    <div
      aria-hidden="true"
      data-grid-overlay=""
      className="pointer-events-none fixed inset-0 z-50 mx-auto w-full max-w-[1152px] px-6"
      style={{
        backgroundImage: `${columnTracks}, ${baselineRhythm}`,
      }}
    />
  );
}
