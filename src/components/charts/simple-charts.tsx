"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Dependency-free SVG charts for Reports & Analytics (GEN-24). Deliberately
 * small and BOUNDED: a fixed-height vertical BarChart with a real left Y-axis
 * (gridlines + tick labels) for magnitude-over-period + histograms, and a
 * DonutChart for a categorical breakdown with a full-width data legend.
 * Colours come from the app's brand --chart-1..5 tokens in a fixed order
 * (never cycled); marks are thin with rounded data-ends and recessive axes;
 * each mark carries a <title> for a native hover tooltip.
 */

/** Fixed categorical order — brand tokens, never cycled past 5 (fold to Other). */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** Round an axis maximum up to a clean 1/2/5 × 10ⁿ value so ticks read nicely. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Vertical bar chart — one measure over an ordered set of buckets (periods,
 * aging bands). FIXED height with a left Y-axis: gridlines + tick labels at
 * 0/25/50/75/100 %, thin rounded bars anchored to the baseline, single hue
 * (magnitude). `fmtAxis` formats the compact Y-axis ticks; `format` the hover
 * value. The SVG scales to its container width but never grows in height.
 */
export function BarChart({
  data,
  format = (v) => String(v),
  fmtAxis,
  color = "var(--chart-1)",
  height = 200,
  className,
  emptyLabel = "No data for this selection.",
}: {
  data: BarDatum[];
  format?: (v: number) => string;
  fmtAxis?: (v: number) => string;
  color?: string;
  height?: number;
  className?: string;
  emptyLabel?: string;
}): React.ReactElement {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }
  const fmtY = fmtAxis ?? format;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const W = 560;
  const H = height;
  const padL = 52; // room for Y-axis tick labels
  const padR = 8;
  const padT = 8;
  const padB = 26; // room for X labels
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const band = plotW / data.length;
  const barW = Math.min(band * 0.5, 44);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      className={className}
    >
      {/* Y-axis gridlines + tick labels */}
      {ticks.map((t) => {
        const gy = padT + plotH * (1 - t);
        return (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={gy}
              y2={gy}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={gy + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[9px] tabular-nums"
            >
              {fmtY(max * t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = padL + band * i + band / 2;
        const bh = plotH * (d.value / max);
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${format(d.value)}`}</title>
            <rect
              x={cx - barW / 2}
              y={padT + plotH - bh}
              width={barW}
              height={Math.max(bh, d.value > 0 ? 1 : 0)}
              rx={3}
              fill={color}
            />
            <text
              x={cx}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
}

/**
 * Donut for a categorical breakdown (identity). Fixed brand hues in order.
 * The donut carries the total (with a caption) in its centre; a full-width
 * legend beside it reads like a compact table — swatch · label on the left,
 * value · share right-aligned — with row dividers, so identity/values are
 * never colour alone and the card fills its height instead of huddling in a
 * corner.
 */
export function DonutChart({
  data,
  format = (v) => String(v),
  centerLabel,
  className,
}: {
  data: DonutDatum[];
  format?: (v: number) => string;
  centerLabel?: string;
  className?: string;
}): React.ReactElement {
  const total = data.reduce((a, d) => a + d.value, 0);
  const size = 148;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;

  if (total <= 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground",
          className,
        )}
        style={{ height: size }}
      >
        No data for this selection.
      </div>
    );
  }

  // Cumulative start offset (dash units) per segment — computed without
  // mutation so the render stays pure.
  const starts = data.map((_, i) =>
    data.slice(0, i).reduce((s, d) => s + (d.value / total) * c, 0),
  );
  return (
    <div
      className={cn(
        "flex h-full flex-wrap items-center justify-center gap-x-8 gap-y-5",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        className="shrink-0"
      >
        {/* track */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        {data.map((d, i) => {
          const dash = (d.value / total) * c;
          // 3px surface gap between segments so adjacent fills don't touch.
          return (
            <circle
              key={d.label}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${Math.max(dash - 3, 0)} ${c}`}
              strokeDashoffset={-starts[i]}
              transform={`rotate(-90 ${cx} ${cx})`}
            >
              <title>{`${d.label}: ${format(d.value)} (${Math.round((d.value / total) * 100)}%)`}</title>
            </circle>
          );
        })}
        <text
          x={cx}
          y={cx - 2}
          textAnchor="middle"
          className="fill-foreground text-xl font-semibold tabular-nums"
        >
          {format(total)}
        </text>
        {centerLabel && (
          <text
            x={cx}
            y={cx + 14}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] uppercase tracking-wide"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      {/* legend — swatch · label · value · share, never colour-alone */}
      <ul className="flex min-w-[200px] flex-1 flex-col text-sm">
        {data.map((d, i) => (
          <li
            key={d.label}
            className="flex items-center gap-2.5 border-b border-border/60 py-2 last:border-0"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="flex-1 truncate text-foreground">{d.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {format(d.value)}
            </span>
            <span className="w-11 text-right font-medium tabular-nums text-foreground">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
