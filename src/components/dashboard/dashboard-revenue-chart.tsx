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
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import type { SalesDeal } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type Mode = "this" | "prev";

interface MonthBucket {
  label: string;
  monthIso: string;
  current: number;
  previous: number;
}

function buildMonths(today: Date, deals: SalesDeal[]): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      label: d.toLocaleString("en-GB", { month: "short" }),
      monthIso,
      current: 0,
      previous: 0,
    });
  }
  for (const deal of deals) {
    if (deal.stage !== "completed_sale" || !deal.completionDate) continue;
    if (deal.agreedPrice === null) continue;
    const completion = new Date(deal.completionDate);
    const yr = completion.getFullYear();
    const mo = completion.getMonth();
    const monthIso = `${yr}-${String(mo + 1).padStart(2, "0")}`;
    const prevYearIso = `${yr + 1}-${String(mo + 1).padStart(2, "0")}`;
    const current = buckets.find((b) => b.monthIso === monthIso);
    if (current) current.current += deal.agreedPrice;
    const previous = buckets.find((b) => b.monthIso === prevYearIso);
    if (previous) previous.previous += deal.agreedPrice;
  }
  return buckets;
}

export function DashboardRevenueChart() {
  const { company } = useAuth();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [mode, setMode] = useState<Mode>("this");

  useEffect(() => {
    if (!company) return;
    void salesService.getAll(company.id).then(setDeals);
  }, [company]);

  const buckets = useMemo(() => {
    if (!deals) return null;
    return buildMonths(new Date(), deals);
  }, [deals]);

  const total = useMemo(() => {
    if (!buckets) return 0;
    const key = mode === "this" ? "current" : "previous";
    return buckets.reduce((s, b) => s + b[key], 0);
  }, [buckets, mode]);

  return (
    <Card className="flex flex-col gap-3 p-5" size="sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-bold tracking-tight">
            {buckets ? formatCurrency(total) : <Skeleton className="h-7 w-32" />}
          </div>
          <p className="text-xs text-muted-foreground">
            Total Revenue (Last 6 Months)
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "this" ? "secondary" : "ghost"}
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setMode("this")}
          >
            <span className="size-2 rounded-full bg-foreground" />
            This Year
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "prev" ? "secondary" : "ghost"}
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setMode("prev")}
          >
            <span className="size-2 rounded-full bg-muted-foreground/60" />
            Prev Year
          </Button>
        </div>
      </div>
      {!buckets ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={buckets}
              margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `£${Math.round(v / 1000)}k` : `£${v}`
                }
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) =>
                  formatCurrency(typeof v === "number" ? v : null)
                }
              />
              <Bar
                dataKey="current"
                name="This Year"
                fill="var(--foreground)"
                radius={[4, 4, 0, 0]}
                opacity={mode === "this" ? 1 : 0.3}
              />
              <Bar
                dataKey="previous"
                name="Prev Year"
                fill="var(--muted-foreground)"
                radius={[4, 4, 0, 0]}
                opacity={mode === "prev" ? 1 : 0.4}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
