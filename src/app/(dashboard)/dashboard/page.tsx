"use client";

import { useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { DashboardKpiRow } from "@/components/dashboard/dashboard-kpi-row";
import { DashboardRecentDeals } from "@/components/dashboard/dashboard-recent-deals";
import { DashboardCalendar } from "@/components/dashboard/dashboard-calendar";
import { DealsInProgress } from "@/components/dashboard/deals-in-progress";
import { OngoingRepairs } from "@/components/dashboard/ongoing-repairs";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { can, isSuperUser } = usePermissions();

  const flags = useMemo(() => {
    const any = (...caps: Parameters<typeof can>[0][]) =>
      isSuperUser || caps.some((c) => can(c));
    return {
      deals: any(
        "sales:create_lead",
        "sales:edit_lead",
        "sales:edit_pipeline_stage",
        "sales:mark_sold",
        "admin:view_financials",
      ),
      calendar: any(
        "admin:view_master_calendar",
        "sales:book_appointment",
        "sales:edit_appointment",
        "maintenance:create",
        "maintenance:edit",
        "inspection:run",
      ),
      pipeline: any("sales:edit_pipeline_stage", "sales:mark_sold"),
      repairs: any(
        "maintenance:create",
        "maintenance:edit",
        "maintenance:complete",
        "workshop:add_note",
        "inspection:run",
      ),
    };
  }, [can, isSuperUser]);

  const row1Count = Number(flags.deals) + Number(flags.calendar);
  const row2Count = Number(flags.pipeline) + Number(flags.repairs);

  return (
    <div className="flex flex-col gap-4">
      <DashboardGreeting />

      <div className="min-h-[140px]">
        <DashboardKpiRow />
      </div>

      {row1Count > 0 && (
        <div
          className={cn(
            "grid gap-3",
            row1Count === 2 && flags.deals && flags.calendar
              ? "lg:grid-cols-[2fr_1fr]"
              : "grid-cols-1",
          )}
        >
          {flags.deals && <DashboardRecentDeals />}
          {flags.calendar && <DashboardCalendar />}
        </div>
      )}

      {row2Count > 0 && (
        <div className={cn("grid gap-3", row2Count === 2 ? "lg:grid-cols-2" : "grid-cols-1")}>
          {flags.pipeline && <DealsInProgress />}
          {flags.repairs && <OngoingRepairs />}
        </div>
      )}
    </div>
  );
}
