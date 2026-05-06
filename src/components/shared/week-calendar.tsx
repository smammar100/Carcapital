"use client";

import { useMemo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { VehicleImage } from "./vehicle-image";

export type CalendarTone =
  | "blue"
  | "purple"
  | "amber"
  | "emerald"
  | "rose"
  | "slate";

export type CalendarViewMode = "daily" | "weekly" | "monthly";

export interface WeekCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  tone: CalendarTone;
  meta?: string;
  icon?: string;
  href?: string;
  vehicleId?: string;
  vehicleRegistration?: string;
}

const RICH_CARD_MIN_HEIGHT = 128;

const WEEKDAYS_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_LONG = [
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

const TONE_STYLES: Record<
  CalendarTone,
  { bar: string; bg: string; text: string; chip: string }
> = {
  blue: {
    bar: "bg-[#0ea5e9]",
    bg: "bg-[rgba(14,165,233,0.1)]",
    text: "text-[#0369a1]",
    chip: "bg-[#0ea5e9]",
  },
  purple: {
    bar: "bg-[#a855f7]",
    bg: "bg-[rgba(168,85,247,0.1)]",
    text: "text-[#6b21a8]",
    chip: "bg-[#a855f7]",
  },
  amber: {
    bar: "bg-[#f59e0b]",
    bg: "bg-[rgba(245,158,11,0.1)]",
    text: "text-[#92400e]",
    chip: "bg-[#f59e0b]",
  },
  emerald: {
    bar: "bg-[#10b981]",
    bg: "bg-[rgba(16,185,129,0.1)]",
    text: "text-[#065f46]",
    chip: "bg-[#10b981]",
  },
  rose: {
    bar: "bg-[#f43f5e]",
    bg: "bg-[rgba(244,63,94,0.1)]",
    text: "text-[#9f1239]",
    chip: "bg-[#f43f5e]",
  },
  slate: {
    bar: "bg-[#64748b]",
    bg: "bg-[rgba(100,116,139,0.1)]",
    text: "text-[#334155]",
    chip: "bg-[#64748b]",
  },
};

const HOUR_HEIGHT = 64;
const TIME_COL_W = 64;

function startOfWeekSunday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

function formatEventTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${period}`;
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthLabel(view: CalendarViewMode, date: Date): {
  primary: string;
  secondary: string;
} {
  if (view === "daily") {
    return {
      primary: `${WEEKDAYS_LONG[date.getDay()]}, ${MONTHS_LONG[date.getMonth()]} ${date.getDate()}`,
      secondary: String(date.getFullYear()),
    };
  }
  if (view === "weekly") {
    const start = startOfWeekSunday(date);
    const end = addDays(start, 6);
    if (start.getMonth() === end.getMonth()) {
      return {
        primary: MONTHS_LONG[start.getMonth()],
        secondary: String(start.getFullYear()),
      };
    }
    return {
      primary: `${MONTHS_SHORT[start.getMonth()]} – ${MONTHS_SHORT[end.getMonth()]}`,
      secondary:
        start.getFullYear() === end.getFullYear()
          ? String(start.getFullYear())
          : `${start.getFullYear()}/${end.getFullYear()}`,
    };
  }
  return {
    primary: MONTHS_LONG[date.getMonth()],
    secondary: String(date.getFullYear()),
  };
}

function stepDate(view: CalendarViewMode, date: Date, dir: -1 | 1): Date {
  if (view === "daily") return addDays(date, dir);
  if (view === "weekly") return addDays(date, dir * 7);
  return addMonths(date, dir);
}

// ============================================================
// CalendarToolbar — month label + chevrons + view switcher + slot
// ============================================================

interface CalendarToolbarProps {
  view: CalendarViewMode;
  onViewChange: (v: CalendarViewMode) => void;
  currentDate: Date;
  onCurrentDateChange: (d: Date) => void;
  rightSlot?: ReactNode;
}

export function CalendarToolbar({
  view,
  onViewChange,
  currentDate,
  onCurrentDateChange,
  rightSlot,
}: CalendarToolbarProps) {
  const label = getMonthLabel(view, currentDate);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="flex items-baseline gap-1.5 text-h3 leading-none">
          <span className="text-foreground">{label.primary}</span>
          <span className="font-normal text-muted-foreground">
            {label.secondary}
          </span>
        </h3>
        <div className="flex items-center text-muted-foreground">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => onCurrentDateChange(stepDate(view, currentDate, -1))}
            className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => onCurrentDateChange(stepDate(view, currentDate, 1))}
            className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <CalendarViewSwitcher value={view} onChange={onViewChange} />
      </div>
      {rightSlot ? (
        <div className="flex flex-wrap items-center gap-2">{rightSlot}</div>
      ) : null}
    </div>
  );
}

export function CalendarViewSwitcher({
  value,
  onChange,
}: {
  value: CalendarViewMode;
  onChange: (v: CalendarViewMode) => void;
}) {
  const options: CalendarViewMode[] = ["daily", "weekly", "monthly"];
  const labels: Record<CalendarViewMode, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };
  return (
    <div className="inline-flex items-center rounded-full bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === opt
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export function CalendarFilterChip({
  checked,
  onChange,
  label,
  dotClass,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  dotClass: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        checked
          ? "border-foreground/15 bg-background text-foreground"
          : "border-transparent bg-muted text-muted-foreground line-through",
      )}
    >
      <span className={cn("size-2 rounded-full", dotClass)} />
      {label}
    </button>
  );
}

// ============================================================
// Calendar — daily / weekly / monthly grid
// ============================================================

interface CalendarProps {
  view: CalendarViewMode;
  events: WeekCalendarEvent[];
  currentDate: Date;
  onCurrentDateChange?: (d: Date) => void;
  onSelectEvent?: (e: WeekCalendarEvent) => void;
  startHour?: number;
  endHour?: number;
  timezoneLabel?: string;
  timezoneOffset?: string;
}

export function Calendar(props: CalendarProps) {
  if (props.view === "monthly") return <MonthGrid {...props} />;
  return <TimeGrid {...props} />;
}

// Backward-compatible export — pages can keep importing WeekCalendar
export function WeekCalendar(props: Omit<CalendarProps, "view">) {
  return <Calendar view="weekly" {...props} />;
}

// ============================================================
// Daily / Weekly time grid
// ============================================================

function TimeGrid({
  view,
  events,
  currentDate,
  onSelectEvent,
  startHour = 7,
  endHour = 18,
  timezoneLabel = "GMT",
  timezoneOffset = "GMT+0",
}: CalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const isWeekly = view === "weekly";

  const days = useMemo(() => {
    if (isWeekly) {
      const start = startOfWeekSunday(currentDate);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return [startOfDay(currentDate)];
  }, [isWeekly, currentDate]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h <= endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, WeekCalendarEvent[]>();
    for (const d of days) map.set(toKey(d), []);
    for (const e of events) {
      const k = toKey(e.start);
      const arr = map.get(k);
      if (arr) arr.push(e);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    return map;
  }, [events, days]);

  const totalGridHeight = hours.length * HOUR_HEIGHT;
  const gridTemplateCols = `${TIME_COL_W}px repeat(${days.length}, minmax(0, 1fr)) ${TIME_COL_W}px`;

  return (
    <div className="flex flex-col">
      {/* Day header row */}
      <div
        className="grid"
        style={{ gridTemplateColumns: gridTemplateCols }}
      >
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={toKey(d)}
              className={cn(
                "border-l px-3 py-2.5",
                isToday && "bg-[#eff8fe]",
              )}
            >
              <div
                className={cn(
                  "text-[10px] font-semibold tracking-[0.08em] uppercase",
                  isToday ? "text-[#0369a1]" : "text-muted-foreground",
                )}
              >
                {WEEKDAYS_SHORT[d.getDay()]}
              </div>
              <div
                className={cn(
                  "text-h3 leading-none mt-0.5 tabular-nums",
                  isToday ? "text-[#0369a1]" : "text-foreground",
                )}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
        <div className="border-l px-2 py-2.5 text-[10px] leading-tight text-muted-foreground">
          {timezoneLabel}
          <br />
          {timezoneOffset}
        </div>
      </div>

      {/* Time grid */}
      <div
        className="grid border-t"
        style={{
          gridTemplateColumns: gridTemplateCols,
          gridTemplateRows: `${totalGridHeight}px`,
        }}
      >
        <div className="relative">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground"
              style={{ top: i * HOUR_HEIGHT }}
            >
              {formatHourLabel(h)}
            </div>
          ))}
        </div>

        {days.map((d) => {
          const isToday = isSameDay(d, today);
          const dayEvents = eventsByDay.get(toKey(d)) ?? [];
          return (
            <div
              key={toKey(d)}
              className={cn(
                "relative border-l",
                isToday && "bg-[#eff8fe]/60",
              )}
              style={{ height: totalGridHeight }}
            >
              {hours.map((h, i) =>
                i === 0 ? null : (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-border"
                    style={{ top: i * HOUR_HEIGHT }}
                  />
                ),
              )}
              {dayEvents.map((e) => (
                <EventBlock
                  key={e.id}
                  event={e}
                  startHour={startHour}
                  endHour={endHour}
                  onClick={() => onSelectEvent?.(e)}
                />
              ))}
            </div>
          );
        })}

        <div className="relative border-l">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute left-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground"
              style={{ top: i * HOUR_HEIGHT }}
            >
              {formatHourLabel(h)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventBlock({
  event,
  startHour,
  endHour,
  onClick,
}: {
  event: WeekCalendarEvent;
  startHour: number;
  endHour: number;
  onClick?: () => void;
}) {
  const startMinutes =
    event.start.getHours() * 60 + event.start.getMinutes();
  const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
  const gridStartMinutes = startHour * 60;
  const gridEndMinutes = (endHour + 1) * 60;

  const visibleStart = Math.max(startMinutes, gridStartMinutes);
  const visibleEnd = Math.min(endMinutes, gridEndMinutes);
  if (visibleEnd <= visibleStart) return null;

  const top = ((visibleStart - gridStartMinutes) / 60) * HOUR_HEIGHT;
  const height = Math.max(
    24,
    ((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT,
  );

  const t = TONE_STYLES[event.tone];
  const isRich =
    height >= RICH_CARD_MIN_HEIGHT &&
    !!event.vehicleId &&
    !!event.vehicleRegistration;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute inset-x-0.5 flex items-stretch overflow-hidden rounded-[4px] text-left transition-opacity hover:opacity-90",
        t.bg,
      )}
      style={{ top, height }}
    >
      <div className={cn("w-[3px] shrink-0", t.bar)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-1.5">
        <div
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium leading-none tabular-nums",
            t.text,
          )}
        >
          <span>{formatEventTime(event.start)}</span>
        </div>
        <div
          className={cn(
            "truncate text-[12px] leading-[15px] font-medium",
            t.text,
          )}
        >
          {event.icon ? <span className="mr-1">{event.icon}</span> : null}
          {event.title}
        </div>
        {event.meta ? (
          <div
            className={cn(
              "truncate text-[11px] leading-tight opacity-80",
              t.text,
            )}
          >
            {event.meta}
          </div>
        ) : null}
        {isRich ? (
          <div className="mt-1 flex-1 min-h-0 overflow-hidden rounded-sm">
            <VehicleImage
              vehicle={{
                id: event.vehicleId!,
                registration: event.vehicleRegistration!,
                heroImageUrl: null,
              }}
              variant="card"
              className="!aspect-auto !w-full h-full"
            />
          </div>
        ) : null}
      </div>
    </button>
  );
}

// ============================================================
// Monthly grid
// ============================================================

function MonthGrid({
  events,
  currentDate,
  onCurrentDateChange,
  onSelectEvent,
}: CalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const monthStart = startOfMonth(currentDate);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
  const daysInPrev = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    0,
  ).getDate();

  const cells = useMemo(() => {
    const out: { date: Date; inMonth: boolean }[] = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() - 1,
        daysInPrev - i,
      );
      out.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({
        date: new Date(monthStart.getFullYear(), monthStart.getMonth(), d),
        inMonth: true,
      });
    }
    let next = 1;
    while (out.length < 42) {
      out.push({
        date: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, next),
        inMonth: false,
      });
      next += 1;
    }
    return out;
  }, [monthStart, firstWeekday, daysInMonth, daysInPrev]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, WeekCalendarEvent[]>();
    for (const e of events) {
      const k = toKey(e.start);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    return map;
  }, [events]);

  const rows = Math.ceil(cells.length / 7);

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-7">
        {WEEKDAYS_SHORT.map((d) => (
          <div
            key={d}
            className="border-l px-3 py-2.5 text-[10px] font-semibold tracking-[0.08em] uppercase text-muted-foreground first:border-l-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-t">
        {Array.from({ length: rows }).map((_, r) =>
          cells.slice(r * 7, r * 7 + 7).map((cell) => {
            const isToday = isSameDay(cell.date, today);
            const dayEvents = eventsByDay.get(toKey(cell.date)) ?? [];
            const visible = dayEvents.slice(0, 3);
            const hidden = dayEvents.length - visible.length;
            return (
              <button
                type="button"
                key={toKey(cell.date)}
                onClick={() => onCurrentDateChange?.(cell.date)}
                className={cn(
                  "flex min-h-[110px] flex-col items-stretch gap-1 border-l border-t p-1.5 text-left transition-colors first:border-l-0",
                  isToday && "bg-[#eff8fe]",
                  !cell.inMonth && "bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "text-[12px] font-semibold leading-none tabular-nums",
                    isToday
                      ? "text-[#0369a1]"
                      : cell.inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60",
                  )}
                >
                  {cell.date.getDate()}
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  {visible.map((e) => {
                    const t = TONE_STYLES[e.tone];
                    return (
                      <button
                        type="button"
                        key={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectEvent?.(e);
                        }}
                        className={cn(
                          "flex items-center gap-1 overflow-hidden rounded-[3px] px-1.5 py-0.5 text-left",
                          t.bg,
                        )}
                      >
                        <span className={cn("size-1.5 shrink-0 rounded-full", t.chip)} />
                        <span
                          className={cn(
                            "truncate text-[10px] font-medium leading-tight",
                            t.text,
                          )}
                        >
                          <span className="mr-1 tabular-nums">
                            {formatEventTime(e.start)
                              .replace(":00", "")
                              .replace(" ", "")
                              .toLowerCase()}
                          </span>
                          {e.title}
                        </span>
                      </button>
                    );
                  })}
                  {hidden > 0 ? (
                    <span className="px-1.5 text-[10px] font-medium text-muted-foreground">
                      +{hidden} more
                    </span>
                  ) : null}
                </div>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
