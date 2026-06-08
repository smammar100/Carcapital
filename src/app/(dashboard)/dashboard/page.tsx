"use client";

import { useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { DashboardKpiRow } from "@/components/dashboard/dashboard-kpi-row";
import { DashboardStockOverview } from "@/components/dashboard/dashboard-stock-overview";
import { DashboardRecentDeals } from "@/components/dashboard/dashboard-recent-deals";
import { DashboardUpcomingAppointments } from "@/components/dashboard/dashboard-upcoming-appointments";
import { DashboardTodayUpdates } from "@/components/dashboard/dashboard-today-updates";
import { DashboardRecentActivity } from "@/components/dashboard/dashboard-recent-activity";

export default function DashboardPage() {
  const { can, isSuperUser } = usePermissions();

  // Each widget is gated to the capabilities that make it relevant, so every
  // role sees a dashboard scoped to their job. The grid spans below adapt when
  // a widget is hidden so there are no empty columns.
  const flags = useMemo(() => {
    const any = (...caps: Parameters<typeof can>[0][]) =>
      isSuperUser || caps.some((c) => can(c));
    return {
      stock: any(
        "inventory:add",
        "inventory:edit",
        "inspection:run",
        "maintenance:create",
        "advert:create",
        "advert:edit",
        "admin:view_master_sheet",
      ),
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
      news: any("admin:view_master_sheet", "admin:view_financials"),
    };
  }, [can, isSuperUser]);

  const row2 = Number(flags.stock) + Number(flags.deals);
  // Today's updates always shows — an at-a-glance personal summary for any role.
  const row3 = 1 + Number(flags.calendar) + Number(flags.news);

  return (
    <div className="flex flex-col gap-5">
      <DashboardGreeting />

      <DashboardKpiRow />

      {row2 > 0 && (
        <div
          className={cn(
            "grid items-stretch gap-3",
            row2 === 2 ? "lg:grid-cols-12" : "grid-cols-1",
          )}
        >
          {flags.stock && (
            <div className={cn(row2 === 2 && "lg:col-span-5")}>
              <DashboardStockOverview />
            </div>
          )}
          {flags.deals && (
            <div className={cn(row2 === 2 && "lg:col-span-7")}>
              <DashboardRecentDeals />
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "grid items-stretch gap-3",
          row3 === 3
            ? "lg:grid-cols-3"
            : row3 === 2
              ? "lg:grid-cols-2"
              : "grid-cols-1",
        )}
      >
        {flags.calendar && <DashboardUpcomingAppointments />}
        <DashboardTodayUpdates />
        {flags.news && <DashboardRecentActivity />}
      </div>
    </div>
  );
}
