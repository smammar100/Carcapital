"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { VehicleImage } from "../vehicle-image";
import type { CalendarProps, WeekCalendarEvent } from "./types";
import { TONE_CLASSES } from "./tone";
import {
  HOUR_HEIGHT,
  TIME_COL_W,
  WEEKDAYS_SHORT,
  addDays,
  formatEventTime,
  formatEventTimeShort,
  formatHourLabel,
  isSameDay,
  startOfDay,
  startOfWeekSunday,
  toKey,
} from "./date-utils";
import { minutesOfDay, useNow } from "./use-now-indicator";
import { useGridDrag, type DragDraft } from "./use-grid-drag";

const RICH_CARD_MIN_HEIGHT = 128;

/**
 * Hard cap on side-by-side lanes per day. Beyond this, overflow events are
 * placed back into the lane with the earliest-ending occupant so the other
 * lanes stay readable. Real usage should rarely hit this.
 */
const MAX_LANES = 3;

type LaidOutEvent = { event: WeekCalendarEvent; lane: number; lanes: number };

/**
 * Assign each event in a day a `lane` (0-indexed) and `lanes` (total lanes in
 * its overlap cluster) so overlapping events render side-by-side. Input must
 * be sorted by start ascending.
 */
function computeLanesForDay(sorted: WeekCalendarEvent[]): LaidOutEvent[] {
  type Cluster = { events: WeekCalendarEvent[]; lanes: WeekCalendarEvent[][] };
  const clusters: Cluster[] = [];
  const laneByEvent = new Map<string, number>();

  for (const e of sorted) {
    let cluster = clusters.find((c) =>
      c.events.some(
        (ce) =>
          ce.start.getTime() < e.end.getTime() &&
          ce.end.getTime() > e.start.getTime(),
      ),
    );
    if (!cluster) {
      cluster = { events: [], lanes: [] };
      clusters.push(cluster);
    }
    cluster.events.push(e);

    let laneIdx = -1;
    for (let i = 0; i < cluster.lanes.length; i++) {
      const lane = cluster.lanes[i];
      const last = lane[lane.length - 1];
      if (last.end.getTime() <= e.start.getTime()) {
        lane.push(e);
        laneIdx = i;
        break;
      }
    }
    if (laneIdx === -1) {
      if (cluster.lanes.length < MAX_LANES) {
        cluster.lanes.push([e]);
        laneIdx = cluster.lanes.length - 1;
      } else {
        let bestIdx = 0;
        let bestEnd =
          cluster.lanes[0][cluster.lanes[0].length - 1].end.getTime();
        for (let i = 1; i < cluster.lanes.length; i++) {
          const lastEnd =
            cluster.lanes[i][cluster.lanes[i].length - 1].end.getTime();
          if (lastEnd < bestEnd) {
            bestEnd = lastEnd;
            bestIdx = i;
          }
        }
        cluster.lanes[bestIdx].push(e);
        laneIdx = bestIdx;
      }
    }
    laneByEvent.set(e.id, laneIdx);
  }

  const result: LaidOutEvent[] = [];
  for (const cluster of clusters) {
    const lanesCount = cluster.lanes.length;
    for (const e of cluster.events) {
      result.push({
        event: e,
        lane: laneByEvent.get(e.id) ?? 0,
        lanes: lanesCount,
      });
    }
  }
  return result;
}

