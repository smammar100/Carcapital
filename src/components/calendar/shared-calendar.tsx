"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { workshopService } from "@/lib/services/workshop-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type {
  Appointment,
  MaintenanceJob,
  UUID,
  Vehicle,
  WorkshopJob,
} from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { notify } from "@/lib/toast";

/**
 * SharedCalendar — the calendar surface behind both the Master Calendar
 * (all three sources) and scoped calendars like Maintenance (a single kind).
 * Overlays appointments (sky), workshop walk-ins (amber) and maintenance dues
 * (violet) across day / week / month views, with slot-click create and
 * in-place edit. Pass `kinds` to scope which sources show; pass `ctaLabel` /
 * `lockCreateKind` to tune the create action. Records are deleted from their
 * module pages — this surface creates, views and reschedules.
 */

/* ------------------------------------------------------------------ types */

export type Kind = "appt" | "workshop" | "maint";
type ViewKey = "day" | "week" | "month";

interface CalEventBase {
  key: string;
  id: UUID;
  title: string;
  subtitle: string;
  date: string;
  start: number;
  end: number;
  allDay?: boolean;
}

type CalEvent =
  | (CalEventBase & { kind: "appt"; raw: Appointment })
  | (CalEventBase & { kind: "workshop"; raw: WorkshopJob })
  | (CalEventBase & { kind: "maint"; raw: MaintenanceJob });

const KIND_META: Record<
  Kind,
  {
    label: string;
    singular: string;
    manageHint: string;
    dot: string;
    chip: string;
    block: string;
  }
> = {
  appt: {
    label: "Appointments",
    singular: "appointment",
    manageHint: "Sales → Appointments",
    dot: "bg-sky-500",
    chip: "border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-200",
    block: "border-sky-500 bg-sky-500/15 text-sky-900 dark:text-sky-100",
  },
  workshop: {
    label: "Workshop",
    singular: "workshop job",
    manageHint: "Maintenance → Workshop Jobs",
    dot: "bg-amber-500",
    chip: "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200",
    block: "border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-100",
  },
  maint: {
    label: "Maintenance",
    singular: "maintenance due",
    manageHint: "Maintenance → Pipeline",
    dot: "bg-violet-500",
    chip: "border-violet-200 bg-violet-100 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-200",
    block: "border-violet-500 bg-violet-500/15 text-violet-900 dark:text-violet-100",
  },
};

const ALL_KINDS: Kind[] = ["appt", "workshop", "maint"];

/* ------------------------------------------------------------ date helpers */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad2 = (n: number): string => String(n).padStart(2, "0");
const toISO = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const weekdayMon0 = (d: Date): number => (d.getDay() + 6) % 7;
const startOfWeek = (d: Date): Date => addDays(d, -weekdayMon0(d));
const addMonthsClamped = (d: Date, n: number): Date => {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), lastDay));
  return x;
};

const hmToDec = (hm: string): number => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
};
const decToHm = (d: number): string =>
  `${pad2(Math.floor(d))}:${pad2(Math.round((d - Math.floor(d)) * 60))}`;
const fmtHour = (h: number): string => {
  const hh = Math.floor(h);
  return `${hh}:${pad2(Math.round((h - hh) * 60))}`;
};

const byStart = (a: CalEvent, b: CalEvent): number =>
  Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || a.start - b.start;

function buildMonthGrid(anchor: Date): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const daysInMonth = new Date(
    anchor.getFullYear(),
    anchor.getMonth() + 1,
    0,
  ).getDate();
  const rows = Math.ceil((weekdayMon0(first) + daysInMonth) / 7);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => addDays(gridStart, r * 7 + c)),
  );
}

