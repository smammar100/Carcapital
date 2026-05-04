"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, Car, UserPlus, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { leadService } from "@/lib/services/lead-service";
import { returnService } from "@/lib/services/return-service";
import type { Lead, SalesDeal, VehicleReturn } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { DashboardStatCard } from "./dashboard-stat-card";

interface PeriodStats {
  revenue: number;
  carsSold: number;
  newCustomers: number;
  refundsValue: number;
}

function emptyStats(): PeriodStats {
  return { revenue: 0, carsSold: 0, newCustomers: 0, refundsValue: 0 };
}

function inMonth(iso: string, year: number, month: number): boolean {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
}

function aggregate(
  year: number,
  month: number,
  deals: SalesDeal[],
  leads: Lead[],
  returns: VehicleReturn[],
): PeriodStats {
  const stats = emptyStats();
  for (const d of deals) {
    if (
      d.stage === "completed_sale" &&
      d.completionDate &&
      inMonth(d.completionDate, year, month)
    ) {
      stats.revenue += d.agreedPrice ?? 0;
      stats.carsSold += 1;
    }
  }
  for (const l of leads) {
    if (inMonth(l.createdAt, year, month)) stats.newCustomers += 1;
  }
  for (const r of returns) {
    if (inMonth(r.returnDate, year, month)) {
      stats.refundsValue += r.refundAmount ?? 0;
    }
  }
  return stats;
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) {
    if (curr === 0) return null;
    return 100;
  }
  return ((curr - prev) / prev) * 100;
}

export function DashboardKpiRow() {
  const { company } = useAuth();
  const [data, setData] = useState<{
    deals: SalesDeal[];
    leads: Lead[];
    returns: VehicleReturn[];
  } | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      salesService.getAll(company.id),
      leadService.getAll(company.id),
      returnService.getAll(company.id),
    ]).then(([deals, leads, returns]) => {
      setData({ deals, leads, returns });
    });
  }, [company]);

  const { current, previous } = useMemo(() => {
    if (!data) return { current: null, previous: null };
    const now = new Date();
    const cm = { y: now.getFullYear(), m: now.getMonth() };
    const prevDate = new Date(cm.y, cm.m - 1, 1);
    const pm = { y: prevDate.getFullYear(), m: prevDate.getMonth() };
    return {
      current: aggregate(cm.y, cm.m, data.deals, data.leads, data.returns),
      previous: aggregate(pm.y, pm.m, data.deals, data.leads, data.returns),
    };
  }, [data]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <DashboardStatCard
        label="Monthly revenue"
        icon={DollarSign}
        href="/insights"
        previous={`${
          previous ? formatCurrency(previous.revenue) : "—"
        } previous month`}
        current={current ? formatCurrency(current.revenue) : null}
        trendPct={
          current && previous ? pct(current.revenue, previous.revenue) : null
        }
      />
      <DashboardStatCard
        label="Cars sold"
        icon={Car}
        href="/sales"
        previous={`${previous?.carsSold ?? "—"} previous month`}
        current={current ? String(current.carsSold) : null}
        trendPct={
          current && previous ? pct(current.carsSold, previous.carsSold) : null
        }
      />
      <DashboardStatCard
        label="New customers"
        icon={UserPlus}
        href="/leads"
        previous={`${previous?.newCustomers ?? "—"} previous month`}
        current={current ? String(current.newCustomers) : null}
        trendPct={
          current && previous
            ? pct(current.newCustomers, previous.newCustomers)
            : null
        }
      />
      <DashboardStatCard
        label="Refunds issued"
        icon={Receipt}
        href="/admin/returns"
        previous={`${
          previous ? formatCurrency(previous.refundsValue) : "—"
        } previous month`}
        current={current ? formatCurrency(current.refundsValue) : null}
        trendPct={
          current && previous
            ? pct(current.refundsValue, previous.refundsValue)
            : null
        }
        invertTrend
      />
    </div>
  );
}
