"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Appointment, MaintenanceJob, Vehicle } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAYS_FULL = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Tone = "yellow" | "green" | "blue" | "red";

interface CalendarEvent {
  id: string;
  date: string;
  time: string | null;
  endTime: string | null;
  title: string;
  subtitle: string | null;
  tone: Tone;
}

// Maps the widget's 4 tones onto the shared calendar tone tokens
// (calendar/tone.ts) so the dashboard mini-calendar matches the full calendar
// and adapts to dark mode.
const TONE_STYLES: Record<
  Tone,
  { card: string; bar: string; title: string; time: string; dot: string }
> = {
  yellow: {
    card: "bg-[var(--cal-amber-surface)]",
    bar: "bg-[var(--cal-amber-bar)]",
    title: "text-[var(--cal-amber-text)]",
    time: "text-muted-foreground",
    dot: "bg-[var(--cal-amber-bar)]",
  },
  green: {
    card: "bg-[var(--cal-emerald-surface)]",
    bar: "bg-[var(--cal-emerald-bar)]",
    title: "text-[var(--cal-emerald-text)]",
    time: "text-muted-foreground",
    dot: "bg-[var(--cal-emerald-bar)]",
  },
  blue: {
    card: "bg-[var(--cal-blue-surface)]",
    bar: "bg-[var(--cal-blue-bar)]",
    title: "text-[var(--cal-blue-text)]",
    time: "text-muted-foreground",
    dot: "bg-[var(--cal-blue-bar)]",
  },
  red: {
    card: "bg-[var(--cal-rose-surface)]",
    bar: "bg-[var(--cal-rose-bar)]",
    title: "text-[var(--cal-rose-text)]",
    time: "text-muted-foreground",
    dot: "bg-[var(--cal-rose-bar)]",
  },
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function fmtTime(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${pad(m)} ${period}`;
}

function addMinutes(time24: string, minutes: number): string {
  const [hStr, mStr] = time24.split(":");
  const total = Number(hStr) * 60 + Number(mStr) + minutes;
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  return `${pad(h)}:${pad(m)}`;
}

function dayLabel(target: Date, today: Date): string {
  const a = toKey(target);
  const tomorrow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  );
  if (a === toKey(today)) return "TODAY";
  if (a === toKey(tomorrow)) return "TOMORROW";
  return WEEKDAYS_FULL[target.getDay()];
}

function appointmentTone(a: Appointment): Tone {
  if (a.status === "cancelled" || a.status === "no_show") return "red";
  if (a.status === "completed") {
    if (a.outcome === "sold" || a.outcome === "deposit_taken") return "green";
    if (a.outcome === "lost") return "red";
    return "blue";
  }
  return "blue";
}

function maintenanceTone(j: MaintenanceJob): Tone {
  if (j.status === "stalled") return "red";
  if (j.status === "completed" || j.status === "in_progress") return "green";
  return "yellow";
}

function buildEvents(
  appts: Appointment[],
  jobs: MaintenanceJob[],
  vehicles: Map<string, Vehicle>,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const a of appts) {
    const v = vehicles.get(a.vehicleId);
    out.push({
      id: a.id,
      date: a.date,
      time: a.time,
      endTime: addMinutes(a.time, 60),
      title: a.customerName,
      subtitle: v ? `${v.registration} · ${v.make} ${v.model}` : null,
      tone: appointmentTone(a),
    });
  }
  for (const j of jobs) {
    if (!j.dueDate) continue;
    const v = vehicles.get(j.vehicleId);
    out.push({
      id: j.id,
      date: j.dueDate,
      time: null,
      endTime: null,
      title: j.description,
      subtitle: v ? `${v.registration} · ${v.make} ${v.model}` : null,
      tone: maintenanceTone(j),
    });
  }
  return out;
}

function groupByDate(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const m = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const arr = m.get(e.date) ?? [];
    arr.push(e);
    m.set(e.date, arr);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) =>
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99"),
    );
  }
  return m;
}

function uniqueTones(events: CalendarEvent[]): Tone[] {
  const seen = new Set<Tone>();
  const order: Tone[] = [];
  for (const e of events) {
    if (!seen.has(e.tone)) {
      seen.add(e.tone);
      order.push(e.tone);
      if (order.length === 3) break;
    }
  }
  return order;
}

function EventRow({ event }: { event: CalendarEvent }) {
  const t = TONE_STYLES[event.tone];
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-hidden rounded-[4px] py-1.5 pr-2 pl-1",
        t.card,
      )}
    >
      <div
        className={cn("h-9 w-[2.5px] shrink-0 rounded-full", t.bar)}
      />
      <div className="flex flex-1 items-start justify-between gap-2 min-w-0">
        <div className={cn("flex flex-col gap-1 min-w-0", t.title)}>
          <p className="truncate text-[13px] font-semibold leading-none">
            {event.title}
          </p>
          {event.subtitle ? (
            <p className="truncate text-[11px] font-medium leading-none">
              {event.subtitle}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex shrink-0 flex-col items-end gap-1 text-[11px] font-medium uppercase leading-none tabular-nums",
            t.time,
          )}
        >
          {event.time ? (
            <>
              <span>{fmtTime(event.time)}</span>
              {event.endTime ? <span>{fmtTime(event.endTime)}</span> : null}
            </>
          ) : (
            <span>All-day</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DaySection({
  date,
  today,
  events,
}: {
  date: Date;
  today: Date;
  events: CalendarEvent[];
}) {
  const isToday = toKey(date) === toKey(today);
  // Reset carousel position when the events list changes (new day selected)
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [events]);

  const safeIdx = events.length === 0 ? 0 : idx % events.length;
  const current = events[safeIdx];
  const hasMany = events.length > 1;

  function prev() {
    setIdx((i) => (i - 1 + events.length) % events.length);
  }
  function next() {
    setIdx((i) => (i + 1) % events.length);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1 text-[12px]">
          <span
            className={cn(
              "font-bold leading-5 tracking-wide",
              isToday ? "text-[var(--cal-blue-text)]" : "text-muted-foreground",
            )}
          >
            {dayLabel(date, today)}
          </span>
          <span className="font-normal leading-5 text-muted-foreground">
            {fmtDate(date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasMany ? (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous event"
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-3" />
              </button>
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                {safeIdx + 1} / {events.length}
              </span>
              <button
                type="button"
                onClick={next}
                aria-label="Next event"
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="size-3" />
              </button>
            </>
          ) : (
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {events.length === 0
                ? "No events"
                : `${events.length} event`}
            </span>
          )}
        </div>
      </div>
      {current ? <EventRow event={current} /> : null}
    </div>
  );
}

export function DashboardCalendar() {
  const { company } = useAuth();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [displayMonth, setDisplayMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const userPickedRef = useRef(false);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    void (async () => {
      const [appts, jobs, vehicles] = await Promise.all([
        appointmentService.getAll(company.id),
        maintenanceService.getAll(company.id),
        vehicleService.getAll(company.id),
      ]);
      if (cancelled) return;
      const map = new Map(vehicles.map((v) => [v.id, v]));
      const built = buildEvents(appts, jobs, map);
      setEvents(built);
      if (userPickedRef.current || built.length === 0) return;
      const todayKey = toKey(today);
      const sorted = [...built].sort((a, b) => a.date.localeCompare(b.date));
      const future = sorted.find((e) => e.date >= todayKey);
      const target = future ?? sorted[sorted.length - 1];
      const [yy, mm, dd] = target.date.split("-").map(Number);
      const next = new Date(yy, mm - 1, dd);
      if (toKey(next) !== todayKey) {
        setSelectedDate(next);
        setDisplayMonth(new Date(yy, mm - 1, 1));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [company, today]);

  const grouped = useMemo(() => groupByDate(events ?? []), [events]);

  const cells = useMemo(() => {
    const y = displayMonth.getFullYear();
    const m = displayMonth.getMonth();
    const firstWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrev = new Date(y, m, 0).getDate();
    const out: { date: Date; inMonth: boolean }[] = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      out.push({ date: new Date(y, m - 1, daysInPrev - i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ date: new Date(y, m, d), inMonth: true });
    }
    let next = 1;
    while (out.length < 42) {
      out.push({ date: new Date(y, m + 1, next), inMonth: false });
      next += 1;
    }
    return out;
  }, [displayMonth]);

  const dayAfter = useMemo(
    () =>
      new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate() + 1,
      ),
    [selectedDate],
  );

  const goPrev = () => {
    userPickedRef.current = true;
    setDisplayMonth(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1),
    );
  };
  const goNext = () => {
    userPickedRef.current = true;
    setDisplayMonth(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1),
    );
  };
  const goToday = () => {
    userPickedRef.current = true;
    setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };
  const handleDayClick = (date: Date) => {
    userPickedRef.current = true;
    setSelectedDate(date);
    if (
      date.getFullYear() !== displayMonth.getFullYear() ||
      date.getMonth() !== displayMonth.getMonth()
    ) {
      setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const selectedEvents = grouped.get(toKey(selectedDate)) ?? [];
  const dayAfterEvents = grouped.get(toKey(dayAfter)) ?? [];
  const loading = events === null;
  const isViewingThisMonth =
    displayMonth.getFullYear() === today.getFullYear() &&
    displayMonth.getMonth() === today.getMonth();

  return (
    <Card className="flex flex-col gap-4 p-4" size="sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-baseline gap-1 text-2xl leading-8 font-medium tracking-tight">
          <span className="text-foreground">
            {MONTHS[displayMonth.getMonth()]}
          </span>
          <span className="font-normal text-red-500">
            {displayMonth.getFullYear()}
          </span>
        </h2>
        <div className="flex items-center gap-1 text-muted-foreground">
          {!isViewingThisMonth ? (
            <button
              type="button"
              onClick={goToday}
              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-[var(--cal-blue-text)] transition-colors hover:bg-[var(--cal-today-surface)]"
            >
              Today
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Previous month"
            onClick={goPrev}
            className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={goNext}
            className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="flex flex-1 items-start justify-center p-1 text-center text-[10px] font-semibold leading-4 text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {Array.from({ length: 6 }).map((_, w) => (
          <div key={w} className="flex">
            {cells.slice(w * 7, w * 7 + 7).map((cell) => {
              const key = toKey(cell.date);
              const isToday = key === toKey(today);
              const isSelected = key === toKey(selectedDate);
              const dayEvents = grouped.get(key) ?? [];
              const tones = uniqueTones(dayEvents);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleDayClick(cell.date)}
                  aria-label={fmtDate(cell.date)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-md px-1 py-1.5 transition-colors",
                    !isSelected && "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold leading-none tabular-nums",
                      isSelected
                        ? "bg-[var(--cal-blue-bar)] text-white"
                        : isToday
                          ? "ring-1 ring-inset ring-[var(--cal-blue-bar)] text-[var(--cal-blue-text)]"
                          : cell.inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40",
                    )}
                  >
                    {cell.date.getDate()}
                  </span>
                  <div className="flex h-1 items-center gap-0.5">
                    {tones.length === 0 ? (
                      <span className="size-1" />
                    ) : (
                      tones.map((t, i) => (
                        <span
                          key={`${t}-${i}`}
                          className={cn("size-1 rounded-full", TONE_STYLES[t].dot)}
                        />
                      ))
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : (
          <DaySection
            date={selectedDate}
            today={today}
            events={selectedEvents}
          />
        )}
      </div>
    </Card>
  );
}
