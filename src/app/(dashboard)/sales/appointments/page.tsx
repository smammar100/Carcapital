"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, List, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Appointment, Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { EventCalendar, type CalendarEvent } from "@/components/event-calendar";
import { AddEventSheet } from "@/components/shared/add-event-sheet";
import {
  type ColumnDef,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridSkeletonRows,
  DataGridTable,
  VehicleCell,
  useDensity,
} from "@/components/data-grid";
import { formatTime12 } from "@/lib/utils";
import { notify } from "@/lib/toast";

interface ApptRow extends Appointment {
  vehicle: Vehicle | null;
}

const STATUS_COLOR: Record<string, CalendarEvent["color"]> = {
  upcoming: "sky",
  completed: "emerald",
  cancelled: "violet",
  no_show: "rose",
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function AppointmentsPage() {
  const { user, company } = useAuth();
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [addOpen, setAddOpen] = useState(false);

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

  const reload = async () => {
    if (!company) return;
    setAppts(await appointmentService.getAll(company.id));
  };

  const apptRows = useMemo<ApptRow[] | null>(() => {
    if (!appts) return null;
    return appts.map((a) => ({
      ...a,
      vehicle: vehicles.find((v) => v.id === a.vehicleId) ?? null,
    }));
  }, [appts, vehicles]);

  const cols = useMemo<ColumnDef<ApptRow>[]>(
    () => [
      { key: "date", label: "Date", type: "date", width: 120 },
      {
        key: "time",
        label: "Time",
        type: "text",
        width: 90,
        render: (a) => (
          <span className="tabular-nums">{formatTime12(a.time)}</span>
        ),
      },
      {
        key: "customerName",
        label: "Customer",
        type: "text",
        sticky: true,
        width: 180,
      },
      {
        key: "vehicle",
        label: "Vehicle",
        type: "vehicle",
        width: 200,
        render: (a) => <VehicleCell vehicle={a.vehicle} />,
      },
      { key: "status", label: "Status", type: "appointmentStatus", width: 130 },
      {
        key: "outcome",
        label: "Outcome",
        type: "appointmentOutcome",
        width: 130,
      },
    ],
    [],
  );

  const { density } = useDensity();

  const events: CalendarEvent[] = useMemo(() => {
    if (!appts) return [];
    return appts.map((a) => {
      const start = new Date(`${a.date}T${a.time}:00`);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 60);
      const v = vehicles.find((x) => x.id === a.vehicleId);
      return {
        id: a.id,
        title: a.customerName,
        description: a.specialRequirements ?? undefined,
        start,
        end,
        color: STATUS_COLOR[a.status] ?? "sky",
        location: v ? `${v.registration} — ${v.make} ${v.model}` : undefined,
      };
    });
  }, [appts, vehicles]);

  async function handleEventUpdate(updated: CalendarEvent) {
    if (!user) return;
    try {
      await appointmentService.update(
        updated.id,
        {
          date: isoDate(updated.start),
          time: hhmm(updated.start),
        },
        user.id,
      );
      notify.success("Appointment rescheduled");
      await reload();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not reschedule");
    }
  }

  async function handleEventDelete(_id: string) {
    notify.info("Delete appointments from the list view");
  }

  const hasData = appts != null && appts.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="calendar">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Appointments
            </h1>
            <p className="text-sm text-muted-foreground">
              All booked customer test drives and viewings. Schedule new ones
              and see what is coming up.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              <TabsList>
                <TabsTrigger value="calendar" aria-label="Calendar view">
                  <CalendarDays className="size-4" />
                </TabsTrigger>
                <TabsTrigger value="list" aria-label="List view">
                  <List className="size-4" />
                </TabsTrigger>
              </TabsList>
            )}
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Book Appointment
            </Button>
          </div>
        </div>

        {!appts ? (
          <DataGridShell>
            <DataGridTable cols={cols} density={density}>
              <DataGridHeaderRow cols={cols} />
              <tbody>
                <DataGridSkeletonRows columns={cols} rows={6} />
              </tbody>
            </DataGridTable>
          </DataGridShell>
        ) : appts.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No appointments yet"
            description="Book one from a lead or directly here."
          />
        ) : (
          <>
            <TabsContent value="calendar" className="mt-0">
              <EventCalendar
                events={events}
                onEventUpdate={handleEventUpdate}
                onEventDelete={handleEventDelete}
                initialView="week"
                hideNewEventButton
              />
            </TabsContent>
            <TabsContent value="list" className="mt-0">
              <DataGridShell>
                <DataGridTable cols={cols} density={density}>
                  <DataGridHeaderRow cols={cols} />
                  <tbody>
                    {(apptRows ?? []).map((a, i) => (
                      <DataGridRow
                        key={a.id}
                        row={a}
                        cols={cols}
                        index={i}
                      />
                    ))}
                  </tbody>
                </DataGridTable>
              </DataGridShell>
            </TabsContent>
          </>
        )}
      </Tabs>

      <AddEventSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDraft={null}
        lockKind="appointment"
        onCreated={() => void reload()}
      />
    </div>
  );
}
