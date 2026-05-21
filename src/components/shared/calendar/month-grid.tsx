"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CalendarProps, WeekCalendarEvent } from "./types";
import { TONE_CLASSES } from "./tone";
import {
  WEEKDAYS_SHORT,
  formatEventTimeShort,
  isSameDay,
  startOfDay,
  startOfMonth,
  toKey,
} from "./date-utils";
import { MoreEventsPopover } from "./time-grid";

function MonthEventChip({
  event,
  onClick,
}: {
  event: WeekCalendarEvent;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const t = TONE_CLASSES[event.tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 overflow-hidden rounded-[3px] px-1.5 py-0.5 text-left transition hover:shadow-sm",
        t.surface,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", t.chip)} />
      <span
        className={cn(
          "truncate text-[10px] font-medium leading-tight",
          t.text,
        )}
      >
        {!event.allDay ? (
          <span className="mr-1 tabular-nums">
            {formatEventTimeShort(event.start)}
          </span>
        ) : null}
        {event.title}
      </span>
    </button>
  );
}

export function MonthGrid({
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
      out.push({
        date: new Date(
          monthStart.getFullYear(),
          monthStart.getMonth() - 1,
          daysInPrev - i,
        ),
        inMonth: false,
      });
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
        date: new Date(
          monthStart.getFullYear(),
          monthStart.getMonth() + 1,
          next,
        ),
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
      // All-day events first, then timed ascending.
      arr.sort((a, b) => {
        if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
        return a.start.getTime() - b.start.getTime();
      });
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
            className="border-l px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground first:border-l-0"
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
              <div
                role="button"
                tabIndex={0}
                key={toKey(cell.date)}
                onClick={() => onCurrentDateChange?.(cell.date)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCurrentDateChange?.(cell.date);
                  }
                }}
                className={cn(
                  "flex min-h-[112px] cursor-pointer flex-col items-stretch gap-1 border-l border-t p-1.5 text-left transition-colors first:border-l-0 hover:bg-muted/40",
                  isToday && "bg-[var(--cal-today-surface)] hover:bg-[var(--cal-today-surface)]",
                  !cell.inMonth && "bg-muted/30",
                )}
              >
                <div className="flex">
                  <span
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none tabular-nums",
                      isToday
                        ? "bg-[var(--cal-blue-bar)] text-white"
                        : cell.inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50",
                    )}
                  >
                    {cell.date.getDate()}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  {visible.map((e) => (
                    <MonthEventChip
                      key={e.id}
                      event={e}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectEvent?.(e);
                      }}
                    />
                  ))}
                  {hidden > 0 ? (
                    <div onClick={(ev) => ev.stopPropagation()}>
                      <MoreEventsPopover
                        label={`+${hidden} more`}
                        events={dayEvents}
                        onSelectEvent={onSelectEvent}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
