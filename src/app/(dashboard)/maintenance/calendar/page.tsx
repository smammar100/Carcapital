"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { MaintenanceJob, Vehicle } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import {
  EventPreviewDialog,
  type EventPreviewRow,
} from "@/components/shared/event-preview-dialog";
import { EventEditDialog } from "@/components/shared/event-edit-dialog";
import { AddEventSheet } from "@/components/shared/add-event-sheet";
import { cn, formatDate } from "@/lib/utils";
import { notify } from "@/lib/toast";

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const STATUS_TONE: Record<string, CalendarTone> = {
  pending: "amber",
  in_progress: "blue",
  completed: "emerald",
  stalled: "rose",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  stalled: "Stalled",
};

export default function MaintenanceCalendarPage() {
  const { company, user } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<MaintenanceJob[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [editing, setEditing] = useState<MaintenanceJob | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<EventDraft | null>(null);

  const reload = async () => {
    if (!company) return;
    const [j, v] = await Promise.all([
      maintenanceService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]);
    setJobs(j);
    setVehicles(v);
  };
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
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          vehicleId: v?.id,
          vehicleRegistration: v?.registration,
          allDay: true,
        } satisfies WeekCalendarEvent;
      });
  }, [jobs, vehicles, filters]);

  const [preview, setPreview] = useState<WeekCalendarEvent | null>(null);

  const handleSelectEvent = (e: WeekCalendarEvent) => {
    setPreview(e);
  };

  const handleSlotSelect = (start: Date, end: Date, allDay: boolean) => {
    setSheetDraft({
      kind: "maintenance",
      title: "",
      date: isoDate(start),
      fromTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      toTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
      allDay,
    });
    setAddOpen(true);
  };

  // Drag-to-move a maintenance job → change its due date (date-only).
  const handleEventMove = async (event: WeekCalendarEvent, newStart: Date) => {
    if (!user) return;
    setJobs((prev) =>
      prev
        ? prev.map((j) =>
            j.id === event.id ? { ...j, dueDate: isoDate(newStart) } : j,
          )
        : prev,
    );
    try {
      await maintenanceService.update(
        event.id,
        { dueDate: isoDate(newStart) },
        user.id,
      );
      notify.success("Rescheduled");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not reschedule");
    } finally {
      void reload();
    }
  };

  const previewMeta = useMemo(() => {
    if (!preview || !jobs) return null;
    const job = jobs.find((j) => j.id === preview.id);
    if (!job) return null;
    const v = vehicles.find((x) => x.id === job.vehicleId);
    const rows: EventPreviewRow[] = [
      { label: "Due", value: job.dueDate ? formatDate(job.dueDate) : "—" },
      {
        label: "Vehicle",
        value: v ? `${v.registration} — ${v.make} ${v.model}` : "—",
      },
      { label: "Status", value: job.status.replace("_", " ") },
      {
        label: "Estimated",
        value: job.estimatedDurationHours
          ? `${job.estimatedDurationHours} h`
          : "—",
      },
    ];
    if (job.notes) rows.push({ label: "Notes", value: job.notes });
    const tone = STATUS_TONE[job.status] ?? "slate";
    return {
      title: job.description,
      toneLabel: STATUS_LABEL[job.status],
      toneClass: cn(TONE_CLASSES[tone].surface, TONE_CLASSES[tone].text),
      rows,
      vehicleHref: v ? `/vehicles/${v.id}` : null,
    };
  }, [preview, jobs, vehicles]);

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

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
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
                    tone={STATUS_TONE[status] ?? "slate"}
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
              <Button
                size="sm"
                className="gap-1"
                onClick={() => {
                  setSheetDraft(null);
                  setAddOpen(true);
                }}
              >
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
            onSlotSelect={handleSlotSelect}
            onEventMove={handleEventMove}
          />
        )}
      </div>

      {previewMeta ? (
        <EventPreviewDialog
          open={preview !== null}
          onOpenChange={(o) => !o && setPreview(null)}
          title={previewMeta.title}
          toneLabel={previewMeta.toneLabel}
          toneClass={previewMeta.toneClass}
          rows={previewMeta.rows}
          onEdit={() => {
            const job = jobs?.find((j) => j.id === preview?.id) ?? null;
            setPreview(null);
            if (job) setEditing(job);
          }}
          ctaLabel={previewMeta.vehicleHref ? "View Vehicle" : "Open Pipeline"}
          onCta={() => {
            const href = previewMeta.vehicleHref ?? "/maintenance";
            setPreview(null);
            router.push(href);
          }}
        />
      ) : null}

      {editing && user ? (
        <EventEditDialog
          kind="maintenance"
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
        lockKind="maintenance"
        onCreated={() => void reload()}
      />
    </div>
  );
}
