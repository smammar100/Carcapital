"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { workshopService } from "@/lib/services/workshop-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type {
  Appointment,
  MaintenanceJob,
  Vehicle,
  WorkshopJob,
} from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  EventCalendar,
  type CalendarEvent,
  type EventCalendarHandle,
} from "@/components/event-calendar";
import { notify } from "@/lib/toast";

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function MasterCalendarPage() {
  const { company, user } = useAuth();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [shop, setShop] = useState<WorkshopJob[]>([]);
  const [maint, setMaint] = useState<MaintenanceJob[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const calendarRef = useRef<EventCalendarHandle>(null);

  const reloadAll = async () => {
    if (!company) return;
    const [a, s, m, v] = await Promise.all([
      appointmentService.getAll(company.id),
      workshopService.getAll(company.id),
      maintenanceService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]);
    setAppts(a);
    setShop(s);
    setMaint(m);
    setVehicles(v);
  };

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    void reloadAll().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const events: CalendarEvent[] = useMemo(() => {
    const out: CalendarEvent[] = [];

    for (const a of appts) {
      const start = new Date(`${a.date}T${a.time}:00`);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 60);
      const v = vehicles.find((x) => x.id === a.vehicleId);
      out.push({
        id: `appt-${a.id}`,
        title: a.customerName,
        description: a.specialRequirements ?? undefined,
        start,
        end,
        color: "sky",
        location: v ? `${v.registration} — ${v.make} ${v.model}` : undefined,
      });
    }

    for (const j of shop) {
      const start = new Date(`${j.scheduledDate}T${j.scheduledTime}:00`);
      const end = new Date(start);
      end.setHours(end.getHours() + 2);
      out.push({
        id: `ws-${j.id}`,
        title: j.customerName,
        description: j.notes ?? undefined,
        start,
        end,
        color: "amber",
        location: `${j.vehicleReg} — ${j.vehicleDescription}`,
      });
    }

    for (const j of maint) {
      if (!j.dueDate) continue;
      const start = new Date(`${j.dueDate}T09:00:00`);
      const end = new Date(start);
      end.setHours(end.getHours() + (j.estimatedDurationHours ?? 2));
      const v = vehicles.find((x) => x.id === j.vehicleId);
      out.push({
        id: `maint-${j.id}`,
        title: j.description,
        description: j.notes ?? undefined,
        start,
        end,
        color: "violet",
        location: v ? `${v.registration} — ${v.make} ${v.model}` : undefined,
        allDay: true,
      });
    }

    return out;
  }, [appts, shop, maint, vehicles]);

  async function handleEventUpdate(updated: CalendarEvent) {
    if (!user) return;
    const id = updated.id;
    try {
      if (id.startsWith("appt-")) {
        const realId = id.slice("appt-".length);
        await appointmentService.update(
          realId,
          { date: isoDate(updated.start), time: hhmm(updated.start) },
          user.id,
        );
      } else if (id.startsWith("ws-")) {
        const realId = id.slice("ws-".length);
        await workshopService.update(realId, {
          scheduledDate: isoDate(updated.start),
          scheduledTime: hhmm(updated.start),
        });
      } else if (id.startsWith("maint-")) {
        const realId = id.slice("maint-".length);
        await maintenanceService.update(
          realId,
          { dueDate: isoDate(updated.start) },
          user.id,
        );
      }
      notify.success("Rescheduled");
      await reloadAll();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not reschedule");
    }
  }

  async function handleEventDelete(_id: string) {
    notify.info("Delete events from their respective module pages");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Master Calendar
          </h1>
          <p className="text-sm text-muted-foreground">
            Overlay of appointments (sky), workshop walk-ins (amber), and
            maintenance dues (violet).
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

      {loading ? (
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
    </div>
  );
}
