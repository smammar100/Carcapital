/** Date / time helpers shared by the calendar grid components. */

import type { CalendarViewMode } from "./types";

/** Pixel height of one hour row in the daily/weekly time grid. */
export const HOUR_HEIGHT = 64;
/** Width of the left time-axis gutter column. */
export const TIME_COL_W = 64;

export const WEEKDAYS_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const MONTHS_SHORT = [
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
export const MONTHS_LONG = [
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

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function startOfWeekSunday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatHourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

/** Full event time, e.g. "9:30 AM". */
export function formatEventTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${pad(m)} ${period}`;
}

/** Compact event time for dense chips, e.g. "9am", "2:30pm". */
export function formatEventTimeShort(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return m === 0 ? `${hh}${period}` : `${hh}:${pad(m)}${period}`;
}

/** Stable yyyy-mm-dd key for bucketing events by local day. */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Build a local Date from a yyyy-mm-dd date string and an HH:mm time. */
export function dateFromParts(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function getMonthLabel(
  view: CalendarViewMode,
  date: Date,
): { primary: string; secondary: string } {
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

export function stepDate(
  view: CalendarViewMode,
  date: Date,
  dir: -1 | 1,
): Date {
  if (view === "daily") return addDays(date, dir);
  if (view === "weekly") return addDays(date, dir * 7);
  return addMonths(date, dir);
}
