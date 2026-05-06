"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CalendarFilterChip,
  CalendarToolbar,
  type CalendarViewMode,
  type WeekCalendarEvent,
} from "@/components/shared/week-calendar";
import { AddEventSheet } from "@/components/shared/add-event-sheet";

export default function MasterCalendarPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [shop, setShop] = useState<WorkshopJob[]>([]);
  const [maint, setMaint] = useState<MaintenanceJob[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAppt, setShowAppt] = useState(true);
  const [showShop, setShowShop] = useState(true);
  const [showMaint, setShowMaint] = useState(true);
  const [view, setView] = useState<CalendarViewMode>("weekly");
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [addOpen, setAddOpen] = useState(false);

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

  const events: WeekCalendarEvent[] = useMemo(() => {
    const out: WeekCalendarEvent[] = [];
    if (showAppt) {
      for (const a of appts) {
        const start = new Date(`${a.date}T${a.time}:00`);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 60);
        const v = vehicles.find((x) => x.id === a.vehicleId);
        out.push({
          id: `appt-${a.id}`,
          title: a.customerName,
          start,
          end,
          tone: "blue",
          meta: v?.registration,
          icon: "📅",
          href: v ? `/vehicles/${v.id}` : "/sales/appointments",
          vehicleId: v?.id,
          vehicleRegistration: v?.registration,
        });
      }
    }
    if (showShop) {
      for (const j of shop) {
        const start = new Date(`${j.scheduledDate}T${j.scheduledTime}:00`);
        const end = new Date(start);
        end.setHours(end.getHours() + 2);
        out.push({
          id: `ws-${j.id}`,
          title: j.customerName,
          start,
          end,
          tone: "amber",
          meta: j.vehicleReg,
          icon: "🔧",
          href: "/maintenance/workshop",
        });
      }
    }
    if (showMaint) {
      for (const j of maint) {
        if (!j.dueDate) continue;
        const start = new Date(`${j.dueDate}T09:00:00`);
        const end = new Date(start);
        end.setHours(end.getHours() + (j.estimatedDurationHours ?? 2));
        const v = vehicles.find((x) => x.id === j.vehicleId);
        out.push({
          id: `maint-${j.id}`,
          title: j.description,
          start,
          end,
          tone: "purple",
          meta: v?.registration,
          icon: "⚙️",
          href: v ? `/vehicles/${v.id}` : "/maintenance",
          vehicleId: v?.id,
          vehicleRegistration: v?.registration,
        });
      }
    }
    return out;
  }, [appts, shop, maint, vehicles, showAppt, showShop, showMaint]);

  const handleSelectEvent = (e: WeekCalendarEvent) => {
    if (e.href) router.push(e.href);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-h2 font-semibold tracking-tight">
          Master Calendar
        </h1>
        <p className="text-body-sm text-muted-foreground">
          Overlay of appointments, workshop walk-ins, and maintenance dues.
        </p>
      </div>

      <Card className="overflow-hidden p-0" size="sm">
        <CalendarToolbar
          view={view}
          onViewChange={setView}
          currentDate={currentDate}
          onCurrentDateChange={setCurrentDate}
          rightSlot={
            <>
              <CalendarFilterChip
                checked={showAppt}
                onChange={setShowAppt}
                label="Appointments"
                dotClass="bg-[#0ea5e9]"
              />
              <CalendarFilterChip
                checked={showShop}
                onChange={setShowShop}
                label="Workshop"
                dotClass="bg-[#f59e0b]"
              />
              <CalendarFilterChip
                checked={showMaint}
                onChange={setShowMaint}
                label="Maintenance"
                dotClass="bg-[#a855f7]"
              />
              <button
                type="button"
                aria-label="Search events"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
              >
                <Search className="size-4" />
              </button>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="size-4" />
                Add Event
              </Button>
            </>
          }
        />

        {loading ? (
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

      <AddEventSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDate={currentDate}
        onCreated={() => void reloadAll()}
      />
    </div>
  );
}
