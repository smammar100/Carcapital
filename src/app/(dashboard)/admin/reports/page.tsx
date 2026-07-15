"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FilterBar,
  matchesFilterState,
  useFilterState,
  type SelectFilter,
} from "@/components/filters/filter-bar";
import { BarChart, DonutChart } from "@/components/charts/simple-charts";
import { cn, formatCurrency } from "@/lib/utils";

const formatNumber = (n: number): string => n.toLocaleString("en-GB");

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

const profitOf = (v: Vehicle): number =>
  (v.sellingPrice ?? 0) - v.baseCost;

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

/* ----------------------------------------------------------- page */

const REPORTS = [
  { value: "profit", label: "Profitability" },
  { value: "sales", label: "Sales & revenue" },
  { value: "source", label: "Purchase source" },
  { value: "aging", label: "Stock aging" },
] as const;

export default function ReportsPage() {
  const { company } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const allowed = isSuperUser || can("admin:view_financials");

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const { state: filters, setState: setFilters } = useFilterState();
  const [gran, setGran] = useState<Gran>("month");

  useEffect(() => {
    if (!company || !allowed) return;
    void vehicleService.getAll(company.id).then(setVehicles);
  }, [company, allowed]);

  // Source options derived from the data (schema-driven; BCA appears if present).
  const sourceFilters: SelectFilter[] = useMemo(() => {
    if (!vehicles) return [];
    const labels = new Set(vehicles.map(sourceLabel));
    return labels.size
      ? [
          {
            key: "source",
            label: "Source",
            allLabel: "All sources",
            options: [...labels].sort().map((l) => ({ value: l, label: l })),
          },
        ]
      : [];
  }, [vehicles]);

  const sourceMatch = (v: Vehicle) =>
    matchesFilterState(v, filters, {
      searchText: () =>
        [v.registration, v.make, v.model, v.stockId].filter(Boolean).join(" "),
      selectValue: (_r, key) => (key === "source" ? sourceLabel(v) : null),
    });

  // Sold vehicles matching the filters (date range applies to the sold date).
  const soldFiltered = useMemo(() => {
    if (!vehicles) return null;
    return vehicles.filter(
      (v) =>
        v.dateSold != null &&
        matchesFilterState(v, filters, {
          searchText: () =>
            [v.registration, v.make, v.model, v.stockId, sourceLabel(v)]
              .filter(Boolean)
              .join(" "),
          date: () => v.dateSold,
          selectValue: (_r, key) => (key === "source" ? sourceLabel(v) : null),
        }),
    );
  }, [vehicles, filters]);

  const periods = useMemo(
    () => (soldFiltered ? byPeriod(soldFiltered, gran) : []),
    [soldFiltered, gran],
  );

  // Purchase-source breakdown over the filtered sold vehicles.
  const sourceBreakdown = useMemo(() => {
    if (!soldFiltered) return [];
    const map = new Map<string, { units: number; revenue: number; profit: number }>();
    for (const v of soldFiltered) {
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
  }, [soldFiltered]);

  // Aging snapshot: vehicles still in stock (not sold), by days-in-stock band.
  const aging = useMemo(() => {
    if (!vehicles) return [];
    const inStock = vehicles.filter(
      (v) => v.dateSold == null && v.status !== "sold" && sourceMatch(v),
    );
    return AGING_BANDS.map((b) => ({
      label: b.label,
      value: inStock.filter((v) => b.test(liveDaysInStock(v))).length,
    }));
    // sourceMatch depends on filters; vehicles + filters are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, filters]);

  if (!allowed) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Access restricted"
        description="You don't have permission to view reports."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Reports &amp; Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Filter-based reporting over your sales and stock. Pick a date range and
          source, then switch reports.
        </p>
      </div>

      <FilterBar
        state={filters}
        onChange={setFilters}
        searchPlaceholder="Search reg, make/model…"
        dateLabel="Sold"
        selects={sourceFilters}
      />

      {!vehicles || !soldFiltered ? (
        <Skeleton className="h-96" />
      ) : (
        <Tabs defaultValue="profit" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              {REPORTS.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {/* period granularity — only meaningful for the period reports */}
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {(["month", "quarter", "year"] as Gran[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGran(g)}
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

          {/* 1 — Profitability by period */}
          <TabsContent value="profit">
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="text-sm font-semibold">Profit by {gran}</h2>
              <BarChart
                data={periods.map((p) => ({ label: p.label, value: p.profit }))}
                format={(v) => formatCurrency(v)}
                color="var(--chart-2)"
              />
              <ReportTable
                head={["Period", "Units", "Revenue", "Cost", "Profit"]}
                rows={periods.map((p) => [
                  p.label,
                  formatNumber(p.units),
                  formatCurrency(p.revenue),
                  formatCurrency(p.cost),
                  formatCurrency(p.profit),
                ])}
                total={[
                  "Total",
                  formatNumber(sum(periods.map((p) => p.units))),
                  formatCurrency(sum(periods.map((p) => p.revenue))),
                  formatCurrency(sum(periods.map((p) => p.cost))),
                  formatCurrency(sum(periods.map((p) => p.profit))),
                ]}
              />
            </Card>
          </TabsContent>

          {/* 2 — Sales volume & revenue */}
          <TabsContent value="sales">
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="text-sm font-semibold">Revenue by {gran}</h2>
              <BarChart
                data={periods.map((p) => ({ label: p.label, value: p.revenue }))}
                format={(v) => formatCurrency(v)}
              />
              <ReportTable
                head={["Period", "Units sold", "Revenue", "Avg price"]}
                rows={periods.map((p) => [
                  p.label,
                  formatNumber(p.units),
                  formatCurrency(p.revenue),
                  formatCurrency(p.units ? Math.round(p.revenue / p.units) : 0),
                ])}
                total={[
                  "Total",
                  formatNumber(sum(periods.map((p) => p.units))),
                  formatCurrency(sum(periods.map((p) => p.revenue))),
                  "",
                ]}
              />
            </Card>
          </TabsContent>

          {/* 3 — Purchase-source breakdown */}
          <TabsContent value="source">
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="text-sm font-semibold">
                Purchase source (units sold)
              </h2>
              <DonutChart
                data={sourceBreakdown.map((s) => ({
                  label: s.label,
                  value: s.units,
                }))}
                format={(v) => formatNumber(v)}
                centerLabel="units"
              />
              <ReportTable
                head={["Source", "Units", "Revenue", "Profit"]}
                rows={sourceBreakdown.map((s) => [
                  s.label,
                  formatNumber(s.units),
                  formatCurrency(s.revenue),
                  formatCurrency(s.profit),
                ])}
                total={[
                  "Total",
                  formatNumber(sum(sourceBreakdown.map((s) => s.units))),
                  formatCurrency(sum(sourceBreakdown.map((s) => s.revenue))),
                  formatCurrency(sum(sourceBreakdown.map((s) => s.profit))),
                ]}
              />
            </Card>
          </TabsContent>

          {/* 4 — Stock aging snapshot */}
          <TabsContent value="aging">
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="text-sm font-semibold">
                Days in stock — current unsold inventory
              </h2>
              <BarChart
                data={aging}
                format={(v) => formatNumber(v)}
                color="var(--chart-4)"
                emptyLabel="No vehicles in stock for this selection."
              />
              <ReportTable
                head={["Days in stock", "Vehicles"]}
                rows={aging.map((b) => [b.label, formatNumber(b.value)])}
                total={["Total", formatNumber(sum(aging.map((b) => b.value)))]}
              />
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** Compact supporting table shared by every report (the accessible data view). */
function ReportTable({
  head,
  rows,
  total,
}: {
  head: string[];
  rows: (string | number)[][];
  total?: (string | number)[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {head.map((h, i) => (
              <th
                key={h}
                className={cn("py-2 pr-3 font-medium", i > 0 && "text-right")}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={head.length}
                className="py-4 text-center text-muted-foreground"
              >
                No data for this selection.
              </td>
            </tr>
          ) : (
            rows.map((r, ri) => (
              <tr key={ri} className="border-b border-border/60 last:border-0">
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      "py-2 pr-3 tabular-nums",
                      ci > 0 && "text-right",
                      ci === 0 && "font-medium text-foreground",
                    )}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {total && rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-border font-semibold">
              {total.map((c, ci) => (
                <td
                  key={ci}
                  className={cn("py-2 pr-3 tabular-nums", ci > 0 && "text-right")}
                >
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
