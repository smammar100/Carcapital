"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { MaintenanceJob, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BigCalendar,
  type CalendarEvent,
} from "@/components/shared/big-calendar";

const STATUS_COLOR: Record<string, string> = {
  pending: "#eab308",
  in_progress: "#0ea5e9",
  completed: "#10b981",
  stalled: "#ef4444",
};

export default function MaintenanceCalendarPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<MaintenanceJob[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

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

  const events: CalendarEvent[] = useMemo(() => {
    if (!jobs) return [];
    return jobs
      .filter((j) => j.dueDate)
      .map((j) => {
        const v = vehicles.find((x) => x.id === j.vehicleId);
        const start = new Date(`${j.dueDate}T09:00:00`);
        const end = new Date(start);
        end.setHours(end.getHours() + (j.estimatedDurationHours ?? 2));
        return {
          id: j.id,
          title: `${v?.registration ?? "—"} · ${j.description}`,
          start,
          end,
          resource: {
            kind: "maintenance",
            href: v ? `/vehicles/${v.id}` : undefined,
            color: STATUS_COLOR[j.status],
          },
        };
      });
  }, [jobs, vehicles]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Maintenance Calendar
          </h1>
          <p className="text-sm text-muted-foreground">
            Jobs colored by status — click an event to open the vehicle.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/maintenance">Pipeline view</Link>
        </Button>
      </div>
      <Card className="p-3">
        {!jobs ? (
          <Skeleton className="h-[600px] w-full" />
        ) : (
          <BigCalendar
            events={events}
            onSelectEvent={(e) => {
              const href = (e as CalendarEvent).resource?.href;
              if (href) router.push(href);
            }}
          />
        )}
      </Card>
    </div>
  );
}
