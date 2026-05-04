"use client";

import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { DashboardKpiRow } from "@/components/dashboard/dashboard-kpi-row";
import { DashboardRevenueChart } from "@/components/dashboard/dashboard-revenue-chart";
import { DashboardLeadSources } from "@/components/dashboard/dashboard-lead-sources";
import { DashboardRecentDeals } from "@/components/dashboard/dashboard-recent-deals";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <DashboardGreeting />

      <DashboardKpiRow />

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <DashboardRevenueChart />
        <DashboardLeadSources />
      </div>

      <DashboardRecentDeals />
    </div>
  );
}
