"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  Wrench,
  Hammer,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { workshopService } from "@/lib/services/workshop-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatTime12 } from "@/lib/utils";
import type {
  Appointment,
  MaintenanceJob,
  Vehicle,
  WorkshopJob,
} from "@/lib/types";

type EventKind = "appointment" | "workshop" | "maintenance";

interface DayEvent {
  kind: EventKind;
  title: string;
  time: string | null;
  href: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function shiftDate(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function dayNumber(iso: string): string {
  return iso.slice(8, 10);
}

const KIND_STYLES: Record<EventKind, { dot: string; label: string; icon: typeof CalendarCheck }> = {
  appointment: { dot: "bg-sky-500", label: "Appointment", icon: CalendarCheck },
  workshop: { dot: "bg-amber-500", label: "Workshop", icon: Hammer },
  maintenance: { dot: "bg-violet-500", label: "Maintenance", icon: Wrench },
};

export function MasterCalendarPreview() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [workshop, setWorkshop] = useState<WorkshopJob[]>([]);
  const [maint, setMaint] = useState<MaintenanceJob[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!company) return;
    void (async () => {
      setLoading(true);
      const [a, w, m, v] = await Promise.all([
        appointmentService.getAll(company.id),
        workshopService.getAll(company.id),
        maintenanceService.getAll(company.id),
        vehicleService.getAll(company.id),
      ]);
      setAppts(a);
      setWorkshop(w);
      setMaint(m);
      setVehicles(v);
      setLoading(false);
    })();
  }, [company]);

  const today = todayIso();
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(today, i));

  function vehicleLabel(id: string | null | undefined): string {
    if (!id) return "";
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.make} ${v.model} (${v.registration})` : "";
  }

  function eventsForDate(date: string): DayEvent[] {
    const dayAppts = appts
      .filter((a) => a.date === date)
      .map<DayEvent>((a) => ({
        kind: "appointment",
        title: `${a.customerName} re: ${vehicleLabel(a.vehicleId)}`,
        time: a.time,
        href: `/appointments`,
      }));
    const dayWs = workshop
      .filter((j) => j.scheduledDate === date)
      .map<DayEvent>((j) => ({
        kind: "workshop",
        title: `${j.description} — ${j.customerName}`,
        time: j.scheduledTime,
        href: `/workshop`,
      }));
    const dayMaint = maint
      .filter((j) => j.dueDate === date)
      .map<DayEvent>((j) => ({
        kind: "maintenance",
        title: `${j.description} — ${vehicleLabel(j.vehicleId)}`,
        time: null,
        href: `/maintenance`,
      }));
    return [...dayAppts, ...dayWs, ...dayMaint].sort((x, y) => {
      if (x.time && y.time) return x.time.localeCompare(y.time);
      if (x.time) return -1;
      if (y.time) return 1;
      return 0;
    });
  }

  const todays = eventsForDate(today);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Master Calendar</h2>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/sales/master-calendar">
            Open Full Calendar <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
        {/* Week strip */}
        <div className="grid grid-cols-7 gap-2">
          {week.map((d) => {
            const events = eventsForDate(d);
            const counts: Partial<Record<EventKind, number>> = {};
            for (const e of events)
              counts[e.kind] = (counts[e.kind] ?? 0) + 1;
            const isToday = d === today;
            return (
              <div
                key={d}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border bg-background p-2 text-center",
                  isToday && "border-primary bg-primary/5",
                )}
              >
                <div className="text-[10px] font-medium uppercase text-muted-foreground">
                  {dayLabel(d)}
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    isToday && "text-primary",
                  )}
                >
                  {dayNumber(d)}
                </div>
                <div className="flex h-3 items-center gap-0.5">
                  {(Object.keys(KIND_STYLES) as EventKind[]).map((kind) => {
                    const n = counts[kind] ?? 0;
                    if (n === 0) return null;
                    return (
                      <span
                        key={kind}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          KIND_STYLES[kind].dot,
                        )}
                        title={`${n} ${KIND_STYLES[kind].label}${n > 1 ? "s" : ""}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Today list */}
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : todays.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Nothing scheduled today.{" "}
              <Link
                href="/sales/master-calendar"
                className="text-primary underline-offset-2 hover:underline"
              >
                Open the full calendar
              </Link>
              .
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {todays.map((e, i) => {
                const Icon = KIND_STYLES[e.kind].icon;
                return (
                  <li key={i}>
                    <Link
                      href={e.href}
                      className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-xs transition-colors hover:bg-accent/40"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          KIND_STYLES[e.kind].dot,
                        )}
                      />
                      <span className="w-12 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                        {e.time ? formatTime12(e.time) : "—"}
                      </span>
                      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{e.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
