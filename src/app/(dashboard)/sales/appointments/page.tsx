"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Appointment, AppointmentOutcome, Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Calendar,
  CalendarFilterChip,
  CalendarToolbar,
  TONE_CLASSES,
  type CalendarTone,
  type CalendarViewMode,
  type EventDraft,
  type WeekCalendarEvent,
} from "@/components/shared/week-calendar";
import { AddEventSheet } from "@/components/shared/add-event-sheet";
import {
  EventPreviewDialog,
  type EventPreviewRow,
} from "@/components/shared/event-preview-dialog";
import { EventEditDialog } from "@/components/shared/event-edit-dialog";
import {
  type ColumnDef,
  DataGridColumnsButton,
  DataGridDensityToggle,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridSkeletonRows,
  DataGridTable,
  VehicleCell,
  useColumnVisibility,
  useDensity,
} from "@/components/data-grid";
import { cn, formatDate, formatTime12 } from "@/lib/utils";
import { notify } from "@/lib/toast";

interface ApptRow extends Appointment {
  vehicle: Vehicle | null;
}

const STATUS_TONE: Record<string, CalendarTone> = {
  upcoming: "blue",
  completed: "emerald",
  cancelled: "slate",
  no_show: "rose",
};

const STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const OUTCOMES: AppointmentOutcome[] = [
  "pending",
  "test_drive",
  "offer_made",
  "deposit_taken",
  "sold",
  "lost",
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function AppointmentsPage() {
  const { user, company } = useAuth();
  const router = useRouter();
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [view, setView] = useState<CalendarViewMode>("weekly");
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({
    upcoming: true,
    completed: true,
    cancelled: true,
    no_show: true,
  });
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [addOpen, setAddOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<EventDraft | null>(null);
  const [preview, setPreview] = useState<Appointment | null>(null);
  const [editing, setEditing] = useState<Appointment | null>(null);

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

  const { density, setDensity } = useDensity();
  const { hiddenKeys, setHiddenKeys, visibleCols } = useColumnVisibility(cols);
  const lockedKeys = useMemo(() => new Set(["customerName"]), []);

  const events: WeekCalendarEvent[] = useMemo(() => {
    if (!appts) return [];
    return appts
      .filter((a) => statusFilters[a.status])
      .map((a) => {
        const start = new Date(`${a.date}T${a.time}:00`);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 60);
        const v = vehicles.find((x) => x.id === a.vehicleId);
        return {
          id: a.id,
          title: a.customerName,
          start,
          end,
          tone: STATUS_TONE[a.status] ?? "slate",
          meta: v?.registration,
          icon: "📅",
          vehicleId: v?.id,
          vehicleRegistration: v?.registration,
        } satisfies WeekCalendarEvent;
      });
  }, [appts, vehicles, statusFilters]);

  const handleSlotSelect = (start: Date, end: Date, allDay: boolean) => {
    setSheetDraft({
      kind: "appointment",
      title: "",
      date: isoDate(start),
      fromTime: hhmm(start),
      toTime: hhmm(end),
      allDay,
    });
    setAddOpen(true);
  };

  // Drag-to-move → reschedule. Optimistic, persist, refetch to reconcile.
  const handleEventMove = async (event: WeekCalendarEvent, newStart: Date) => {
    if (!user) return;
    setAppts((prev) =>
      prev
        ? prev.map((a) =>
            a.id === event.id
              ? { ...a, date: isoDate(newStart), time: hhmm(newStart) }
              : a,
          )
        : prev,
    );
    try {
      await appointmentService.update(
        event.id,
        { date: isoDate(newStart), time: hhmm(newStart) },
        user.id,
      );
      notify.success("Rescheduled");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not reschedule");
    } finally {
      void reload();
    }
  };

  async function handleOutcome(id: string, outcome: AppointmentOutcome) {
    if (!user) return;
    try {
      await appointmentService.setOutcome(id, outcome, user.id);
      await reload();
      setPreview(null);
      notify.success(`Outcome: ${outcome.replace("_", " ")}`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not set outcome");
    }
  }

  const previewVehicle = preview
    ? vehicles.find((v) => v.id === preview.vehicleId)
    : undefined;

  const previewRows: EventPreviewRow[] = preview
    ? [
        {
          label: "When",
          value: `${formatDate(preview.date)} · ${formatTime12(preview.time)}`,
        },
        {
          label: "Vehicle",
          value: previewVehicle
            ? `${previewVehicle.registration} — ${previewVehicle.make} ${previewVehicle.model}`
            : "—",
        },
        { label: "Phone", value: preview.customerPhone || "—" },
        { label: "Email", value: preview.customerEmail || "—" },
        ...(preview.specialRequirements
          ? [{ label: "Notes", value: preview.specialRequirements }]
          : []),
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            Customer test drives and viewings.
          </p>
        </div>
        <Button
          onClick={() => {
            setSheetDraft(null);
            setAddOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Book Appointment
        </Button>
      </div>

      {!appts ? (
        <DataGridShell>
          <DataGridTable cols={visibleCols} density={density}>
            <DataGridHeaderRow cols={visibleCols} />
            <tbody>
              <DataGridSkeletonRows columns={visibleCols} rows={6} />
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
        <Tabs defaultValue="calendar">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <DataGridColumnsButton
                columns={cols}
                hiddenKeys={hiddenKeys}
                onChange={setHiddenKeys}
                lockedKeys={lockedKeys}
              />
              <DataGridDensityToggle density={density} onChange={setDensity} />
            </div>
          </div>
          <TabsContent value="calendar" className="mt-3">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <CalendarToolbar
                view={view}
                onViewChange={setView}
                currentDate={currentDate}
                onCurrentDateChange={setCurrentDate}
                rightSlot={(
                  Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>
                ).map((s) => (
                  <CalendarFilterChip
                    key={s}
                    checked={!!statusFilters[s]}
                    onChange={(c) =>
                      setStatusFilters((f) => ({ ...f, [s]: c }))
                    }
                    label={STATUS_LABEL[s]}
                    tone={STATUS_TONE[s]}
                  />
                ))}
              />
              <Calendar
                view={view}
                events={events}
                currentDate={currentDate}
                onCurrentDateChange={setCurrentDate}
                onSelectEvent={(e) => {
                  const a = appts.find((x) => x.id === e.id);
                  if (a) setPreview(a);
                }}
                onSlotSelect={handleSlotSelect}
                onEventMove={handleEventMove}
              />
            </div>
          </TabsContent>
          <TabsContent value="list" className="mt-3">
            <DataGridShell>
              <DataGridTable cols={visibleCols} density={density}>
                <DataGridHeaderRow cols={visibleCols} />
                <tbody>
                  {(apptRows ?? []).map((a, i) => (
                    <DataGridRow
                      key={a.id}
                      row={a}
                      cols={visibleCols}
                      index={i}
                      onClick={(row) => setPreview(row)}
                    />
                  ))}
                </tbody>
              </DataGridTable>
            </DataGridShell>
          </TabsContent>
        </Tabs>
      )}

      {preview ? (
        <EventPreviewDialog
          open={preview !== null}
          onOpenChange={(o) => !o && setPreview(null)}
          title={preview.customerName}
          toneLabel={STATUS_LABEL[preview.status]}
          toneClass={cn(
            TONE_CLASSES[STATUS_TONE[preview.status] ?? "slate"].surface,
            TONE_CLASSES[STATUS_TONE[preview.status] ?? "slate"].text,
          )}
          rows={previewRows}
          bodySlot={
            <div>
              <p className="text-sm font-medium text-foreground">
                Set outcome
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {OUTCOMES.map((o) => (
                  <Button
                    key={o}
                    type="button"
                    size="sm"
                    variant={o === preview.outcome ? "default" : "outline"}
                    onClick={() => void handleOutcome(preview.id, o)}
                  >
                    {o.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>
          }
          onEdit={() => {
            setEditing(preview);
            setPreview(null);
          }}
          ctaLabel="View Vehicle"
          onCta={() => {
            const id = preview.vehicleId;
            setPreview(null);
            router.push(`/vehicles/${id}`);
          }}
        />
      ) : null}

      {editing && user ? (
        <EventEditDialog
          kind="appointment"
          entity={editing}
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          vehicles={vehicles}
          userId={user.id}
          onSaved={() => void reload()}
        />
      ) : null}

      <AddEventSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDraft={sheetDraft}
        lockKind="appointment"
        onCreated={() => void reload()}
      />
    </div>
  );
}
