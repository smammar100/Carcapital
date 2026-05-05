"use client";

import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { DashboardKpiRow } from "@/components/dashboard/dashboard-kpi-row";
import { DealsInProgress } from "@/components/dashboard/deals-in-progress";
import { OngoingRepairs } from "@/components/dashboard/ongoing-repairs";
import { DashboardLeadSources } from "@/components/dashboard/dashboard-lead-sources";
import { DashboardRecentDeals } from "@/components/dashboard/dashboard-recent-deals";

// v4.1 §11.2 + Gap 9: 6 KPI cards, Deals in Progress (replaces Recently Listed),
// Ongoing Repairs (replaces Total Revenue).
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <DashboardGreeting />

      <DashboardKpiRow />

      <div className="grid gap-3 lg:grid-cols-2">
        <DealsInProgress />
        <OngoingRepairs />
      </div>

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <DashboardRecentDeals />
        <DashboardLeadSources />
      </div>
    </div>
  );
}
