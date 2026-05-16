import { cn } from "@/lib/utils";

/**
 * Progress-ring status icon. The visual language is the order-status
 * reference the user supplied:
 *
 *   pending   → dashed outline circle (lifecycle not started)
 *   progress  → outline circle + a pie wedge filled clockwise from 12
 *               o'clock, proportional to `fill` (0 = empty outline,
 *               0.25 = quarter, 0.5 = half, 1 = solid disc)
 *   issue     → outline circle + an exclamation mark
 *
 * Renders in `currentColor` so it inherits the surrounding badge's
 * text colour (which is already theme-aware per status). Sized via
 * className (default `size-3.5`); the SVG is viewBox 0 0 20 20.
 */

export type StatusRingVariant = "pending" | "progress" | "issue";

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  // -90 so 0° starts at 12 o'clock and fills clockwise.
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function wedgePath(cx: number, cy: number, r: number, fill: number): string {
  const endAngle = fill * 360;
  const start = polarToCartesian(cx, cy, r, 0);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = fill > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export function StatusRing({
  variant = "progress",
  fill = 0,
  className,
}: {
  variant?: StatusRingVariant;
  /** 0–1 fill for the `progress` variant. Ignored for pending/issue. */
  fill?: number;
  className?: string;
}) {
  const cx = 10;
  const cy = 10;
  const ringR = 7.5; // outline radius
  const fillR = 6.5; // wedge / disc radius (sits inside the outline)
  const clamped = Math.max(0, Math.min(1, fill));

  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
    >
      {variant === "pending" ? (
        <circle
          cx={cx}
          cy={cy}
          r={ringR}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="2.4 2.4"
        />
      ) : variant === "issue" ? (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={ringR}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          />
          <line
            x1={cx}
            y1={6}
            x2={cx}
            y2={11}
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={14} r={0.95} fill="currentColor" />
        </>
      ) : (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={ringR}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          />
          {clamped >= 1 ? (
            <circle cx={cx} cy={cy} r={fillR} fill="currentColor" />
          ) : clamped > 0 ? (
            <path d={wedgePath(cx, cy, fillR, clamped)} fill="currentColor" />
          ) : null}
        </>
      )}
    </svg>
  );
}
