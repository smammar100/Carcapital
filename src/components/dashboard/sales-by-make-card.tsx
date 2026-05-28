"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SalesDeal, Vehicle } from "@/lib/types";

type RangeKey = "week" | "month";

const RANGE_LABELS: Record<RangeKey, string> = {
  week: "Week",
  month: "Month",
};

function startOfRange(range: RangeKey): Date {
  const now = new Date();
  const d = new Date(now);
  if (range === "week") {
    d.setDate(d.getDate() - 7);
  } else {
    d.setMonth(d.getMonth() - 1);
  }
  return d;
}

interface MakeRow {
  make: string;
  count: number;
}

export function SalesByMakeCard() {
  const { company } = useAuth();
  const [range, setRange] = useState<RangeKey>("month");
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      salesService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([d, v]) => {
      setDeals(d);
      setVehicles(v);
    });
  }, [company]);

  const data: MakeRow[] = useMemo(() => {
    if (!deals) return [];
    const since = startOfRange(range);
    const counts = new Map<string, number>();
    for (const d of deals) {
      if (d.stage !== "completed_sale") continue;
      if (!d.completionDate) continue;
      if (new Date(d.completionDate) < since) continue;
      const v = vehicles.find((x) => x.id === d.vehicleId);
      if (!v) continue;
      const key = v.make.toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([make, count]) => ({ make, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [deals, vehicles, range]);

  const total = data.reduce((acc, r) => acc + r.count, 0);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Sales by Vehicle Make</h2>
        </div>
        <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => {
            const active = range === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setRange(k)}
                aria-pressed={active}
                className={cn(
                  "h-7 rounded px-2.5 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {RANGE_LABELS[k]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">
          deals closed this {range}
        </span>
      </div>

      {deals === null ? (
        <Skeleton className="h-[260px] w-full" />
      ) : data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          No completed sales in this {range} yet.
        </div>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 16, bottom: 5, left: 8 }}
            >
              <CartesianGrid
                horizontal={false}
                strokeDasharray="3 3"
                className="stroke-border"
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <YAxis
                dataKey="make"
                type="category"
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
                width={80}
              />
              <Tooltip
                cursor={{ className: "fill-muted/40" }}
                contentStyle={{
                  background: "var(--popover)",
                  borderColor: "var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                fill="var(--primary)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
