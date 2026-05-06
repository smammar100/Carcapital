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
import {
  EventPreviewDialog,
  type EventPreviewRow,
} from "@/components/shared/event-preview-dialog";
import { formatDate, formatTime12 } from "@/lib/utils";

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
  const [preview, setPreview] = useState<WeekCalendarEvent | null>(null);

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
    setPreview(e);
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
        toneClass: "bg-[rgba(14,165,233,0.12)] text-[#0369a1]",
        title: a.customerName,
        rows,
        editHref: "/sales/appointments",
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
        toneClass: "bg-[rgba(245,158,11,0.15)] text-[#92400e]",
        title: j.customerName,
        rows,
        editHref: "/maintenance/workshop",
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
        toneClass: "bg-[rgba(168,85,247,0.15)] text-[#6b21a8]",
        title: j.description,
        rows,
        editHref: "/maintenance",
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

      {previewMeta ? (
        <EventPreviewDialog
          open={preview !== null}
          onOpenChange={(o) => !o && setPreview(null)}
          title={previewMeta.title}
          toneLabel={previewMeta.toneLabel}
          toneClass={previewMeta.toneClass}
          rows={previewMeta.rows}
          onEdit={() => {
            const href = previewMeta.editHref;
            setPreview(null);
            router.push(href);
          }}
          ctaLabel={previewMeta.ctaLabel}
          onCta={() => {
            const href = previewMeta.ctaHref;
            setPreview(null);
            router.push(href);
          }}
        />
      ) : null}
    </div>
  );
}
