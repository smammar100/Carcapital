"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Car,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  Inbox,
  Sparkles,
  ClipboardCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { vehicleService } from "@/lib/services/vehicle-service";
import { claimService } from "@/lib/services/claim-service";
import { leadService } from "@/lib/services/lead-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { salesService } from "@/lib/services/sales-service";
import type { Capability } from "@/lib/capabilities";
import { DashboardStatCard } from "./dashboard-stat-card";

interface Stats {
  carsInStock: number;
  carsInReadiness: number;
  soldThisMonth: number;
  openClaims: number;
  newLeads24h: number;
  avgDays: number | null;
  inspectionsPending: number;
  activeJobs: number;
}

/**
 * Each KPI declares the capabilities that make it relevant. A card shows only
 * when the user is a super-user or holds ANY of `requiredAnyOf` — so every
 * role sees a dashboard scoped to their job (Inspector sees inspection/workshop
 * numbers, Sales sees leads/sold, Finance sees financial figures, etc.).
 */
interface KpiDef {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  requiredAnyOf: Capability[];
  value: (s: Stats) => string;
  /**
   * Operational KPIs are tailored for hands-on roles (Inspector, Workshop).
   * Super-users / admins see the canonical 6-card overview instead, so these
   * are hidden from them to avoid an unbalanced 8-card row.
   */
  operational?: boolean;
}

const KPI_DEFS: KpiDef[] = [
  {
    key: "cars_in_stock",
    label: "Cars in Stock",
    icon: Car,
    href: "/vehicles",
    requiredAnyOf: [
      "inventory:add",
      "inventory:edit",
      "inspection:run",
      "maintenance:create",
      "photos:process",
      "advert:create",
      "admin:view_master_sheet",
    ],
    value: (s) => String(s.carsInStock),
  },
  {
    key: "inspections_pending",
    label: "Inspections Pending",
    icon: ClipboardCheck,
    href: "/maintenance/inspection",
    requiredAnyOf: ["inspection:run", "inspection:add_note"],
    value: (s) => String(s.inspectionsPending),
    operational: true,
  },
  {
    key: "active_jobs",
    label: "Active Workshop Jobs",
    icon: Wrench,
    href: "/maintenance/workshop",
    requiredAnyOf: [
      "maintenance:create",
      "maintenance:edit",
      "maintenance:complete",
      "workshop:add_note",
    ],
    value: (s) => String(s.activeJobs),
    operational: true,
  },
  {
    key: "cars_in_readiness",
    label: "Cars in Readiness",
    icon: CheckCircle2,
    href: "/vehicles?status=ready",
    requiredAnyOf: [
      "inventory:edit",
      "advert:create",
      "advert:edit",
      "sales:create_lead",
      "admin:view_master_sheet",
    ],
    value: (s) => String(s.carsInReadiness),
  },
  {
    key: "sold_this_month",
    label: "Sold This Month",
    icon: TrendingUp,
    href: "/sales/deals",
    requiredAnyOf: [
      "sales:mark_sold",
      "sales:edit_pipeline_stage",
      "admin:view_financials",
    ],
    value: (s) => String(s.soldThisMonth),
  },
  {
    key: "new_leads_24h",
    label: "New Leads (24h)",
    icon: Inbox,
    href: "/sales/leads",
    requiredAnyOf: ["sales:create_lead", "sales:edit_lead"],
    value: (s) => String(s.newLeads24h),
  },
  {
    key: "open_claims",
    // "Warranty Open Claims" truncated to "WARRANTY OPEN C…" in its tile at
    // desktop widths (GEN-44); the shield icon + /warranties/claims link carry
    // the warranty context, so the short label loses nothing.
    label: "Open Claims",
    icon: ShieldAlert,
    href: "/warranties/claims",
    requiredAnyOf: [
      "warranty:raise_claim",
      "warranty:resolve_claim",
      "warranty:create",
      "warranty:edit",
    ],
    value: (s) => String(s.openClaims),
  },
  {
    key: "avg_days",
    label: "Avg Days in Stock",
    icon: Sparkles,
    href: "/admin/master-sheet",
    requiredAnyOf: [
      "admin:view_financials",
      "admin:view_master_sheet",
      "inventory:edit",
    ],
    value: (s) => (s.avgDays === null ? "—" : `${s.avgDays}d`),
  },
];

