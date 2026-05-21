"use client";

import type { CalendarProps } from "./types";
import { TimeGrid } from "./time-grid";
import { MonthGrid } from "./month-grid";

/**
 * Calendar grid — switches between the daily/weekly time grid and the monthly
 * grid. Presentational only: persistence is the caller's responsibility via
 * `onSelectEvent` / `onSlotSelect` / `onEventMove`.
 */
export function Calendar(props: CalendarProps) {
  if (props.view === "monthly") return <MonthGrid {...props} />;
  return <TimeGrid {...props} />;
}

/** Back-compat alias — renders the weekly view. */
export function WeekCalendar(props: Omit<CalendarProps, "view">) {
  return <Calendar view="weekly" {...props} />;
}
