"use client";

import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { DashboardKpiRow } from "@/components/dashboard/dashboard-kpi-row";
import { DealsInProgress } from "@/components/dashboard/deals-in-progress";
import { OngoingRepairs } from "@/components/dashboard/ongoing-repairs";
import { DashboardCalendar } from "@/components/dashboard/dashboard-calendar";
import { DashboardRecentDeals } from "@/components/dashboard/dashboard-recent-deals";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <DashboardGreeting />

      <div className="min-h-[140px]">
        <DashboardKpiRow />
      </div>

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="min-h-[480px]">
          <DashboardRecentDeals />
        </div>
        <div className="min-h-[480px]">
          <DashboardCalendar />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="min-h-[280px]">
          <DealsInProgress />
        </div>
        <div className="min-h-[280px]">
          <OngoingRepairs />
        </div>
      </div>
    </div>
  );
}
