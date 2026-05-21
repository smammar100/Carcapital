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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CalendarFilterChip,
  CalendarToolbar,
  TONE_CLASSES,
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
import { cn, formatDate, formatTime12 } from "@/lib/utils";
import { notify } from "@/lib/toast";

type EditTarget =
  | { kind: "appointment"; entity: Appointment }
  | { kind: "workshop"; entity: WorkshopJob }
  | { kind: "maintenance"; entity: MaintenanceJob };

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Build a create-draft from a clicked / dragged calendar slot. */
function draftFromSlot(start: Date, end: Date, allDay: boolean): EventDraft {
  return {
    kind: "appointment",
    title: "",
    date: isoDate(start),
    fromTime: hhmm(start),
    toTime: hhmm(end),
    allDay,
  };
}

export default function MasterCalendarPage() {
  const { company, user } = useAuth();
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
  const [sheetDraft, setSheetDraft] = useState<EventDraft | null>(null);
  const [preview, setPreview] = useState<WeekCalendarEvent | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);

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
          allDay: true,
        });
      }
    }
    return out;
  }, [appts, shop, maint, vehicles, showAppt, showShop, showMaint]);

  const handleSelectEvent = (e: WeekCalendarEvent) => {
    setPreview(e);
  };

  const handleSlotSelect = (start: Date, end: Date, allDay: boolean) => {
    setSheetDraft(draftFromSlot(start, end, allDay));
    setAddOpen(true);
  };

  // Drag-to-move → reschedule. Optimistically update local state, persist,
  // then refetch so the cache + UI reconcile (server truth reverts failures).
  const handleEventMove = async (
    event: WeekCalendarEvent,
    newStart: Date,
  ) => {
    if (!user) return;
    const id = event.id;
    try {
      if (id.startsWith("appt-")) {
        const realId = id.slice("appt-".length);
        setAppts((prev) =>
          prev.map((a) =>
            a.id === realId
              ? { ...a, date: isoDate(newStart), time: hhmm(newStart) }
              : a,
          ),
        );
        await appointmentService.update(
          realId,
          { date: isoDate(newStart), time: hhmm(newStart) },
          user.id,
        );
      } else if (id.startsWith("ws-")) {
        const realId = id.slice("ws-".length);
        setShop((prev) =>
          prev.map((j) =>
            j.id === realId
              ? {
                  ...j,
                  scheduledDate: isoDate(newStart),
                  scheduledTime: hhmm(newStart),
                }
              : j,
          ),
        );
        await workshopService.update(realId, {
          scheduledDate: isoDate(newStart),
          scheduledTime: hhmm(newStart),
        });
      } else if (id.startsWith("maint-")) {
        const realId = id.slice("maint-".length);
        setMaint((prev) =>
          prev.map((j) =>
            j.id === realId ? { ...j, dueDate: isoDate(newStart) } : j,
          ),
        );
        await maintenanceService.update(
          realId,
          { dueDate: isoDate(newStart) },
          user.id,
        );
      }
      notify.success("Rescheduled");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not reschedule");
    } finally {
      void reloadAll();
    }
  };

  // Resolve a calendar event back to its underlying entity by id-prefix
  // convention (appt-, ws-, maint-) so the preview can show real fields.
  const previewMeta = useMemo(() => {
    if (!preview) return null;
    const id = preview.id;
    if (id.startsWith("appt-")) {
      const a = appts.find((x) => x.id === id.slice("appt-".length));
      if (!a) return null;
      const v = vehicles.find((x) => x.id === a.vehicleId);
      const rows: EventPreviewRow[] = [
        {
          label: "When",
          value: `${formatDate(a.date)} · ${formatTime12(a.time)}`,
        },
        {
          label: "Vehicle",
          value: v ? `${v.registration} — ${v.make} ${v.model}` : "—",
        },
        { label: "Phone", value: a.customerPhone },
        { label: "Email", value: a.customerEmail },
      ];
      if (a.specialRequirements) {
        rows.push({ label: "Notes", value: a.specialRequirements });
      }
      return {
        toneLabel: "Appointment",
        toneClass: cn(TONE_CLASSES.blue.surface, TONE_CLASSES.blue.text),
        title: a.customerName,
        rows,
        editTarget: { kind: "appointment", entity: a } as EditTarget,
        ctaLabel: v ? "View Vehicle" : "View Appointments",
        ctaHref: v ? `/vehicles/${v.id}` : "/sales/appointments",
      };
    }
    if (id.startsWith("ws-")) {
      const j = shop.find((x) => x.id === id.slice("ws-".length));
      if (!j) return null;
      const rows: EventPreviewRow[] = [
        {
          label: "When",
          value: `${formatDate(j.scheduledDate)} · ${formatTime12(j.scheduledTime)}`,
        },
        { label: "Vehicle", value: `${j.vehicleReg} — ${j.vehicleDescription}` },
        { label: "Phone", value: j.customerPhone },
        { label: "Status", value: j.status.replace("_", " ") },
      ];
      if (j.notes) rows.push({ label: "Notes", value: j.notes });
      return {
        toneLabel: "Workshop",
        toneClass: cn(TONE_CLASSES.amber.surface, TONE_CLASSES.amber.text),
        title: j.customerName,
        rows,
        editTarget: { kind: "workshop", entity: j } as EditTarget,
        ctaLabel: "Open Workshop",
        ctaHref: "/maintenance/workshop",
      };
    }
    if (id.startsWith("maint-")) {
      const j = maint.find((x) => x.id === id.slice("maint-".length));
      if (!j) return null;
      const v = vehicles.find((x) => x.id === j.vehicleId);
      const rows: EventPreviewRow[] = [
        { label: "Due", value: j.dueDate ? formatDate(j.dueDate) : "—" },
        {
          label: "Vehicle",
          value: v ? `${v.registration} — ${v.make} ${v.model}` : "—",
        },
        { label: "Status", value: j.status.replace("_", " ") },
        {
          label: "Estimated",
          value: j.estimatedDurationHours
            ? `${j.estimatedDurationHours} h`
            : "—",
        },
      ];
      if (j.notes) rows.push({ label: "Notes", value: j.notes });
      return {
        toneLabel: "Maintenance",
        toneClass: cn(TONE_CLASSES.purple.surface, TONE_CLASSES.purple.text),
        title: j.description,
        rows,
        editTarget: { kind: "maintenance", entity: j } as EditTarget,
        ctaLabel: v ? "View Vehicle" : "Open Pipeline",
        ctaHref: v ? `/vehicles/${v.id}` : "/maintenance",
      };
    }
    return null;
  }, [preview, appts, shop, maint, vehicles]);

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

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
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
                tone="blue"
              />
              <CalendarFilterChip
                checked={showShop}
                onChange={setShowShop}
                label="Workshop"
                tone="amber"
              />
              <CalendarFilterChip
                checked={showMaint}
                onChange={setShowMaint}
                label="Maintenance"
                tone="purple"
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
                onClick={() => {
                  setSheetDraft(null);
                  setAddOpen(true);
                }}
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
            onSlotSelect={handleSlotSelect}
            onEventMove={handleEventMove}
          />
        )}
      </div>

      <AddEventSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDraft={sheetDraft}
        onCreated={() => void reloadAll()}
      />

      {previewMeta ? (
        <EventPreviewDialog
          open={preview !== null}
          onOpenChange={(o) => !o && setPreview(null)}
          title={previewMeta.title}
          toneLabel={previewMeta.toneLabel}
          toneClass={previewMeta.toneClass}
          rows={previewMeta.rows}
          onEdit={() => {
            const target = previewMeta.editTarget;
            setPreview(null);
            setEditing(target);
          }}
          ctaLabel={previewMeta.ctaLabel}
          onCta={() => {
            const href = previewMeta.ctaHref;
            setPreview(null);
            router.push(href);
          }}
        />
      ) : null}

      {editing && user ? (
        <EventEditDialog
          {...editing}
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          vehicles={vehicles}
          userId={user.id}
          onSaved={() => void reloadAll()}
        />
      ) : null}
    </div>
  );
}
