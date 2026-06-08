"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Appointment, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function fmtTime(t: string): string {
  const [h, m] = t.split(":");
  const hh = Number(h);
  const period = hh >= 12 ? "pm" : "am";
  return `${hh % 12 || 12}:${m} ${period}`;
}

function fmtDay(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
  });
}

export function DashboardUpcomingAppointments() {
  const { company } = useAuth();
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      appointmentService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([a, v]) => {
      setAppts(a);
      setVehicles(v);
    });
  }, [company]);

  const upcoming = useMemo(() => {
    if (!appts) return null;
    const todayKey = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
    return appts
      .filter((a) => a.status === "upcoming" && a.date >= todayKey)
      .slice(0, 5);
  }, [appts]);

  return (
    <Card className="h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Upcoming appointments</h2>
          {upcoming && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {upcoming.length}
            </span>
          )}
        </div>
        <Link
          href="/sales/appointments"
          className="text-xs text-link underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>

      {upcoming === null ? (
        <div className="p-4">
          <Skeleton className="h-40" />
        </div>
      ) : upcoming.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No upcoming appointments.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {upcoming.map((a) => {
            const v = vehicles.find((x) => x.id === a.vehicleId);
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <div className="flex w-14 shrink-0 flex-col leading-tight">
                  <span className="text-xs font-semibold tabular-nums">
                    {fmtTime(a.time)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDay(a.date)}
                  </span>
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate font-medium">{a.customerName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {v ? `${v.registration} · ${v.make} ${v.model}` : "—"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
