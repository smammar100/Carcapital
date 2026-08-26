"use client";

import { useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { useHasVehicles } from "@/hooks/use-has-vehicles";
import { cn } from "@/lib/utils";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { DashboardWelcome } from "@/components/dashboard/dashboard-welcome";
import { DashboardKpiRow } from "@/components/dashboard/dashboard-kpi-row";
import { DashboardStockOverview } from "@/components/dashboard/dashboard-stock-overview";
import { DashboardRecentDeals } from "@/components/dashboard/dashboard-recent-deals";
import { DashboardUpcomingAppointments } from "@/components/dashboard/dashboard-upcoming-appointments";
import { DashboardRecentActivity } from "@/components/dashboard/dashboard-recent-activity";

export default function DashboardPage() {
  const { can, isSuperUser } = usePermissions();
  const hasVehicles = useHasVehicles();

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

  // The bottom row is Stock by stage / Appointments / Latest news. Its column
  // count follows how many of those three the role can actually see, so a
  // hidden widget never leaves an empty column.
  const row3 =
    Number(flags.stock) + Number(flags.calendar) + Number(flags.news);

  // Layout follows Dashboard Home.dc.html: greeting, KPI strip, the deals
  // table full width, then three equal cards. Gaps are the design's 16px.
  //
  // NOTE: the design has no "Today's updates" card, so that widget is no
  // longer mounted here. The component is kept — nothing else renders it — so
  // restoring it is a one-line change if the omission was not intended.
  if (hasVehicles === null) return null;

  // Nothing on the system yet: the KPI tiles, the deals table and the three
  // cards would all read zero, which tells a new user nothing except that the
  // product looks broken. Show them what to do instead.
  if (!hasVehicles) return <DashboardWelcome />;

  return (
    <div className="flex flex-col gap-4">
      <DashboardGreeting />

      <DashboardKpiRow />

      {flags.deals && <DashboardRecentDeals />}

      {row3 > 0 && (
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
          {flags.stock && <DashboardStockOverview />}
          {flags.calendar && <DashboardUpcomingAppointments />}
          {flags.news && <DashboardRecentActivity />}
        </div>
      )}
    </div>
  );
}
