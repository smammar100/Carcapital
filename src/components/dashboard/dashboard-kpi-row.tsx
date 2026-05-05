"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Car,
  CheckCircle2,
  Inbox,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { claimService } from "@/lib/services/claim-service";
import { leadService } from "@/lib/services/lead-service";
import type { Lead, Vehicle, WarrantyClaim } from "@/lib/types";
import { DAYS_IN_STOCK_THRESHOLDS } from "@/lib/constants";
import { DashboardStatCard } from "./dashboard-stat-card";

/**
 * v4.1 §11.2 Dashboard KPI row — six cards:
 *  - Cars in Stock
 *  - Cars in Readiness
 *  - Vehicles Sold This Month
 *  - Warranty Open Claims
 *  - New Leads in 24 Hours
 *  - Avg Days in Stock (colour-coded: green<30, amber<60, red>=60)
 */
export function DashboardKpiRow() {
  const { company } = useAuth();
  const [data, setData] = useState<{
    vehicles: Vehicle[];
    claims: WarrantyClaim[];
    leads: Lead[];
  } | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      vehicleService.getAll(company.id),
      claimService.getAll(company.id),
      leadService.getAll(company.id),
    ]).then(([vehicles, claims, leads]) => {
      setData({ vehicles, claims, leads });
    });
  }, [company]);

  const stats = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const month = new Date(now).getMonth();
    const year = new Date(now).getFullYear();
    const activeVehicles = data.vehicles.filter(
      (v) => v.status !== "sold" && v.removedFromWebsiteAt === null,
    );
    const carsInStock = activeVehicles.length;
    const carsInReadiness = data.vehicles.filter(
      (v) => v.status === "ready",
    ).length;
    const soldThisMonth = data.vehicles.filter((v) => {
      if (!v.dateSold) return false;
      const d = new Date(v.dateSold);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;
    const openClaims = data.claims.filter(
      (c) => c.status === "open" || c.status === "under_review",
    ).length;
    const cutoff = now - 24 * 60 * 60 * 1000;
    const newLeads24h = data.leads.filter(
      (l) => new Date(l.createdAt).getTime() >= cutoff,
    ).length;
    const avgDays =
      activeVehicles.length === 0
        ? 0
        : Math.round(
            activeVehicles.reduce((sum, v) => sum + v.daysInStock, 0) /
              activeVehicles.length,
          );
    return {
      carsInStock,
      carsInReadiness,
      soldThisMonth,
      openClaims,
      newLeads24h,
      avgDays,
    };
  }, [data]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <DashboardStatCard
        label="Cars in Stock"
        icon={Car}
        href="/vehicles"
        previous=""
        current={stats ? String(stats.carsInStock) : null}
        trendPct={null}
      />
      <DashboardStatCard
        label="Cars in Readiness"
        icon={CheckCircle2}
        href="/vehicles?status=ready"
        previous=""
        current={stats ? String(stats.carsInReadiness) : null}
        trendPct={null}
      />
      <DashboardStatCard
        label="Sold This Month"
        icon={TrendingUp}
        href="/sales/deals"
        previous=""
        current={stats ? String(stats.soldThisMonth) : null}
        trendPct={null}
      />
      <DashboardStatCard
        label="Warranty Open Claims"
        icon={ShieldAlert}
        href="/warranties/claims"
        previous=""
        current={stats ? String(stats.openClaims) : null}
        trendPct={null}
      />
      <DashboardStatCard
        label="New Leads (24h)"
        icon={Inbox}
        href="/sales/leads"
        previous=""
        current={stats ? String(stats.newLeads24h) : null}
        trendPct={null}
      />
      <DashboardStatCard
        label="Avg Days in Stock"
        icon={Sparkles}
        href="/admin/master-sheet"
        previous={
          stats
            ? stats.avgDays < DAYS_IN_STOCK_THRESHOLDS.green
              ? "healthy"
              : stats.avgDays < DAYS_IN_STOCK_THRESHOLDS.amber
                ? "warning — slowing"
                : "high — review pricing"
            : ""
        }
        current={stats ? `${stats.avgDays}d` : null}
        trendPct={null}
      />
    </div>
  );
}