/** "9:30 AM" from minutes-past-midnight. */
function minuteLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${period}`;
}

// ────────────────────────────────────────────────────────────────────────────
// EventBlock — a timed event positioned absolutely inside a day column
// ────────────────────────────────────────────────────────────────────────────

function EventBlock({
  event,
  lane,
  lanes,
  startHour,
  endHour,
  dimmed,
  onClick,
  onPointerDown,
}: {
  event: WeekCalendarEvent;
  lane: number;
  lanes: number;
  startHour: number;
  endHour: number;
  dimmed?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
  const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
  const gridStartMinutes = startHour * 60;
  const gridEndMinutes = (endHour + 1) * 60;

  const visibleStart = Math.max(startMinutes, gridStartMinutes);
  const visibleEnd = Math.min(endMinutes, gridEndMinutes);
  if (visibleEnd <= visibleStart) return null;

  const top = ((visibleStart - gridStartMinutes) / 60) * HOUR_HEIGHT;
  const height = Math.max(24, ((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT);

  const widthPct = 100 / Math.max(1, lanes);
  const leftPct = widthPct * lane;

  const t = TONE_CLASSES[event.tone];
  const narrow = lanes > 1;
  const isRich =
    !narrow &&
    height >= RICH_CARD_MIN_HEIGHT &&
    !!event.vehicleId &&
    !!event.vehicleRegistration;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        "group/event absolute flex touch-none select-none items-stretch overflow-hidden text-left",
        "ring-1 ring-inset ring-transparent transition",
        "hover:z-10 hover:shadow-md active:cursor-grabbing",
        narrow ? "rounded-[3px]" : "rounded-md",
        t.surface,
        dimmed && "opacity-40",
      )}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
    >
      <div className={cn(narrow ? "w-[2px]" : "w-[3px]", "shrink-0", t.bar)} />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-0.5",
          narrow ? "px-1 py-0.5" : "p-1.5",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-1 whitespace-nowrap leading-none tabular-nums",
            narrow ? "text-[10px] font-semibold" : "text-[11px] font-medium",
            t.text,
          )}
        >
          <span>{formatEventTime(event.start)}</span>
        </div>
        <div
          className={cn(
            "truncate font-medium",
            narrow
              ? "text-[11px] leading-tight"
              : "text-[12px] leading-[15px]",
            t.text,
          )}
        >
          {!narrow && event.icon ? (
            <span className="mr-1">{event.icon}</span>
          ) : null}
          {event.title}
        </div>
        {!narrow && event.meta ? (
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
          <div className="mt-1 min-h-0 flex-1 overflow-hidden rounded-sm">
            <VehicleImage
              vehicle={{
                id: event.vehicleId!,
                registration: event.vehicleRegistration!,
                heroImageUrl: null,
              }}
              variant="card"
              className="!aspect-auto h-full !w-full"
            />
          </div>
        ) : null}
      </div>
    </button>
  );
}

/** Translucent block shown under the pointer during a create / move drag. */
function GhostBlock({
  draft,
  startHour,
  tone,
}: {
  draft: DragDraft;
  startHour: number;
  tone: WeekCalendarEvent["tone"] | null;
}) {
  const gridStartMin = startHour * 60;
  const top = ((draft.startMin - gridStartMin) / 60) * HOUR_HEIGHT;
  const height = Math.max(
    18,
    ((draft.endMin - draft.startMin) / 60) * HOUR_HEIGHT,
  );
  const t = tone ? TONE_CLASSES[tone] : null;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-md",
        draft.mode === "create"
          ? "border-2 border-dashed border-[var(--cal-blue-bar)] bg-[var(--cal-blue-surface)]"
          : cn("opacity-80 shadow-lg ring-1 ring-inset ring-black/10", t?.surface),
      )}
      style={{ top, height }}
    >
      <div
        className={cn(
          "px-1.5 py-0.5 text-[10px] font-semibold leading-tight tabular-nums",
          draft.mode === "create" ? "text-[var(--cal-blue-text)]" : t?.text,
        )}
      >
        {minuteLabel(draft.startMin)} – {minuteLabel(draft.endMin)}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Compact event row — used inside the "+N more" popover
// ────────────────────────────────────────────────────────────────────────────

export function EventListRow({
  event,
  onClick,
}: {
  event: WeekCalendarEvent;
  onClick?: () => void;
}) {
  const t = TONE_CLASSES[event.tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", t.chip)} />
      {!event.allDay ? (
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
          {formatEventTimeShort(event.start)}
        </span>
      ) : null}
      <span className="truncate text-xs font-medium text-foreground">
        {event.title}
      </span>
    </button>
  );
}

export function MoreEventsPopover({
  label,
  events,
  onSelectEvent,
}: {
  label: string;
  events: WeekCalendarEvent[];
  onSelectEvent?: (e: WeekCalendarEvent) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {events.map((e) => (
            <EventListRow
              key={e.id}
              event={e}
              onClick={() => onSelectEvent?.(e)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// All-day band — collapsible row above the time grid
// ────────────────────────────────────────────────────────────────────────────

function AllDayPill({
  event,
  dimmed,
  ghost,
  onClick,
  onPointerDown,
}: {
  event: WeekCalendarEvent;
  dimmed?: boolean;
  ghost?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const t = TONE_CLASSES[event.tone];
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        "flex w-full touch-none select-none items-center gap-1 overflow-hidden rounded-[3px] py-0.5 pr-1.5 text-left transition hover:shadow-sm",
        t.surface,
        dimmed && "opacity-40",
        ghost && "pointer-events-none opacity-80 shadow-lg ring-1 ring-inset ring-black/10",
      )}
    >
      <span className={cn("h-3.5 w-[3px] shrink-0 rounded-full", t.bar)} />
      {event.icon ? (
        <span className="shrink-0 text-[10px] leading-none">{event.icon}</span>
      ) : null}
      <span className={cn("truncate text-[11px] font-medium", t.text)}>
        {event.title}
      </span>
    </button>
  );
}

function AllDayBand({
  days,
  today,
  eventsByDay,
  gridTemplateCols,
  draft,
  onSelectEvent,
  onPillPointerDown,
}: {
  days: Date[];
  today: Date;
  eventsByDay: Map<string, WeekCalendarEvent[]>;
  gridTemplateCols: string;
  draft: DragDraft | null;
  onSelectEvent?: (e: WeekCalendarEvent) => void;
  onPillPointerDown: (
    e: WeekCalendarEvent,
    dayIndex: number,
    ev: React.PointerEvent,
  ) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const visibleCount = collapsed ? 1 : 3;
  const movingId =
    draft?.mode === "move" && draft.allDay ? draft.eventId : undefined;
  const movingEvent = movingId
    ? [...eventsByDay.values()].flat().find((e) => e.id === movingId)
    : undefined;

  return (
    <div
      className="grid border-b bg-muted/20"
      style={{ gridTemplateColumns: gridTemplateCols }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-end gap-1 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
        title={collapsed ? "Expand all-day" : "Collapse all-day"}
      >
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            collapsed && "-rotate-90",
          )}
        />
        All day
      </button>
      {days.map((d, i) => {
        const items = eventsByDay.get(toKey(d)) ?? [];
        const visible = items.slice(0, visibleCount);
        const hidden = items.length - visible.length;
        return (
          <div
            key={toKey(d)}
            className={cn(
              "flex min-h-[32px] flex-col gap-0.5 border-l p-1",
              isSameDay(d, today) && "bg-[var(--cal-today-surface)]",
            )}
          >
            {visible.map((e) => (
              <AllDayPill
                key={e.id}
                event={e}
                dimmed={e.id === movingId}
                onPointerDown={(ev) => onPillPointerDown(e, i, ev)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectEvent?.(e);
                }}
              />
            ))}
            {hidden > 0 ? (
              <MoreEventsPopover
                label={`+${hidden} more`}
                events={items}
                onSelectEvent={onSelectEvent}
              />
            ) : null}
            {movingEvent && draft?.dayIndex === i ? (
              <AllDayPill event={movingEvent} ghost />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TimeGrid — daily / weekly view
// ────────────────────────────────────────────────────────────────────────────

export function TimeGrid({
  view,
  events,
  currentDate,
  onSelectEvent,
  onSlotSelect,
  onEventMove,
  startHour = 8,
  endHour = 18,
  timezoneOffset = "GMT+0",
}: CalendarProps) {
  const now = useNow();
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

  const drag = useGridDrag({ days, startHour, endHour, onSlotSelect, onEventMove });

  const timedByDay = useMemo(() => {
    const map = new Map<string, LaidOutEvent[]>();
    const buckets = new Map<string, WeekCalendarEvent[]>();
    for (const d of days) {
      map.set(toKey(d), []);
      buckets.set(toKey(d), []);
    }
    for (const e of events) {
      if (e.allDay) continue;
      const arr = buckets.get(toKey(e.start));
      if (arr) arr.push(e);
    }
    for (const [k, arr] of buckets) {
      arr.sort((a, b) => a.start.getTime() - b.start.getTime());
      map.set(k, computeLanesForDay(arr));
    }
    return map;
  }, [events, days]);

  const allDayByDay = useMemo(() => {
    const map = new Map<string, WeekCalendarEvent[]>();
    for (const d of days) map.set(toKey(d), []);
    for (const e of events) {
      if (!e.allDay) continue;
      const arr = map.get(toKey(e.start));
      if (arr) arr.push(e);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [events, days]);

  // Only show the all-day band when the *visible* week actually has all-day
  // events — an empty band is just dead space.
  const hasAllDay = useMemo(
    () => Array.from(allDayByDay.values()).some((arr) => arr.length > 0),
    [allDayByDay],
  );

  const totalGridHeight = hours.length * HOUR_HEIGHT;
  const gridTemplateCols = `${TIME_COL_W}px repeat(${days.length}, minmax(0, 1fr))`;

  const nowMin = minutesOfDay(now);
  const gridStartMin = startHour * 60;
  const nowVisible = nowMin >= gridStartMin && nowMin <= (endHour + 1) * 60;
  const nowTop = ((nowMin - gridStartMin) / 60) * HOUR_HEIGHT;

  const { draft } = drag;
  const moveTone =
    draft?.mode === "move"
      ? events.find((e) => e.id === draft.eventId)?.tone ?? null
      : null;

  return (
    <div className="flex flex-col">
      {/* Day header row */}
      <div
        className="grid border-b"
        style={{ gridTemplateColumns: gridTemplateCols }}
      >
        <div className="self-center px-2 py-1 text-right text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-muted-foreground">
          {timezoneOffset}
        </div>
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={toKey(d)}
              className={cn(
                "border-l px-3 py-1.5",
                isToday && "bg-[var(--cal-today-surface)]",
              )}
            >
              <div
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.08em]",
                  isToday
                    ? "text-[var(--cal-blue-text)]"
                    : "text-muted-foreground",
                )}
              >
                {WEEKDAYS_SHORT[d.getDay()]}
              </div>
              <div className="mt-0.5 flex">
                <span
                  className={cn(
                    "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-base leading-none tabular-nums",
                    isToday
                      ? "bg-[var(--cal-blue-bar)] font-semibold text-white"
                      : "font-medium text-foreground",
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day band */}
      {hasAllDay ? (
        <AllDayBand
          days={days}
          today={today}
          eventsByDay={allDayByDay}
          gridTemplateCols={gridTemplateCols}
          draft={draft}
          onSelectEvent={onSelectEvent}
          onPillPointerDown={drag.startMove}
        />
      ) : null}

      {/* Time grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: gridTemplateCols,
          gridTemplateRows: `${totalGridHeight}px`,
        }}
      >
        {/* Hour rail */}
        <div className="relative">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-2 text-[10px] font-medium text-muted-foreground"
              style={{ top: i * HOUR_HEIGHT + 4 }}
            >
              {formatHourLabel(h)}
            </div>
          ))}
          {nowVisible ? (
            <div
              className="absolute right-1.5 z-20 -translate-y-1/2 rounded bg-[var(--cal-now)] px-1 py-px text-[9px] font-semibold tabular-nums text-white"
              style={{ top: nowTop }}
            >
              {formatEventTimeShort(now)}
            </div>
          ) : null}
        </div>

        {/* Day columns */}
        {days.map((d, dayIndex) => {
          const isToday = isSameDay(d, today);
          const dayEvents = timedByDay.get(toKey(d)) ?? [];
          return (
            <div
              key={toKey(d)}
              ref={drag.registerColumn(dayIndex)}
              onPointerDown={(e) => drag.startCreate(dayIndex, e)}
              onClick={(e) => drag.clickCreate(dayIndex, e)}
              className={cn(
                "relative cursor-cell border-l",
                isToday && "bg-[var(--cal-today-surface)]",
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
              {dayEvents.map(({ event, lane, lanes }) => (
                <EventBlock
                  key={event.id}
                  event={event}
                  lane={lane}
                  lanes={lanes}
                  startHour={startHour}
                  endHour={endHour}
                  dimmed={draft?.mode === "move" && draft.eventId === event.id}
                  onPointerDown={(e) => drag.startMove(event, dayIndex, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent?.(event);
                  }}
                />
              ))}
              {draft && draft.dayIndex === dayIndex && !draft.allDay ? (
                <GhostBlock draft={draft} startHour={startHour} tone={moveTone} />
              ) : null}
              {isToday && nowVisible ? (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                  style={{ top: nowTop }}
                >
                  <span className="size-2.5 -translate-x-1/2 rounded-full bg-[var(--cal-now)]" />
                  <span className="h-[2px] flex-1 bg-[var(--cal-now)]" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
