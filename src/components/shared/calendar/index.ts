/**
 * Calendar barrel. `src/components/shared/week-calendar.tsx` re-exports this so
 * existing `@/components/shared/week-calendar` import paths keep working.
 */

export type {
  CalendarTone,
  CalendarViewMode,
  WeekCalendarEvent,
  EventKind,
  EventDraft,
  SlotSelectHandler,
  EventMoveHandler,
  CalendarProps,
} from "./types";
export { TONE_CLASSES, TONE_VAR, type ToneClasses } from "./tone";
export { Calendar, WeekCalendar } from "./calendar";
export {
  CalendarToolbar,
  CalendarViewSwitcher,
  CalendarFilterChip,
} from "./calendar-toolbar";
