"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Dependency-free SVG charts for Reports & Analytics (GEN-24). Deliberately
 * small: a vertical BarChart for magnitude-over-period + histograms, and a
 * DonutChart for a categorical breakdown. Colours come from the app's brand
 * --chart-1..5 tokens in a fixed order (never cycled); marks are thin with
 * rounded data-ends and recessive axes; each mark carries a <title> for a
 * native hover tooltip. Every report also ships a table, so identity/values
 * are never colour-alone.
 */

/** Fixed categorical order — brand tokens, never cycled past 5 (fold to Other). */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Vertical bar chart — one measure over an ordered set of buckets (periods,
 * aging bands). Single hue (magnitude), recessive baseline + gridlines, values
 * labelled above each bar.
 */
export function BarChart({
  data,
  format = (v) => String(v),
  color = "var(--chart-1)",
  height = 200,
  className,
  emptyLabel = "No data for this selection.",
}: {
  data: BarDatum[];
  format?: (v: number) => string;
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
  const max = Math.max(...data.map((d) => d.value), 0);
  // Layout in a fixed viewBox; the SVG scales responsively via width:100%.
  const W = Math.max(data.length * 56, 320);
  const H = height;
  const padX = 8;
  const padTop = 20; // room for value labels
  const padBottom = 22; // room for x labels
  const plotH = H - padTop - padBottom;
  const bandW = (W - padX * 2) / data.length;
  const barW = Math.min(bandW * 0.6, 40);
  const y = (v: number) => (max <= 0 ? plotH : plotH * (1 - v / max)) + padTop;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full", className)}
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* recessive gridlines at 0/50/100% */}
      {[0, 0.5, 1].map((t) => {
        const gy = padTop + plotH * t;
        return (
          <line
            key={t}
            x1={padX}
            x2={W - padX}
            y1={gy}
            y2={gy}
            className="stroke-border"
            strokeWidth={1}
          />
        );
      })}
      {data.map((d, i) => {
        const cx = padX + bandW * i + bandW / 2;
        const bh = max <= 0 ? 0 : plotH * (d.value / max);
        const by = y(d.value);
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${format(d.value)}`}</title>
            {bh > 0 && (
              <rect
                x={cx - barW / 2}
                y={by}
                width={barW}
                height={bh}
                rx={4}
                fill={color}
              />
            )}
            {/* value label */}
            <text
              x={cx}
              y={by - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {format(d.value)}
            </text>
            {/* x label */}
            <text
              x={cx}
              y={H - 7}
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
 * Donut for a categorical breakdown (identity). Fixed brand hues in order; a
 * legend with label + value + share sits beside it so identity isn't colour
 * alone. Center shows the total.
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
  const size = 180;
  const stroke = 26;
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
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
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
          const frac = d.value / total;
          const dash = frac * c;
          // 2px surface gap between segments so adjacent fills don't touch.
          return (
            <circle
              key={d.label}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(dash - 2, 0)} ${c - Math.max(dash - 2, 0)}`}
              strokeDashoffset={-starts[i]}
              transform={`rotate(-90 ${cx} ${cx})`}
            >
              <title>{`${d.label}: ${format(d.value)} (${Math.round(frac * 100)}%)`}</title>
            </circle>
          );
        })}
        <text
          x={cx}
          y={cx - 2}
          textAnchor="middle"
          className="fill-foreground text-base font-semibold tabular-nums"
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
      {/* legend — identity + value + share, never colour-alone */}
      <ul className="flex min-w-40 flex-col gap-1.5 text-xs">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="flex-1 truncate text-foreground">{d.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {format(d.value)} · {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