export function DashboardKpiRow() {
  const { company } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const [data, setData] = useState<{
    vehicles: Awaited<ReturnType<typeof vehicleService.getAll>>;
    claims: Awaited<ReturnType<typeof claimService.getAll>>;
    leads: Awaited<ReturnType<typeof leadService.getAll>>;
    jobs: Awaited<ReturnType<typeof maintenanceService.getAll>>;
    deals: Awaited<ReturnType<typeof salesService.getAll>>;
  } | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      vehicleService.getAll(company.id),
      claimService.getAll(company.id),
      leadService.getAll(company.id),
      maintenanceService.getAll(company.id),
      salesService.getAll(company.id),
    ]).then(([vehicles, claims, leads, jobs, deals]) => {
      setData({ vehicles, claims, leads, jobs, deals });
    });
  }, [company]);

  const stats = useMemo<Stats | null>(() => {
    if (!data) return null;
    const now = Date.now();
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).getTime();
    // "In stock" = vehicles still in the live pipeline. Exclude terminal /
    // dead-end states (sold, returned) so a returned car isn't counted as
    // stock — it also skews Avg Days in Stock.
    const NON_LIVE_STATUSES = new Set(["sold", "returned"]);
    const activeVehicles = data.vehicles.filter(
      (v) => !NON_LIVE_STATUSES.has(v.status) && v.removedFromWebsiteAt === null,
    );
    const carsInStock = activeVehicles.length;
    const carsInReadiness = activeVehicles.filter(
      (v) => v.status === "ready",
    ).length;
    const inspectionsPending = activeVehicles.filter(
      (v) => v.status === "inspection_pending",
    ).length;
    const activeJobs = data.jobs.filter(
      (j) => j.status === "pending" || j.status === "in_progress",
    ).length;
    // A vehicle counts as sold this month if its date_sold says so OR a deal
    // for it completed this month (historic completions predate the write-back
    // of date_sold onto the vehicle, GEN-43). Union, deduped per vehicle.
    const soldVehicleIds = new Set<string>();
    for (const v of data.vehicles) {
      if (v.dateSold && new Date(v.dateSold).getTime() >= monthStart) {
        soldVehicleIds.add(v.id);
      }
    }
    for (const d of data.deals) {
      if (
        d.stage === "completed_sale" &&
        d.completionDate &&
        new Date(d.completionDate).getTime() >= monthStart
      ) {
        soldVehicleIds.add(d.vehicleId);
      }
    }
    const soldThisMonth = soldVehicleIds.size;
    const openClaims = data.claims.filter(
      (c) => c.status === "open" || c.status === "under_review",
    ).length;
    const newLeads24h = data.leads.filter(
      (l) => now - new Date(l.createdAt).getTime() <= 86_400_000,
    ).length;
    const withDays = activeVehicles.filter(
      (v) => typeof v.daysInStock === "number",
    );
    const avgDays =
      withDays.length === 0
        ? null
        : Math.round(
            withDays.reduce((sum, v) => sum + (v.daysInStock ?? 0), 0) /
              withDays.length,
          );
    return {
      carsInStock,
      carsInReadiness,
      soldThisMonth,
      openClaims,
      newLeads24h,
      avgDays,
      inspectionsPending,
      activeJobs,
    };
  }, [data]);

  const visibleKpis = useMemo(() => {
    // Admin-overview viewers (super-users, or anyone with the financials /
    // master-sheet view) get the canonical 6-card overview — the operational
    // KPIs (Inspections Pending, Active Workshop Jobs) are for hands-on roles,
    // so we hide them here to avoid an unbalanced 8-card row.
    const isOverviewViewer =
      isSuperUser || can("admin:view_financials") || can("admin:view_master_sheet");
    return KPI_DEFS.filter((k) => {
      if (k.operational && isOverviewViewer) return false;
      return isSuperUser || k.requiredAnyOf.some((c) => can(c));
    });
  }, [can, isSuperUser]);

  if (visibleKpis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {visibleKpis.map((k) => (
        <DashboardStatCard
          key={k.key}
          label={k.label}
          icon={k.icon}
          current={stats ? k.value(stats) : null}
          previous=""
          trendPct={null}
          href={k.href}
        />
      ))}
    </div>
  );
}
