/**
 * Shared calendar types. `week-calendar.tsx` re-exports these via the barrel so
 * existing `@/components/shared/week-calendar` imports keep working.
 */

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
  /**
   * All-day events render in the all-day band (week/day views) and as
   * time-less chips (month view) instead of being positioned in the time grid.
   */
  allDay?: boolean;
}

/** Kinds of event the calendar pages can create. */
export type EventKind = "appointment" | "workshop" | "maintenance";

/**
 * Lightweight create-intent emitted by click-empty-slot / drag-to-create and
 * carried from the quick-create popover into the full Add-Event sheet.
 */
export interface EventDraft {
  kind: EventKind;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** HH:mm */
  fromTime: string;
  /** HH:mm */
  toTime: string;
  allDay: boolean;
}

/**
 * Fired by click-empty-slot and drag-to-create on the time grid. `allDay` is
 * true when the gesture started in the all-day band.
 */
export type SlotSelectHandler = (
  start: Date,
  end: Date,
  allDay: boolean,
) => void;

/**
 * Fired by drag-to-move (reschedule). All-day moves carry 00:00 start/end on
 * the new day; the page maps the event back to its entity and persists.
 */
export type EventMoveHandler = (
  event: WeekCalendarEvent,
  newStart: Date,
  newEnd: Date,
) => void;

/** Props shared by the `Calendar` switch and its daily/weekly/monthly grids. */
export interface CalendarProps {
  view: CalendarViewMode;
  events: WeekCalendarEvent[];
  currentDate: Date;
  onCurrentDateChange?: (d: Date) => void;
  onSelectEvent?: (e: WeekCalendarEvent) => void;
  /** Click-empty-slot / drag-to-create (time grid only). */
  onSlotSelect?: SlotSelectHandler;
  /** Drag-to-move an existing event (reschedule). */
  onEventMove?: EventMoveHandler;
  startHour?: number;
  endHour?: number;
  timezoneLabel?: string;
  timezoneOffset?: string;
}
