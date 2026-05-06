"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { MaintenanceJob, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CalendarFilterChip,
  CalendarToolbar,
  type CalendarTone,
  type CalendarViewMode,
  type WeekCalendarEvent,
} from "@/components/shared/week-calendar";

const STATUS_TONE: Record<string, CalendarTone> = {
  pending: "amber",
  in_progress: "blue",
  completed: "emerald",
  stalled: "rose",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-[#f59e0b]",
  in_progress: "bg-[#0ea5e9]",
  completed: "bg-[#10b981]",
  stalled: "bg-[#f43f5e]",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  stalled: "Stalled",
};

export default function MaintenanceCalendarPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<MaintenanceJob[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [view, setView] = useState<CalendarViewMode>("weekly");
  const [filters, setFilters] = useState<Record<string, boolean>>({
    pending: true,
    in_progress: true,
    completed: true,
    stalled: true,
  });
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      maintenanceService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([j, v]) => {
      setJobs(j);
      setVehicles(v);
    });
  }, [company]);

  const events: WeekCalendarEvent[] = useMemo(() => {
    if (!jobs) return [];
    return jobs
      .filter((j) => j.dueDate && filters[j.status])
      .map((j) => {
        const v = vehicles.find((x) => x.id === j.vehicleId);
        const start = new Date(`${j.dueDate}T09:00:00`);
        const end = new Date(start);
        end.setHours(end.getHours() + (j.estimatedDurationHours ?? 2));
        return {
          id: j.id,
          title: j.description,
          start,
          end,
          tone: STATUS_TONE[j.status] ?? "slate",
          meta: v?.registration,
          icon: "⚙️",
          href: v ? `/vehicles/${v.id}` : undefined,
        } satisfies WeekCalendarEvent;
      });
  }, [jobs, vehicles, filters]);

  const handleSelectEvent = (e: WeekCalendarEvent) => {
    if (e.href) router.push(e.href);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold tracking-tight">
            Maintenance Calendar
          </h1>
          <p className="text-body-sm text-muted-foreground">
            Jobs colored by status — click an event to open the vehicle.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/maintenance">Pipeline view</Link>
        </Button>
      </div>

      <Card className="overflow-hidden p-0" size="sm">
        <CalendarToolbar
          view={view}
          onViewChange={setView}
          currentDate={currentDate}
          onCurrentDateChange={setCurrentDate}
          rightSlot={
            <>
              {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map(
                (status) => (
                  <CalendarFilterChip
                    key={status}
                    checked={!!filters[status]}
                    onChange={(checked) =>
                      setFilters((f) => ({ ...f, [status]: checked }))
                    }
                    label={STATUS_LABEL[status]}
                    dotClass={STATUS_DOT[status]}
                  />
                ),
              )}
              <button
                type="button"
                aria-label="Search jobs"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
              >
                <Search className="size-4" />
              </button>
              <Button size="sm" className="gap-1">
                <Plus className="size-4" />
                Add Job
              </Button>
            </>
          }
        />

        {!jobs ? (
          <Skeleton className="m-4 h-[600px]" />
        ) : (
          <Calendar
            view={view}
            events={events}
            currentDate={currentDate}
            onCurrentDateChange={setCurrentDate}
            onSelectEvent={handleSelectEvent}
          />
        )}
      </Card>
    </div>
  );
}
