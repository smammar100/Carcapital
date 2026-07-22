"use client";

/*
 * PROTOTYPE — Reports & Analytics redesign, 5 variations side by side.
 * Auth-free, static data. Grounded in Mobbin references:
 *  - Asana reporting dashboard (KPI tiles + chart-card grid)
 *  - Amplitude (left filter rail + focused report + breakdown table)
 *  - Gumroad / Plane (bounded chart over table)
 *  - Fiverr (KPI tiles + trend chart)
 * The whole point: bounded charts with a real Y-AXIS, restrained sizing.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ sample data */

const MONTHS = [
  { label: "Jan", units: 3, revenue: 32000, profit: 4200 },
  { label: "Feb", units: 5, revenue: 61000, profit: 9800 },
  { label: "Mar", units: 4, revenue: 48000, profit: 6100 },
  { label: "Apr", units: 4, revenue: 50819, profit: 8532 },
  { label: "May", units: 6, revenue: 71850, profit: 13850 },
  { label: "Jun", units: 5, revenue: 63200, profit: 11200 },
];
const SOURCES = [
  { label: "BCA Auction", units: 9 },
  { label: "Dealer", units: 6 },
  { label: "Private", units: 4 },
  { label: "Trade-in", units: 2 },
];
const AGING = [
  { label: "0–30", value: 12 },
  { label: "31–60", value: 23 },
  { label: "61–90", value: 18 },
  { label: "91–180", value: 9 },
  { label: "180+", value: 4 },
];
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const gbp = (n: number) =>
  n >= 1000 ? `£${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `£${n}`;
const gbpFull = (n: number) => `£${n.toLocaleString("en-GB")}`;

/* ------------------------------------------------- bounded bar chart (Y axis) */

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Fixed-height bar chart with a left Y-axis, gridlines, thin rounded bars. */
function BarChart({
  data,
  color = "var(--chart-1)",
  fmtY = (v: number) => String(v),
  height = 180,
}: {
  data: { label: string; value: number }[];
  color?: string;
  fmtY?: (v: number) => string;
  height?: number;
}) {
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const W = 560;
  const H = height;
  const padL = 48;
  const padR = 8;
  const padT = 8;
  const padB = 26;
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
    >
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
            <title>{`${d.label}: ${d.value}`}</title>
            <rect
              x={cx - barW / 2}
              y={padT + plotH - bh}
              width={barW}
              height={Math.max(bh, 1)}
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

/**
 * Donut with a full-width data legend. The donut carries the total (with a
 * caption) in its centre; the legend beside it reads like a compact table —
 * swatch · label on the left, value · share right-aligned — with row dividers
 * so it fills the card height instead of huddling in a corner.
 */
function Donut({
  data,
  size = 148,
  unit = "",
}: {
  data: { label: string; value: number }[];
  size?: number;
  unit?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const starts = data.map((_, i) =>
    data.slice(0, i).reduce((s, d) => s + (d.value / total) * c, 0),
  );
  return (
    <div className="flex h-full flex-wrap items-center justify-center gap-x-8 gap-y-5">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        className="shrink-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        {data.map((d, i) => {
          const dash = (d.value / total) * c;
          return (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${Math.max(dash - 3, 0)} ${c}`}
              strokeDashoffset={-starts[i]}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          );
        })}
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          className="fill-foreground text-xl font-semibold tabular-nums"
        >
          {total}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px] uppercase tracking-wide"
        >
          {unit || "total"}
        </text>
      </svg>
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
            <span className="tabular-nums text-muted-foreground">{d.value}</span>
            <span className="w-11 text-right font-medium tabular-nums text-foreground">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------- shared bits */

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Panel({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col rounded-lg border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {right}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function FilterBarMock() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <input
        placeholder="Search reg, make/model…"
        className="h-8 min-w-40 flex-1 rounded-md border border-border bg-background px-2.5 text-xs outline-none"
      />
      <select className="h-8 rounded-md border border-border bg-background px-2 text-xs">
        <option>Sold: This year</option>
      </select>
      <select className="h-8 rounded-md border border-border bg-background px-2 text-xs">
        <option>All sources</option>
      </select>
      <div className="ml-auto inline-flex overflow-hidden rounded-md border border-border text-xs">
        <Chip active>Month</Chip>
        <Chip>Quarter</Chip>
        <Chip>Year</Chip>
      </div>
    </div>
  );
}

function MiniTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          {head.map((h, i) => (
            <th key={h} className={cn("py-1.5 pr-3 font-medium", i > 0 && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-border/60 last:border-0">
            {r.map((c, ci) => (
              <td
                key={ci}
                className={cn(
                  "py-1.5 pr-3 tabular-nums",
                  ci > 0 && "text-right",
                  ci === 0 && "font-medium text-foreground",
                )}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const REPORT_TABS = ["Profitability", "Sales & revenue", "Purchase source", "Stock aging"];

function TabRow({ active = 0 }: { active?: number }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-xs">
      {REPORT_TABS.map((t, i) => (
        <span
          key={t}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium",
            i === active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/* ================================================================= variations */

/** A — KPI tiles + 2×2 chart-card grid (Asana reporting). */
function VariationA() {
  return (
    <div className="flex flex-col gap-4">
      <FilterBarMock />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Units sold" value="27" sub="This year" />
        <Kpi label="Revenue" value="£326k" sub="+12% vs last yr" />
        <Kpi label="Profit" value="£53.7k" sub="16.5% margin" />
        <Kpi label="Avg days in stock" value="66d" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Profit by month" right={<span className="text-xs text-muted-foreground">£53.7k</span>}>
          <BarChart data={MONTHS.map((m) => ({ label: m.label, value: m.profit }))} color="var(--chart-2)" fmtY={gbp} />
        </Panel>
        <Panel title="Revenue by month">
          <BarChart data={MONTHS.map((m) => ({ label: m.label, value: m.revenue }))} fmtY={gbp} />
        </Panel>
        <Panel title="Purchase source">
          <Donut data={SOURCES.map((s) => ({ label: s.label, value: s.units }))} unit="vehicles" />
        </Panel>
        <Panel title="Days in stock">
          <BarChart data={AGING} color="var(--chart-4)" />
        </Panel>
      </div>
    </div>
  );
}

/** B — Left filter rail + one focused report + breakdown table (Amplitude). */
function VariationB() {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4">
      <aside className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</div>
        <label className="flex flex-col gap-1 text-xs">Report
          <select className="h-8 rounded-md border border-border bg-background px-2"><option>Profitability</option></select>
        </label>
        <label className="flex flex-col gap-1 text-xs">Period
          <select className="h-8 rounded-md border border-border bg-background px-2"><option>This year</option></select>
        </label>
        <label className="flex flex-col gap-1 text-xs">Granularity
          <select className="h-8 rounded-md border border-border bg-background px-2"><option>Month</option></select>
        </label>
        <label className="flex flex-col gap-1 text-xs">Source
          <select className="h-8 rounded-md border border-border bg-background px-2"><option>All sources</option></select>
        </label>
      </aside>
      <div className="flex flex-col gap-4">
        <Panel title="Profit by month" right={<span className="text-lg font-semibold tabular-nums">£53.7k</span>}>
          <BarChart data={MONTHS.map((m) => ({ label: m.label, value: m.profit }))} color="var(--chart-2)" fmtY={gbp} height={220} />
        </Panel>
        <Panel title="Breakdown">
          <MiniTable
            head={["Period", "Units", "Revenue", "Cost", "Profit"]}
            rows={MONTHS.map((m) => [m.label, m.units, gbpFull(m.revenue), gbpFull(m.revenue - m.profit), gbpFull(m.profit)])}
          />
        </Panel>
      </div>
    </div>
  );
}

/** C — Clean tabbed, bounded chart over table (Gumroad / Plane). */
function VariationC() {
  return (
    <div className="flex flex-col gap-4">
      <FilterBarMock />
      <TabRow active={0} />
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Profit by month</h3>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">Total £53.7k</span>
        </div>
        <BarChart data={MONTHS.map((m) => ({ label: m.label, value: m.profit }))} color="var(--chart-2)" fmtY={gbp} height={200} />
        <div className="mt-4">
          <MiniTable
            head={["Period", "Units", "Revenue", "Cost", "Profit"]}
            rows={MONTHS.map((m) => [m.label, m.units, gbpFull(m.revenue), gbpFull(m.revenue - m.profit), gbpFull(m.profit)])}
          />
        </div>
      </div>
    </div>
  );
}

/** D — Overview scroll: KPI header + report cards split chart-left / table-right. */
function VariationD() {
  return (
    <div className="flex flex-col gap-4">
      <FilterBarMock />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Units sold" value="27" />
        <Kpi label="Revenue" value="£326k" />
        <Kpi label="Profit" value="£53.7k" />
        <Kpi label="Avg days in stock" value="66d" />
      </div>
      <Panel title="Profitability">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          <BarChart data={MONTHS.map((m) => ({ label: m.label, value: m.profit }))} color="var(--chart-2)" fmtY={gbp} />
          <MiniTable head={["Period", "Units", "Profit"]} rows={MONTHS.map((m) => [m.label, m.units, gbpFull(m.profit)])} />
        </div>
      </Panel>
      <Panel title="Purchase source">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Donut data={SOURCES.map((s) => ({ label: s.label, value: s.units }))} size={150} />
          <MiniTable head={["Source", "Units"]} rows={SOURCES.map((s) => [s.label, s.units])} />
        </div>
      </Panel>
    </div>
  );
}

/** E — Bento grid: hero trend + smaller stat/donut cards. */
function VariationE() {
  return (
    <div className="flex flex-col gap-4">
      <FilterBarMock />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="Revenue by month" className="lg:col-span-2 lg:row-span-2">
          <BarChart data={MONTHS.map((m) => ({ label: m.label, value: m.revenue }))} fmtY={gbp} height={220} />
        </Panel>
        <Kpi label="Total profit" value="£53.7k" sub="16.5% margin" />
        <Kpi label="Best month" value="May" sub="£13.9k profit" />
        <Panel title="Source split">
          <Donut data={SOURCES.map((s) => ({ label: s.label, value: s.units }))} size={110} />
        </Panel>
        <Panel title="Stock aging" className="lg:col-span-2">
          <BarChart data={AGING} color="var(--chart-4)" height={150} />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

const VARIATIONS: { key: string; name: string; note: string; el: React.ReactNode }[] = [
  { key: "A", name: "KPI tiles + chart-card grid", note: "Asana reporting", el: <VariationA /> },
  { key: "B", name: "Left filter rail + focused report", note: "Amplitude", el: <VariationB /> },
  { key: "C", name: "Tabbed, chart over table", note: "Gumroad / Plane", el: <VariationC /> },
  { key: "D", name: "Overview: KPIs + split cards", note: "chart-left / table-right", el: <VariationD /> },
  { key: "E", name: "Bento grid", note: "hero trend + stat cards", el: <VariationE /> },
];

export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reports &amp; Analytics: 5 variations
          </h1>
          <p className="text-sm text-muted-foreground">
            Bounded charts with a real Y-axis, restrained sizing. Pick A–E.
          </p>
        </header>
        {VARIATIONS.map((v) => (
          <section key={v.key} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2 border-b border-border pb-2">
              <span className="text-sm font-semibold">Variation {v.key}</span>
              <span className="text-sm text-foreground">· {v.name}</span>
              <span className="text-xs text-muted-foreground">({v.note})</span>
            </div>
            {v.el}
          </section>
        ))}
      </div>
    </div>
  );
}
