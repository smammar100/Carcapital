"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BarChart3, Download } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { BarChart, DonutChart } from "@/components/charts/simple-charts";
import { downloadXlsx, type CellValue, type Sheet } from "@/lib/xlsx";
import { cn, formatCurrency } from "@/lib/utils";

const formatNumber = (n: number): string => n.toLocaleString("en-GB");

/** Compact GBP for KPI headlines + chart axes ("£326k", "£4.2k"). */
const gbpCompact = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1000) return `£${(n / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  return `£${Math.round(n)}`;
};

/* ----------------------------------------------------------- helpers */

const SOURCE_TYPE_LABEL: Record<string, string> = {
  private: "Private",
  trade_in: "Trade-in",
  dealer: "Dealer",
  other: "Other",
};
function sourceLabel(v: Vehicle): string {
  if (v.purchaseSource === "auction") return v.auctionHouse?.trim() || "Auction";
  return SOURCE_TYPE_LABEL[v.purchaseSource] ?? "Other";
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
type Gran = "month" | "quarter" | "year";

/** Bucket key + label for a sold date at a given granularity. */
function periodOf(dateSold: string, gran: Gran): { key: string; label: string } {
  const [y, m] = dateSold.split("-");
  const year = Number(y);
  const month = Number(m); // 1-12
  if (gran === "year") return { key: y, label: y };
  if (gran === "quarter") {
    const q = Math.floor((month - 1) / 3) + 1;
    return { key: `${y}-Q${q}`, label: `Q${q} ${y}` };
  }
  return { key: `${y}-${m}`, label: `${MONTHS_SHORT[month - 1]} ${year}` };
}

const profitOf = (v: Vehicle): number => (v.sellingPrice ?? 0) - v.baseCost;

/** Live days-in-stock for a vehicle still in stock (stored value is unreliable). */
function liveDaysInStock(v: Vehicle): number {
  const received = new Date(v.receivedDate).getTime();
  if (Number.isNaN(received)) return v.daysInStock;
  return Math.max(0, Math.floor((Date.now() - received) / 86_400_000));
}

const AGING_BANDS: { label: string; test: (d: number) => boolean }[] = [
  { label: "0–30", test: (d) => d <= 30 },
  { label: "31–60", test: (d) => d > 30 && d <= 60 },
  { label: "61–90", test: (d) => d > 60 && d <= 90 },
  { label: "91–180", test: (d) => d > 90 && d <= 180 },
  { label: "180+", test: (d) => d > 180 },
];

/** Aggregate sold vehicles into ordered periods. */
function byPeriod(sold: Vehicle[], gran: Gran) {
  const map = new Map<
    string,
    { key: string; label: string; units: number; revenue: number; cost: number; profit: number }
  >();
  for (const v of sold) {
    if (!v.dateSold) continue;
    const { key, label } = periodOf(v.dateSold, gran);
    const row = map.get(key) ?? { key, label, units: 0, revenue: 0, cost: 0, profit: 0 };
    row.units += 1;
    row.revenue += v.sellingPrice ?? 0;
    row.cost += v.baseCost;
    row.profit += profitOf(v);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

type Period = ReturnType<typeof byPeriod>[number];
type SourceRow = { label: string; units: number; revenue: number; profit: number };
type AgingRow = { label: string; value: number };
type Kpis = {
  units: number;
  revenue: number;
  profit: number;
  margin: number;
  avgPrice: number;
  avgDays: number;
  inStock: number;
};

/* ----------------------------------------------------------- export */

/**
 * One workbook, one sheet per report — a summary sheet plus the exact data
 * behind every chart on the page (profit, revenue, purchase source, stock
 * aging). Money is written as raw numbers so the file stays machine-readable;
 * period labels follow the on-screen granularity.
 */
function buildReportSheets(args: {
  today: string;
  gran: Gran;
  kpis: Kpis;
  periods: Period[];
  sources: SourceRow[];
  aging: AgingRow[];
}): Sheet[] {
  const { today, gran, kpis, periods, sources, aging } = args;
  const granLabel = gran.charAt(0).toUpperCase() + gran.slice(1);
  return [
    {
      name: "Summary",
      headerRow: true,
      colWidths: [26, 16],
      rows: [
        ["Metric", "Value"],
        ["Generated", today],
        ["Granularity", granLabel],
        ["Units sold", kpis.units],
        ["Revenue (GBP)", kpis.revenue],
        ["Profit (GBP)", kpis.profit],
        ["Margin (%)", Number(kpis.margin.toFixed(1))],
        ["Avg selling price (GBP)", Math.round(kpis.avgPrice)],
        ["Avg days in stock", kpis.avgDays],
        ["Unsold in stock", kpis.inStock],
      ],
    },
    {
      name: `Profit by ${granLabel}`,
      headerRow: true,
      colWidths: [14, 8, 12, 12, 12],
      rows: [
        ["Period", "Units", "Revenue", "Cost", "Profit"],
        ...periods.map((p): CellValue[] => [p.label, p.units, p.revenue, p.cost, p.profit]),
      ],
    },
    {
      name: `Revenue by ${granLabel}`,
      headerRow: true,
      colWidths: [14, 8, 12, 12],
      rows: [
        ["Period", "Units", "Revenue", "Avg price"],
        ...periods.map((p): CellValue[] => [
          p.label,
          p.units,
          p.revenue,
          p.units ? Math.round(p.revenue / p.units) : 0,
        ]),
      ],
    },
    {
      name: "Purchase source",
      headerRow: true,
      colWidths: [18, 8, 12, 12],
      rows: [
        ["Source", "Units", "Revenue", "Profit"],
        ...sources.map((s): CellValue[] => [s.label, s.units, s.revenue, s.profit]),
      ],
    },
    {
      name: "Days in stock",
      headerRow: true,
      colWidths: [14, 10],
      rows: [
        ["Band", "Vehicles"],
        ...aging.map((a): CellValue[] => [a.label, a.value]),
      ],
    },
  ];
}

/* ----------------------------------------------------------- page */

export default function ReportsPage() {
  const { company } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const allowed = isSuperUser || can("admin:view_financials");

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [gran, setGran] = useState<Gran>("month");

  useEffect(() => {
    if (!company || !allowed) return;
    void vehicleService.getAll(company.id).then(setVehicles);
  }, [company, allowed]);

  const sold = useMemo(
    () => (vehicles ? vehicles.filter((v) => v.dateSold != null) : null),
    [vehicles],
  );

  const inStock = useMemo(
    () =>
      vehicles
        ? vehicles.filter((v) => v.dateSold == null && v.status !== "sold")
        : [],
    [vehicles],
  );

  const periods = useMemo(
    () => (sold ? byPeriod(sold, gran) : []),
    [sold, gran],
  );

  // Purchase-source breakdown over the sold vehicles.
  const sourceBreakdown = useMemo<SourceRow[]>(() => {
    if (!sold) return [];
    const map = new Map<string, { units: number; revenue: number; profit: number }>();
    for (const v of sold) {
      const s = sourceLabel(v);
      const row = map.get(s) ?? { units: 0, revenue: 0, profit: 0 };
      row.units += 1;
      row.revenue += v.sellingPrice ?? 0;
      row.profit += profitOf(v);
      map.set(s, row);
    }
    return [...map.entries()]
      .map(([label, r]) => ({ label, ...r }))
      .sort((a, b) => b.units - a.units);
  }, [sold]);

  // Aging snapshot: vehicles still in stock, by days-in-stock band.
  const aging = useMemo<AgingRow[]>(
    () =>
      AGING_BANDS.map((b) => ({
        label: b.label,
        value: inStock.filter((v) => b.test(liveDaysInStock(v))).length,
      })),
    [inStock],
  );

  // Headline KPIs.
  const kpis = useMemo<Kpis | null>(() => {
    if (!sold) return null;
    const units = sold.length;
    const revenue = sum(sold.map((v) => v.sellingPrice ?? 0));
    const profit = sum(sold.map(profitOf));
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const avgPrice = units > 0 ? revenue / units : 0;
    const avgDays = inStock.length
      ? Math.round(sum(inStock.map(liveDaysInStock)) / inStock.length)
      : 0;
    return { units, revenue, profit, margin, avgPrice, avgDays, inStock: inStock.length };
  }, [sold, inStock]);

  const handleExport = () => {
    if (!kpis) return;
    const today = new Date().toISOString().slice(0, 10);
    const sheets = buildReportSheets({
      today,
      gran,
      kpis,
      periods,
      sources: sourceBreakdown,
      aging,
    });
    downloadXlsx(sheets, `reports-analytics-${today}.xlsx`);
  };

  if (!allowed) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Access restricted"
        description="You don't have permission to view reports."
      />
    );
  }

  const ready = vehicles != null && sold != null && kpis != null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header + primary export CTA */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Sales and stock performance at a glance. Switch the period to
            re-scale the trend charts.
          </p>
        </div>
        <Button onClick={handleExport} disabled={!ready}>
          <Download className="size-4" />
          Export report
        </Button>
      </div>

      {!ready ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="flex flex-col gap-4">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Units sold" value={formatNumber(kpis.units)} sub="All time" />
            <Kpi
              label="Revenue"
              value={gbpCompact(kpis.revenue)}
              sub={`Avg ${gbpCompact(kpis.avgPrice)}/car`}
            />
            <Kpi
              label="Profit"
              value={gbpCompact(kpis.profit)}
              sub={`${kpis.margin.toFixed(1)}% margin`}
            />
            <Kpi
              label="Avg days in stock"
              value={`${kpis.avgDays}d`}
              sub={`${formatNumber(kpis.inStock)} unsold`}
            />
          </div>

          {/* Section header — labels the charts and hosts the period toggle */}
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-semibold">Performance breakdown</h2>
              <p className="text-xs text-muted-foreground">
                Profit &amp; revenue by {gran}, with source and stock-age mix.
              </p>
            </div>
            <div
              className="inline-flex overflow-hidden rounded-md border border-border"
              role="group"
              aria-label="Period granularity"
            >
              {(["month", "quarter", "year"] as Gran[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGran(g)}
                  aria-pressed={gran === g}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    gran === g
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 2×2 chart-card grid */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ChartCard
              title={`Profit by ${gran}`}
              right={
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {formatCurrency(kpis.profit)}
                </span>
              }
            >
              <BarChart
                data={periods.map((p) => ({ label: p.label, value: p.profit }))}
                format={(v) => formatCurrency(v)}
                fmtAxis={gbpCompact}
                color="var(--chart-2)"
                emptyLabel="No sales yet."
              />
            </ChartCard>

            <ChartCard
              title={`Revenue by ${gran}`}
              right={
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {formatCurrency(kpis.revenue)}
                </span>
              }
            >
              <BarChart
                data={periods.map((p) => ({ label: p.label, value: p.revenue }))}
                format={(v) => formatCurrency(v)}
                fmtAxis={gbpCompact}
                emptyLabel="No sales yet."
              />
            </ChartCard>

            <ChartCard title="Purchase source">
              <DonutChart
                data={sourceBreakdown.map((s) => ({ label: s.label, value: s.units }))}
                format={(v) => formatNumber(v)}
                centerLabel="units sold"
              />
            </ChartCard>

            <ChartCard title="Days in stock">
              <BarChart
                data={aging}
                format={(v) => formatNumber(v)}
                color="var(--chart-4)"
                emptyLabel="No vehicles in stock."
              />
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- pieces */

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function ChartCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right}
      </div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </Card>
  );
}
