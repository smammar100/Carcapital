"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { MaintenanceJob, Vehicle } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  EventCalendar,
  type CalendarEvent,
  type EventCalendarHandle,
} from "@/components/event-calendar";
import { AddEventSheet } from "@/components/shared/add-event-sheet";
import { notify } from "@/lib/toast";

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const STATUS_COLOR: Record<string, CalendarEvent["color"]> = {
  pending: "amber",
  in_progress: "sky",
  completed: "emerald",
  stalled: "rose",
};

export default function MaintenanceCalendarPage() {
  const { company, user } = useAuth();
  const [jobs, setJobs] = useState<MaintenanceJob[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const calendarRef = useRef<EventCalendarHandle>(null);

  const reload = async () => {
    if (!company) return;
    const [j, v] = await Promise.all([
      maintenanceService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]);
    setJobs(j);
    setVehicles(v);
  };

  useEffect(() => {
    if (!company) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          title: j.description,
          description: j.notes ?? undefined,
          start,
          end,
          color: STATUS_COLOR[j.status] ?? "violet",
          location: v ? `${v.registration} — ${v.make} ${v.model}` : undefined,
          allDay: true,
        };
      });
  }, [jobs, vehicles]);

  async function handleEventUpdate(updated: CalendarEvent) {
    if (!user) return;
    try {
      await maintenanceService.update(
        updated.id,
        { dueDate: isoDate(updated.start) },
        user.id,
      );
      notify.success("Rescheduled");
      await reload();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not reschedule");
    }
  }

  async function handleEventDelete(_id: string) {
    notify.info("Delete maintenance jobs from the Pipeline view");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold tracking-tight">
            Maintenance Calendar
          </h1>
          <p className="text-body-sm text-muted-foreground">
            Jobs colored by status — click an event to view or edit.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => calendarRef.current?.openNewEventDialog()}
        >
          <Plus className="size-4" />
          New event
        </Button>
      </div>

      {!jobs ? (
        <Skeleton className="h-[600px]" />
      ) : (
        <EventCalendar
          ref={calendarRef}
          events={events}
          onEventUpdate={handleEventUpdate}
          onEventDelete={handleEventDelete}
          initialView="week"
          hideNewEventButton
        />
      )}

      <AddEventSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDraft={null}
        lockKind="maintenance"
        onCreated={() => void reload()}
      />
    </div>
  );
}