function weekLabel(days: Date[]): string {
  const a = days[0];
  const b = days[6];
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${b.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${a.getFullYear()}`;
  }
  return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

const dayLabel = (d: Date): string =>
  `${DAY_NAMES[weekdayMon0(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function overlapDepths(timed: CalEvent[]): Map<string, number> {
  const sorted = [...timed].sort((a, b) => a.start - b.start || a.end - b.end);
  const depths = new Map<string, number>();
  sorted.forEach((ev, i) => {
    let depth = 0;
    for (let j = 0; j < i; j++) {
      if (sorted[j].end > ev.start) {
        depth = Math.max(depth, (depths.get(sorted[j].key) ?? 0) + 1);
      }
    }
    depths.set(ev.key, depth);
  });
  return depths;
}

/* ----------------------------------------------------------- time-grid cfg */

const GRID_START = 8;
const GRID_END = 18;
const HOURS: number[] = Array.from(
  { length: GRID_END - GRID_START },
  (_, i) => GRID_START + i,
);
const WEEK_HOUR_PX = 48;
const DAY_HOUR_PX = 56;

function gridSpan(
  ev: CalEvent,
  hourPx: number,
): { top: number; height: number } | null {
  if (ev.end <= GRID_START || ev.start >= GRID_END) return null;
  const s = Math.max(ev.start, GRID_START);
  const e = Math.min(ev.end, GRID_END);
  return {
    top: (s - GRID_START) * hourPx,
    height: Math.max((e - s) * hourPx, 20),
  };
}

const TIME_OPTIONS: string[] = Array.from(
  { length: (GRID_END - GRID_START) * 2 },
  (_, i) => decToHm(GRID_START + i / 2),
);

/* ------------------------------------------------------------- modal state */

type ModalState =
  | { mode: "create"; prefill: { date: string; time: string; kind: Kind } }
  | { mode: "edit"; ev: CalEvent }
  | { mode: "view"; ev: CalEvent }
  | null;

interface FormFields {
  kind: Kind;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleId: string;
  vehicleReg: string;
  vehicleDescription: string;
  description: string;
  date: string;
  time: string;
  notes: string;
}

const EMPTY_FIELDS: FormFields = {
  kind: "appt",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  vehicleId: "",
  vehicleReg: "",
  vehicleDescription: "",
  description: "",
  date: "",
  time: "10:00",
  notes: "",
};

function fieldsForEvent(ev: CalEvent): FormFields {
  switch (ev.kind) {
    case "appt":
      return {
        ...EMPTY_FIELDS,
        kind: "appt",
        customerName: ev.raw.customerName,
        customerPhone: ev.raw.customerPhone,
        customerEmail: ev.raw.customerEmail,
        vehicleId: ev.raw.vehicleId,
        date: ev.raw.date,
        time: ev.raw.time,
        notes: ev.raw.specialRequirements ?? "",
      };
    case "workshop":
      return {
        ...EMPTY_FIELDS,
        kind: "workshop",
        customerName: ev.raw.customerName,
        customerPhone: ev.raw.customerPhone,
        vehicleReg: ev.raw.vehicleReg,
        vehicleDescription: ev.raw.vehicleDescription,
        description: ev.raw.description,
        date: ev.raw.scheduledDate,
        time: ev.raw.scheduledTime,
        notes: ev.raw.notes ?? "",
      };
    case "maint":
      return {
        ...EMPTY_FIELDS,
        kind: "maint",
        vehicleId: ev.raw.vehicleId,
        description: ev.raw.description,
        date: ev.raw.dueDate ?? ev.date,
        notes: ev.raw.notes ?? "",
      };
  }
}

function validateFields(f: FormFields): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return "Pick a date.";
  if (f.kind === "appt") {
    if (!f.customerName.trim()) return "Customer name is required.";
    if (!f.customerPhone.trim()) return "Customer phone is required.";
    if (!f.vehicleId) return "Pick a vehicle.";
    if (!f.time) return "Pick a time.";
  }
  if (f.kind === "workshop") {
    if (!f.customerName.trim()) return "Customer name is required.";
    if (!f.vehicleReg.trim()) return "Vehicle registration is required.";
    if (!f.vehicleDescription.trim()) return "Vehicle description is required.";
    if (!f.description.trim()) return "Describe the job.";
    if (!f.time) return "Pick a time.";
  }
  if (f.kind === "maint") {
    if (!f.description.trim()) return "Describe the maintenance job.";
    if (!f.vehicleId) return "Pick a vehicle.";
  }
  return null;
}

/* ------------------------------------------------------------------- props */

export interface SharedCalendarProps {
  /** Which sources to load and show. Defaults to all three. */
  kinds?: Kind[];
  /** Label for the primary create button. */
  ctaLabel?: string;
  /** Lock the kind selector in the create form (single-kind calendars). */
  lockCreateKind?: boolean;
}

/* ------------------------------------------------------------------- view */

export function SharedCalendar({
  kinds = ALL_KINDS,
  ctaLabel = "New event",
  lockCreateKind = false,
}: SharedCalendarProps): React.ReactElement {
  const { company, user } = useAuth();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [shop, setShop] = useState<WorkshopJob[]>([]);
  const [maint, setMaint] = useState<MaintenanceJob[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<ViewKey>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [active, setActive] = useState<Set<Kind>>(() => new Set<Kind>(kinds));
  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const defaultKind: Kind = kinds[0] ?? "appt";
  const showFilters = kinds.length > 1;

  const reloadAll = useCallback(
    async (companyId: UUID): Promise<void> => {
      const [a, s, m, v] = await Promise.all([
        kinds.includes("appt")
          ? appointmentService.getAll(companyId)
          : Promise.resolve([]),
        kinds.includes("workshop")
          ? workshopService.getAll(companyId)
          : Promise.resolve([]),
        kinds.includes("maint")
          ? maintenanceService.getAll(companyId)
          : Promise.resolve([]),
        vehicleService.getAll(companyId),
      ]);
      setAppts(a);
      setShop(s);
      setMaint(m);
      setVehicles(v);
    },
    [kinds],
  );

  useEffect(() => {
    if (!company) return;
    const t = setTimeout(() => {
      setLoading(true);
      void reloadAll(company.id)
        .catch((e: unknown) =>
          notify.error(e instanceof Error ? e.message : "Could not load calendar"),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [company, reloadAll]);

  useEffect(() => {
    const update = (): void => setNow(new Date());
    const t0 = setTimeout(update, 0);
    const t = setInterval(update, 60_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  const vehicleLine = useCallback(
    (vehicleId: UUID | null): string => {
      const v = vehicles.find((x) => x.id === vehicleId);
      return v ? `${v.registration} — ${v.make} ${v.model}` : "";
    },
    [vehicles],
  );

  const events: CalEvent[] = useMemo(() => {
    const out: CalEvent[] = [];
    for (const a of appts) {
      const start = hmToDec(a.time);
      out.push({
        key: `appt-${a.id}`,
        kind: "appt",
        id: a.id,
        title: a.customerName,
        subtitle: vehicleLine(a.vehicleId),
        date: a.date,
        start,
        end: start + 1,
        raw: a,
      });
    }
    for (const j of shop) {
      const start = hmToDec(j.scheduledTime);
      out.push({
        key: `workshop-${j.id}`,
        kind: "workshop",
        id: j.id,
        title: j.customerName,
        subtitle: `${j.vehicleReg} — ${j.vehicleDescription}`,
        date: j.scheduledDate,
        start,
        end: start + 2,
        raw: j,
      });
    }
    for (const j of maint) {
      if (!j.dueDate) continue;
      out.push({
        key: `maint-${j.id}`,
        kind: "maint",
        id: j.id,
        title: j.description,
        subtitle: vehicleLine(j.vehicleId),
        date: j.dueDate,
        start: 0,
        end: 0,
        allDay: true,
        raw: j,
      });
    }
    return out;
  }, [appts, shop, maint, vehicleLine]);

  const todayISO = now ? toISO(now) : "";
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)),
    [anchor],
  );

  const label =
    view === "month"
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : view === "week"
        ? weekLabel(weekDays)
        : dayLabel(anchor);

  const rangeISO = useMemo(() => {
    if (view === "day") return new Set([toISO(anchor)]);
    if (view === "week") return new Set(weekDays.map(toISO));
    const days = buildMonthGrid(anchor)
      .flat()
      .filter((d) => d.getMonth() === anchor.getMonth());
    return new Set(days.map(toISO));
  }, [view, anchor, weekDays]);

  const inRange = useMemo(
    () => events.filter((e) => rangeISO.has(e.date)),
    [events, rangeISO],
  );
  const visible = useMemo(
    () => inRange.filter((e) => active.has(e.kind)),
    [inRange, active],
  );
  const sourceFiltered = useMemo(
    () => events.filter((e) => active.has(e.kind)),
    [events, active],
  );

  const navigate = (dir: -1 | 1): void => {
    setAnchor((a) =>
      view === "day"
        ? addDays(a, dir)
        : view === "week"
          ? addDays(a, dir * 7)
          : addMonthsClamped(a, dir),
    );
  };

  const toggleKind = (key: Kind): void => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openDay = (d: Date): void => {
    setAnchor(d);
    setView("day");
  };
  const openEvent = (ev: CalEvent): void => setModal({ mode: "view", ev });
  const openCreate = (prefill: { date: string; time: string; kind: Kind }): void =>
    setModal({ mode: "create", prefill });

  async function handleSubmit(fields: FormFields): Promise<void> {
    if (!company || !user || saving) return;
    setSaving(true);
    try {
      if (modal?.mode === "create") {
        if (fields.kind === "appt") {
          await appointmentService.create({
            companyId: company.id,
            vehicleId: fields.vehicleId,
            leadId: null,
            customerName: fields.customerName.trim(),
            customerPhone: fields.customerPhone.trim(),
            customerEmail: fields.customerEmail.trim(),
            date: fields.date,
            time: fields.time,
            specialRequirements: fields.notes.trim() || null,
            createdBy: user.id,
          });
        } else if (fields.kind === "workshop") {
          await workshopService.create(
            {
              companyId: company.id,
              customerName: fields.customerName.trim(),
              customerPhone: fields.customerPhone.trim(),
              vehicleReg: fields.vehicleReg.trim(),
              vehicleDescription: fields.vehicleDescription.trim(),
              description: fields.description.trim(),
              assignedTo: null,
              estimatedCost: null,
              scheduledDate: fields.date,
              scheduledTime: fields.time,
              notes: fields.notes.trim() || null,
            },
            user.id,
          );
        } else {
          await maintenanceService.create(
            {
              companyId: company.id,
              vehicleId: fields.vehicleId,
              description: fields.description.trim(),
              assignedTo: null,
              vendorId: null,
              estimatedCost: null,
              estimatedDurationHours: null,
              startDate: null,
              dueDate: fields.date,
              notes: fields.notes.trim() || null,
            },
            user.id,
          );
        }
        notify.success(`${KIND_META[fields.kind].label.replace(/s$/, "")} created`);
      } else if (modal?.mode === "edit") {
        const ev = modal.ev;
        if (ev.kind === "appt") {
          await appointmentService.update(
            ev.id,
            {
              customerName: fields.customerName.trim(),
              customerPhone: fields.customerPhone.trim(),
              customerEmail: fields.customerEmail.trim(),
              vehicleId: fields.vehicleId,
              date: fields.date,
              time: fields.time,
              specialRequirements: fields.notes.trim() || null,
            },
            user.id,
          );
        } else if (ev.kind === "workshop") {
          await workshopService.update(ev.id, {
            customerName: fields.customerName.trim(),
            customerPhone: fields.customerPhone.trim(),
            vehicleReg: fields.vehicleReg.trim(),
            vehicleDescription: fields.vehicleDescription.trim(),
            description: fields.description.trim(),
            scheduledDate: fields.date,
            scheduledTime: fields.time,
            notes: fields.notes.trim() || null,
          });
        } else {
          await maintenanceService.update(
            ev.id,
            {
              vehicleId: fields.vehicleId,
              description: fields.description.trim(),
              dueDate: fields.date,
              notes: fields.notes.trim() || null,
            },
            user.id,
          );
        }
        notify.success("Saved");
      }
      setModal(null);
      await reloadAll(company.id);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-[600px]" />;

  return (
    <>
      <div className="flex h-[calc(100dvh-230px)] min-h-[540px] w-full flex-col overflow-hidden rounded-lg border border-border bg-card">
        {/* Toolbar row 1 — navigation, view switch, CTA */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setAnchor(new Date())}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
            >
              Today
            </button>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Previous"
                onClick={() => navigate(-1)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => navigate(1)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <h2 className="truncate text-sm font-semibold">{label}</h2>
            {view === "day" && toISO(anchor) === todayISO && (
              <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                Today
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center rounded-md border border-border p-0.5">
              {(["day", "week", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                    view === v
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <nord-button
              variant="primary"
              size="s"
              type="button"
              suppressHydrationWarning
              onClick={() =>
                openCreate({ date: toISO(anchor), time: "10:00", kind: defaultKind })
              }
            >
              <Plus slot="start" className="h-4 w-4" />
              {ctaLabel}
            </nord-button>
          </div>
        </div>

        {/* Toolbar row 2 — source filter chips + live summary */}
        {showFilters ? (
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </span>
            {kinds.map((key) => {
              const isOn = active.has(key);
              const count = inRange.filter((e) => e.kind === key).length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleKind(key)}
                  aria-pressed={isOn}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    isOn
                      ? KIND_META[key].chip
                      : "border-border text-muted-foreground opacity-60 hover:opacity-100",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", KIND_META[key].dot)} />
                  {KIND_META[key].label}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
            <span className="ml-auto truncate text-xs text-muted-foreground">
              {visible.length} event{visible.length === 1 ? "" : "s"} shown
            </span>
          </div>
        ) : null}

        {view === "month" && (
          <MonthView
            anchor={anchor}
            events={sourceFiltered}
            todayISO={todayISO}
            onOpenDay={openDay}
            onOpenEvent={openEvent}
          />
        )}
        {view === "week" && (
          <WeekView
            days={weekDays}
            events={sourceFiltered}
            todayISO={todayISO}
            now={now}
            defaultKind={defaultKind}
            onOpenDay={openDay}
            onOpenEvent={openEvent}
            onCreateAt={openCreate}
          />
        )}
        {view === "day" && (
          <DayView
            anchor={anchor}
            events={sourceFiltered}
            todayISO={todayISO}
            now={now}
            kinds={kinds}
            onOpenEvent={openEvent}
            onCreateAt={openCreate}
          />
        )}
      </div>

      {modal && (
        <EventModal
          state={modal}
          kinds={kinds}
          vehicles={vehicles}
          saving={saving}
          createHeading={ctaLabel}
          lockCreateKind={lockCreateKind}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
          onEdit={(ev) => setModal({ mode: "edit", ev })}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------- month view */

function MonthView({
  anchor,
  events,
  todayISO,
  onOpenDay,
  onOpenEvent,
}: {
  anchor: Date;
  events: CalEvent[];
  todayISO: string;
  onOpenDay: (d: Date) => void;
  onOpenEvent: (ev: CalEvent) => void;
}): React.ReactElement {
  const weeks = buildMonthGrid(anchor);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-border">
        {DOW.map((d, i) => (
          <div
            key={d}
            className={cn(
              "py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
              i >= 5 && "bg-muted/30",
            )}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weeks.flat().map((d, idx) => {
          const iso = toISO(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = iso === todayISO;
          const isWeekend = idx % 7 >= 5;
          const dayEvents = events.filter((e) => e.date === iso).sort(byStart);
          const shown = dayEvents.slice(0, 3);
          const extra = dayEvents.length - shown.length;
          return (
            <div
              key={iso}
              role="button"
              tabIndex={0}
              onClick={() => onOpenDay(d)}
              onKeyDown={(e) => {
                if (
                  e.target === e.currentTarget &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  onOpenDay(d);
                }
              }}
              className={cn(
                "flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-border p-1 transition-colors hover:bg-muted/40",
                idx % 7 !== 6 && "border-r",
                idx < (weeks.length - 1) * 7 && "border-b",
                isWeekend && "bg-muted/30",
              )}
            >
              <div className="flex shrink-0 items-center justify-end">
                {isToday ? (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {d.getDate()}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "px-0.5 text-xs",
                      inMonth ? "text-muted-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    {d.getDate()}
                  </span>
                )}
              </div>
              {shown.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  title={`${e.title}${e.subtitle ? ` · ${e.subtitle}` : ""}`}
                  onClick={(click) => {
                    click.stopPropagation();
                    onOpenEvent(e);
                  }}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-1 rounded px-1 py-px text-left text-[10px] leading-4 transition hover:underline",
                    e.allDay
                      ? cn("border", KIND_META[e.kind].chip)
                      : cn("border-l-2", KIND_META[e.kind].block),
                  )}
                >
                  {!e.allDay && (
                    <span className="shrink-0 font-medium tabular-nums">
                      {fmtHour(e.start)}
                    </span>
                  )}
                  <span className="min-w-0 truncate">{e.title}</span>
                </button>
              ))}
              {extra > 0 && (
                <span className="truncate px-1 text-[10px] font-medium text-muted-foreground">
                  +{extra} more
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- week view */

function WeekView({
  days,
  events,
  todayISO,
  now,
  defaultKind,
  onOpenDay,
  onOpenEvent,
  onCreateAt,
}: {
  days: Date[];
  events: CalEvent[];
  todayISO: string;
  now: Date | null;
  defaultKind: Kind;
  onOpenDay: (d: Date) => void;
  onOpenEvent: (ev: CalEvent) => void;
  onCreateAt: (p: { date: string; time: string; kind: Kind }) => void;
}): React.ReactElement {
  const nowDecimal = now ? now.getHours() + now.getMinutes() / 60 : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="sticky top-0 z-20 flex h-12 border-b border-border bg-card">
        <div className="w-12 shrink-0" />
        {days.map((d, i) => {
          const iso = toISO(d);
          const isToday = iso === todayISO;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onOpenDay(d)}
              title={`Open ${dayLabel(d)}`}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 border-l border-border transition-colors hover:bg-muted/40",
                i >= 5 && "bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-medium uppercase",
                  isToday ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {DOW[i]}
              </span>
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      <div className="sticky top-12 z-20 flex min-h-7 border-b border-border bg-card">
        <div className="flex w-12 shrink-0 items-center justify-end pr-1.5">
          <span className="text-[9px] uppercase text-muted-foreground">all-day</span>
        </div>
        {days.map((d, i) => {
          const iso = toISO(d);
          const dues = events.filter((e) => e.date === iso && e.allDay);
          return (
            <div
              key={iso}
              className={cn(
                "flex min-w-0 flex-1 flex-col justify-center gap-0.5 border-l border-border px-1 py-1",
                i >= 5 && "bg-muted/30",
              )}
            >
              {dues.slice(0, 2).map((e) => (
                <button
                  key={e.key}
                  type="button"
                  title={`${e.title}${e.subtitle ? ` · ${e.subtitle}` : ""}`}
                  onClick={() => onOpenEvent(e)}
                  className={cn(
                    "truncate rounded border px-1 py-px text-left text-[10px] font-medium",
                    KIND_META[e.kind].chip,
                  )}
                >
                  {e.title}
                </button>
              ))}
              {dues.length > 2 && (
                <button
                  type="button"
                  onClick={() => onOpenDay(d)}
                  className="truncate px-1 text-left text-[10px] font-medium text-muted-foreground hover:underline"
                >
                  +{dues.length - 2} more
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex">
        <div className="w-12 shrink-0">
          {HOURS.map((h) => (
            <div
              key={h}
              className="h-12 border-b border-border/60 pr-1.5 pt-0.5 text-right text-[10px] leading-none tabular-nums text-muted-foreground"
            >
              {fmtHour(h)}
            </div>
          ))}
        </div>
        {days.map((d, i) => {
          const iso = toISO(d);
          const timed = events.filter((e) => e.date === iso && !e.allDay);
          const depths = overlapDepths(timed);
          const showNow =
            iso === todayISO &&
            nowDecimal !== null &&
            nowDecimal >= GRID_START &&
            nowDecimal <= GRID_END;
          return (
            <div
              key={iso}
              className={cn(
                "relative min-w-0 flex-1 border-l border-border",
                i >= 5 && "bg-muted/30",
              )}
            >
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`Add event on ${dayLabel(d)} at ${fmtHour(h)}`}
                  onClick={() =>
                    onCreateAt({ date: iso, time: decToHm(h), kind: defaultKind })
                  }
                  className="block h-12 w-full border-b border-border/60 transition-colors hover:bg-muted/40"
                />
              ))}
              {timed.map((e) => {
                const span = gridSpan(e, WEEK_HOUR_PX);
                if (!span) return null;
                return (
                  <button
                    key={e.key}
                    type="button"
                    title={`${e.title}${e.subtitle ? ` · ${e.subtitle}` : ""}`}
                    onClick={() => onOpenEvent(e)}
                    style={{
                      top: span.top,
                      height: span.height,
                      left: `calc(0.125rem + ${(depths.get(e.key) ?? 0) * 14}%)`,
                      right: "0.125rem",
                      zIndex: 1 + (depths.get(e.key) ?? 0),
                    }}
                    className={cn(
                      "absolute overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left transition-shadow hover:shadow-md",
                      KIND_META[e.kind].block,
                    )}
                  >
                    <p className="truncate text-[10px] leading-3 tabular-nums opacity-80">
                      {fmtHour(e.start)}
                    </p>
                    <p className="truncate text-[11px] font-medium leading-4">
                      {e.title}
                    </p>
                    {e.end - e.start >= 1.5 && (
                      <p className="truncate text-[10px] leading-3 opacity-70">
                        {e.subtitle}
                      </p>
                    )}
                  </button>
                );
              })}
              {showNow && nowDecimal !== null && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10"
                  style={{ top: (nowDecimal - GRID_START) * WEEK_HOUR_PX }}
                >
                  <div className="relative h-px bg-red-500/70">
                    <span className="absolute -left-0.5 -top-[2.5px] h-1.5 w-1.5 rounded-full bg-red-500/70" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- day view */

function DayView({
  anchor,
  events,
  todayISO,
  now,
  kinds,
  onOpenEvent,
  onCreateAt,
}: {
  anchor: Date;
  events: CalEvent[];
  todayISO: string;
  now: Date | null;
  kinds: Kind[];
  onOpenEvent: (ev: CalEvent) => void;
  onCreateAt: (p: { date: string; time: string; kind: Kind }) => void;
}): React.ReactElement {
  const iso = toISO(anchor);
  const dayEvents = events.filter((e) => e.date === iso);
  const allDay = dayEvents.filter((e) => e.allDay);
  const nowDecimal = now ? now.getHours() + now.getMinutes() / 60 : null;
  const showNow =
    iso === todayISO &&
    nowDecimal !== null &&
    nowDecimal >= GRID_START &&
    nowDecimal <= GRID_END;
  const laneCols = `3rem repeat(${kinds.length}, minmax(0, 1fr))`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {allDay.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5">
          <span className="shrink-0 text-[9px] uppercase text-muted-foreground">
            all-day
          </span>
          {allDay.map((e) => (
            <button
              key={e.key}
              type="button"
              title={`${e.title}${e.subtitle ? ` · ${e.subtitle}` : ""}`}
              onClick={() => onOpenEvent(e)}
              className={cn(
                "truncate rounded border px-1.5 py-0.5 text-[10px] font-medium",
                KIND_META[e.kind].chip,
              )}
            >
              {e.title}
              {e.subtitle ? ` · ${e.subtitle}` : ""}
            </button>
          ))}
        </div>
      )}

      <div
        className="grid shrink-0 border-b border-border"
        style={{ gridTemplateColumns: laneCols }}
      >
        <div />
        {kinds.map((kind) => {
          const count = dayEvents.filter((e) => e.kind === kind).length;
          return (
            <div
              key={kind}
              className="flex min-w-0 items-center gap-2 border-l border-border px-3 py-2"
            >
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", KIND_META[kind].dot)} />
              <span className="truncate text-sm font-medium">
                {KIND_META[kind].label}
              </span>
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative grid pb-4"
          style={{ gridTemplateColumns: laneCols }}
        >
          <div
            className="relative"
            style={{ height: (GRID_END - GRID_START) * DAY_HOUR_PX }}
          >
            {[...HOURS, GRID_END].map((h) => (
              <span
                key={h}
                className="absolute right-1.5 text-[10px] tabular-nums text-muted-foreground"
                style={{ top: (h - GRID_START) * DAY_HOUR_PX + 2 }}
              >
                {fmtHour(h)}
              </span>
            ))}
          </div>

          {kinds.map((kind) => {
            const laneAll = dayEvents.filter((e) => e.kind === kind);
            const timed = laneAll.filter((e) => !e.allDay);
            const depths = overlapDepths(timed);
            return (
              <div key={kind} className="relative border-l border-border">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`Add ${KIND_META[kind].singular} at ${fmtHour(h)}`}
                    onClick={() =>
                      onCreateAt({ date: iso, time: decToHm(h), kind })
                    }
                    className="block h-14 w-full border-b border-border/50 transition-colors hover:bg-muted/40"
                  />
                ))}
                {timed.map((e) => {
                  const span = gridSpan(e, DAY_HOUR_PX);
                  if (!span) return null;
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => onOpenEvent(e)}
                      style={{
                        top: span.top,
                        height: span.height,
                        left: `calc(0.25rem + ${(depths.get(e.key) ?? 0) * 14}%)`,
                        right: "0.25rem",
                        zIndex: 1 + (depths.get(e.key) ?? 0),
                      }}
                      className={cn(
                        "absolute overflow-hidden rounded-md border-l-2 p-2 text-left transition-shadow hover:shadow-sm",
                        KIND_META[e.kind].block,
                      )}
                    >
                      <p className="text-[10px] leading-3 tabular-nums opacity-80">
                        {fmtHour(e.start)} – {fmtHour(e.end)}
                      </p>
                      <p className="truncate text-xs font-medium leading-4">{e.title}</p>
                      <p className="truncate text-[10px] leading-3 opacity-80">
                        {e.subtitle}
                      </p>
                    </button>
                  );
                })}
                {laneAll.length === 0 && (
                  <div className="pointer-events-none absolute inset-x-2 top-2 rounded-md border border-dashed border-border py-2 text-center">
                    <span className="text-[10px] text-muted-foreground/60">
                      No {KIND_META[kind].singular}s — click a slot to add
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {showNow && nowDecimal !== null && (
            <div
              className="pointer-events-none absolute right-0 z-20"
              style={{
                top: (nowDecimal - GRID_START) * DAY_HOUR_PX,
                left: "3rem",
              }}
            >
              <div className="relative h-px bg-red-500/70">
                <span className="absolute -left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-red-500/70" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ event modal */

function EventModal({
  state,
  kinds,
  vehicles,
  saving,
  createHeading,
  lockCreateKind,
  onClose,
  onSubmit,
  onEdit,
}: {
  state: NonNullable<ModalState>;
  kinds: Kind[];
  vehicles: Vehicle[];
  saving: boolean;
  createHeading: string;
  lockCreateKind: boolean;
  onClose: () => void;
  onSubmit: (fields: FormFields) => void;
  onEdit: (ev: CalEvent) => void;
}): React.ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          state.mode === "create"
            ? "New event"
            : state.mode === "edit"
              ? "Edit event"
              : "Event details"
        }
        className="max-h-full w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
      >
        {state.mode === "create" && (
          <EventForm
            heading={createHeading}
            submitLabel="Add event"
            kindLocked={lockCreateKind}
            kinds={kinds}
            vehicles={vehicles}
            saving={saving}
            initial={{
              ...EMPTY_FIELDS,
              kind: state.prefill.kind,
              date: state.prefill.date,
              time: state.prefill.time,
            }}
            onSubmit={onSubmit}
            onClose={onClose}
          />
        )}
        {state.mode === "edit" && (
          <EventForm
            heading={`Edit ${KIND_META[state.ev.kind].singular}`}
            submitLabel="Save changes"
            kindLocked
            kinds={kinds}
            vehicles={vehicles}
            saving={saving}
            initial={fieldsForEvent(state.ev)}
            onSubmit={onSubmit}
            onClose={onClose}
          />
        )}
        {state.mode === "view" && (
          <EventDetails
            ev={state.ev}
            onEdit={() => onEdit(state.ev)}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function EventForm({
  heading,
  submitLabel,
  kindLocked,
  kinds,
  vehicles,
  saving,
  initial,
  onSubmit,
  onClose,
}: {
  heading: string;
  submitLabel: string;
  kindLocked: boolean;
  kinds: Kind[];
  vehicles: Vehicle[];
  saving: boolean;
  initial: FormFields;
  onSubmit: (fields: FormFields) => void;
  onClose: () => void;
}): React.ReactElement {
  const [fields, setFields] = useState<FormFields>(initial);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormFields>(key: K, value: FormFields[K]): void =>
    setFields((f) => ({ ...f, [key]: value }));

  const submit = (): void => {
    const problem = validateFields(fields);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(fields);
  };

  const timeOptions = TIME_OPTIONS.includes(fields.time)
    ? TIME_OPTIONS
    : [fields.time, ...TIME_OPTIONS];

  const vehicleSelect = (
    <nord-select
      expand
      label="Vehicle"
      value={fields.vehicleId}
      onChange={(e) => set("vehicleId", (e.target as HTMLSelectElement).value)}
      suppressHydrationWarning
    >
      <option value="">Select a vehicle…</option>
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>
          {v.registration} — {v.make} {v.model}
        </option>
      ))}
    </nord-select>
  );

  const dateField = (labelText: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor="mc-date" className="text-xs font-medium text-foreground">
        {labelText}
      </label>
      <input
        id="mc-date"
        type="date"
        value={fields.date}
        onChange={(e) => set("date", e.target.value)}
        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );

  const timeSelect = (
    <nord-select
      expand
      label="Time"
      value={fields.time}
      onChange={(e) => set("time", (e.target as HTMLSelectElement).value)}
      suppressHydrationWarning
    >
      {timeOptions.map((t) => (
        <option key={t} value={t}>
          {fmtHour(hmToDec(t))}
        </option>
      ))}
    </nord-select>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{heading}</h3>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3.5 p-4">
        {kinds.length > 1 && (
          <nord-select
            expand
            label="Calendar"
            value={fields.kind}
            disabled={kindLocked || undefined}
            onChange={(e) =>
              set("kind", (e.target as HTMLSelectElement).value as Kind)
            }
            suppressHydrationWarning
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_META[k].label}
              </option>
            ))}
          </nord-select>
        )}

        {fields.kind === "appt" && (
          <>
            <nord-input
              expand
              label="Customer name"
              type="text"
              value={fields.customerName}
              onInput={(e) => set("customerName", (e.target as HTMLInputElement).value)}
              suppressHydrationWarning
            />
            <div className="grid grid-cols-2 gap-3">
              <nord-input
                expand
                label="Phone"
                type="tel"
                value={fields.customerPhone}
                onInput={(e) => set("customerPhone", (e.target as HTMLInputElement).value)}
                suppressHydrationWarning
              />
              <nord-input
                expand
                label="Email"
                type="email"
                value={fields.customerEmail}
                onInput={(e) => set("customerEmail", (e.target as HTMLInputElement).value)}
                suppressHydrationWarning
              />
            </div>
            {vehicleSelect}
            <div className="grid grid-cols-2 gap-3">
              {dateField("Date")}
              {timeSelect}
            </div>
            <nord-textarea
              expand
              label="Special requirements"
              value={fields.notes}
              onInput={(e) => set("notes", (e.target as HTMLTextAreaElement).value)}
              suppressHydrationWarning
            />
          </>
        )}

        {fields.kind === "workshop" && (
          <>
            <nord-input
              expand
              label="Customer name"
              type="text"
              value={fields.customerName}
              onInput={(e) => set("customerName", (e.target as HTMLInputElement).value)}
              suppressHydrationWarning
            />
            <nord-input
              expand
              label="Phone"
              type="tel"
              value={fields.customerPhone}
              onInput={(e) => set("customerPhone", (e.target as HTMLInputElement).value)}
              suppressHydrationWarning
            />
            <div className="grid grid-cols-2 gap-3">
              <nord-input
                expand
                label="Vehicle reg"
                type="text"
                placeholder="BD70 KLM"
                value={fields.vehicleReg}
                onInput={(e) => set("vehicleReg", (e.target as HTMLInputElement).value)}
                suppressHydrationWarning
              />
              <nord-input
                expand
                label="Vehicle description"
                type="text"
                placeholder="BMW 3 Series"
                value={fields.vehicleDescription}
                onInput={(e) =>
                  set("vehicleDescription", (e.target as HTMLInputElement).value)
                }
                suppressHydrationWarning
              />
            </div>
            <nord-input
              expand
              label="Job description"
              type="text"
              placeholder="MOT prep, brake inspection…"
              value={fields.description}
              onInput={(e) => set("description", (e.target as HTMLInputElement).value)}
              suppressHydrationWarning
            />
            <div className="grid grid-cols-2 gap-3">
              {dateField("Date")}
              {timeSelect}
            </div>
            <nord-textarea
              expand
              label="Notes"
              value={fields.notes}
              onInput={(e) => set("notes", (e.target as HTMLTextAreaElement).value)}
              suppressHydrationWarning
            />
          </>
        )}

        {fields.kind === "maint" && (
          <>
            <nord-input
              expand
              label="Description"
              type="text"
              placeholder="Cambelt change, MOT due…"
              value={fields.description}
              onInput={(e) => set("description", (e.target as HTMLInputElement).value)}
              suppressHydrationWarning
            />
            {vehicleSelect}
            {dateField("Due date")}
            <nord-textarea
              expand
              label="Notes"
              value={fields.notes}
              onInput={(e) => set("notes", (e.target as HTMLTextAreaElement).value)}
              suppressHydrationWarning
            />
          </>
        )}

        {error && (
          <p className="text-xs font-medium text-destructive-foreground">{error}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <nord-button size="s" type="button" suppressHydrationWarning onClick={onClose}>
          Cancel
        </nord-button>
        <nord-button
          variant="primary"
          size="s"
          type="button"
          disabled={saving || undefined}
          suppressHydrationWarning
          onClick={submit}
        >
          {submitLabel === "Add event" ? (
            <Plus slot="start" className="h-4 w-4" />
          ) : (
            <Pencil slot="start" className="h-3.5 w-3.5" />
          )}
          {saving ? "Saving…" : submitLabel}
        </nord-button>
      </div>
    </>
  );
}

function EventDetails({
  ev,
  onEdit,
  onClose,
}: {
  ev: CalEvent;
  onEdit: () => void;
  onClose: () => void;
}): React.ReactElement {
  const d = new Date(`${ev.date}T00:00:00`);
  const phone =
    ev.kind === "appt" || ev.kind === "workshop" ? ev.raw.customerPhone : null;
  const notes =
    ev.kind === "appt"
      ? ev.raw.specialRequirements
      : ev.kind === "workshop"
        ? ev.raw.notes
        : ev.raw.notes;

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", KIND_META[ev.kind].dot)} />
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium",
              KIND_META[ev.kind].chip,
            )}
          >
            {KIND_META[ev.kind].label}
          </span>
          <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            {ev.raw.status}
          </span>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5 p-4">
        <h3 className="text-base font-semibold leading-tight">{ev.title}</h3>
        {ev.kind === "workshop" && (
          <p className="text-sm text-muted-foreground">{ev.raw.description}</p>
        )}
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 shrink-0" />
          {dayLabel(d)}
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          {ev.allDay
            ? "All day (due date)"
            : `${fmtHour(ev.start)} – ${fmtHour(ev.end)}`}
        </p>
        {ev.subtitle && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Car className="h-4 w-4 shrink-0" />
            <span className="truncate">{ev.subtitle}</span>
          </p>
        )}
        {phone && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            {phone}
          </p>
        )}
        {notes && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 whitespace-pre-wrap">{notes}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <span className="truncate text-[10px] text-muted-foreground">
          Delete via {KIND_META[ev.kind].manageHint}
        </span>
        <div className="flex shrink-0 gap-2">
          <nord-button size="s" type="button" suppressHydrationWarning onClick={onEdit}>
            <Pencil slot="start" className="h-3.5 w-3.5" />
            Edit
          </nord-button>
          <nord-button size="s" type="button" suppressHydrationWarning onClick={onClose}>
            Close
          </nord-button>
        </div>
      </div>
    </>
  );
}
