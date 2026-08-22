"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { AddVehicleButton } from "@/components/vehicles/add-vehicle-button";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { returnService } from "@/lib/services/return-service";
import { vehicleService } from "@/lib/services/vehicle-service";

/** Vehicles excluded from "on the forecourt" — terminal states, not stock. */
const NON_LIVE_STATUSES = new Set(["sold", "returned"]);

type Stats = {
  cars: number;
  retail: number;
  prep: number;
  returns: number;
};

/**
 * Shared metrics for the two header actions, so they are the same object at
 * different weights rather than two components that happen to sit together:
 * Genaro puts both at 30px tall, 6px radius, 12px padding, 14/500, with a 6px
 * gap to a 14px leading icon.
 */
const ACTION_BTN =
  "h-[30px] sm:h-[30px] gap-1.5 rounded-md px-3 text-[14px] font-medium [&_svg]:mx-0";

/** "£512,400" — whole pounds, because the figure is a headline, not a total. */
function fmtRetail(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardGreeting() {
  const { company } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  // Rendered on the client only. The date is the user's local one, and a
  // server render would stamp the server's — a real mismatch on the day
  // boundary, not a cosmetic one.
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    // Deliberate post-mount setState, same pattern as the sidebar's persisted
    // state: the date has to come from the CLIENT's clock and timezone, and
    // computing it during render would diverge from the server's render on
    // every day boundary. Runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    );
  }, []);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      vehicleService.getAll(company.id),
      maintenanceService.getAll(company.id),
      returnService.getAll(company.id),
    ]).then(([vehicles, m, r]) => {
      const live = vehicles.filter(
        (v) =>
          !NON_LIVE_STATUSES.has(v.status) && v.removedFromWebsiteAt === null,
      );
      setStats({
        cars: live.length,
        retail: live.reduce((sum, v) => sum + (v.listingPrice ?? 0), 0),
        prep: m.filter(
          (x) => x.status === "pending" || x.status === "in_progress",
        ).length,
        returns: r.filter(
          (x) => x.status === "pending" || x.status === "in_review",
        ).length,
      });
    });
  }, [company]);

  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex max-w-[720px] flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-text">
          {/* Non-breaking placeholder pre-hydration so the sentence below
              doesn't jump a line when the date arrives. */}
          {today ?? " "}
          {company ? ` · ${company.name}` : ""}
        </span>

        {/* The two framing figures for the whole screen, in a sentence rather
            than a stat block: a number needs its subject to be judged. */}
        <h1 className="text-[27px] font-medium leading-[1.25] tracking-[-0.024em] text-pretty">
          <strong className="font-semibold">
            {stats?.cars ?? "—"} car{stats?.cars === 1 ? "" : "s"}
          </strong>{" "}
          on the forecourt,{" "}
          <strong className="font-semibold">
            {stats ? fmtRetail(stats.retail) : "—"}
          </strong>{" "}
          at retail.{" "}
          <span className="text-muted-text">
            {stats
              ? `${stats.prep} need${stats.prep === 1 ? "s" : ""} prep, ${stats.returns} return${stats.returns === 1 ? "" : "s"} ${stats.returns === 1 ? "is" : "are"} waiting on you.`
              : "Counting what needs attention."}
          </span>
        </h1>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button asChild className={ACTION_BTN} size="sm" variant="outline">
          <Link href="/admin/master-sheet">
            <Download className="size-3.5" />
            Export
          </Link>
        </Button>
        {/* asChild puts this on the same Base UI path the Export link already
            takes. Without it this renders a <nord-button>, whose height and
            radius come from Nord's shadow DOM — which is why the two stood at
            31px/6px beside a 28px/8px link.

            asChild rather than `render`: the render prop drops children (see
            resolveRender), so the label has to live inside the element. */}
        <AddVehicleButton asChild className={ACTION_BTN} size="sm">
          <button type="button">
            <Plus className="size-3.5" />
            Add Vehicle
          </button>
        </AddVehicleButton>
      </div>
    </div>
  );
}
