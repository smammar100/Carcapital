import type { Appointment } from "@/lib/types";

/**
 * Scheduling rules for editing an existing appointment (GEN-104).
 *
 * GEN-83 fixed appointments being booked outside working hours *on creation*.
 * Rescheduling is a second door into the same data, so the same rules have to
 * hold here or the bug simply comes back through the edit path. Keeping them
 * framework-free means both doors can share one tested implementation.
 */

/** Default slot length when an appointment has no explicit duration. */
const DEFAULT_SLOT_MINUTES = 60;

/**
 * "09:30" → 570. Returns null for anything unparseable.
 *
 * Seconds are tolerated because Postgres `time` columns come back as
 * "19:00:00" while an `<input type="time">` yields "19:00" — rejecting the
 * stored form would silently drop existing appointments out of clash
 * detection, which is exactly the kind of failure that looks like nothing.
 */
export function parseTimeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 570 → "09:30". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface WorkingHours {
  /** "HH:mm" */
  start: string;
  /** "HH:mm" */
  end: string;
}

/**
 * Whether a slot sits inside the business day.
 *
 * The *end* of the appointment must also fit — booking a 60-minute viewing at
 * 17:30 when the day closes at 18:00 is fine, but at 17:45 it is not, and
 * checking only the start time is how you end up with staff still on the
 * forecourt after close.
 */
export function isWithinWorkingHours(
  time: string,
  hours: WorkingHours,
  durationMinutes: number = DEFAULT_SLOT_MINUTES,
): boolean {
  const start = parseTimeToMinutes(time);
  const open = parseTimeToMinutes(hours.start);
  const close = parseTimeToMinutes(hours.end);
  if (start === null || open === null || close === null) return false;
  return start >= open && start + durationMinutes <= close;
}

export interface SlotRef {
  id: string;
  date: string;
  time: string;
  status?: string;
}

/**
 * Appointments that overlap the proposed slot, excluding the one being edited
 * and anything already cancelled.
 *
 * Returns the clashes rather than a boolean so the UI can name them — "clashes
 * with Jane Smith at 14:00" is actionable, "time unavailable" is not.
 */
export function findConflicts(
  proposed: { id: string; date: string; time: string },
  existing: SlotRef[],
  durationMinutes: number = DEFAULT_SLOT_MINUTES,
): SlotRef[] {
  const start = parseTimeToMinutes(proposed.time);
  if (start === null) return [];
  const end = start + durationMinutes;

  return existing.filter((a) => {
    if (a.id === proposed.id) return false;
    if (a.status === "cancelled") return false;
    if (a.date !== proposed.date) return false;
    const otherStart = parseTimeToMinutes(a.time);
    if (otherStart === null) return false;
    const otherEnd = otherStart + durationMinutes;
    // Half-open overlap: back-to-back slots do not clash.
    return start < otherEnd && otherStart < end;
  });
}

export interface RescheduleCheck {
  ok: boolean;
  /** Blocking problem, if any. */
  error?: string;
  /** Non-blocking note the user should see before confirming. */
  warning?: string;
  conflicts: SlotRef[];
}

/**
 * Validate a proposed reschedule.
 *
 * A conflict is a *warning*, not an error — dealerships genuinely double-book
 * two viewings with different salespeople. Working hours are a hard stop
 * because that is what GEN-83 established.
 */
export function checkReschedule(
  proposed: { id: string; date: string; time: string },
  existing: SlotRef[],
  hours: WorkingHours,
  durationMinutes: number = DEFAULT_SLOT_MINUTES,
  /**
   * The slot the appointment currently occupies. When the user has not moved
   * it, the working-hours rule is not applied — otherwise an appointment
   * already sitting outside hours (historical data, or hours changed since it
   * was booked) could not have its customer name corrected without also being
   * rescheduled. The rule exists to stop *new* out-of-hours slots, not to hold
   * unrelated edits hostage.
   */
  original?: { date: string; time: string },
): RescheduleCheck {
  if (parseTimeToMinutes(proposed.time) === null) {
    return { ok: false, error: "Enter a valid time.", conflicts: [] };
  }
  if (!proposed.date || Number.isNaN(new Date(proposed.date).getTime())) {
    return { ok: false, error: "Enter a valid date.", conflicts: [] };
  }

  const slotUnchanged =
    original !== undefined &&
    original.date.slice(0, 10) === proposed.date &&
    original.time.slice(0, 5) === proposed.time;

  if (!slotUnchanged && !isWithinWorkingHours(proposed.time, hours, durationMinutes)) {
    return {
      ok: false,
      error: `Appointments must finish within working hours (${hours.start}–${hours.end}).`,
      conflicts: [],
    };
  }

  const conflicts = findConflicts(proposed, existing, durationMinutes);
  return {
    ok: true,
    conflicts,
    warning:
      conflicts.length > 0
        ? `This overlaps ${conflicts.length} other appointment${conflicts.length === 1 ? "" : "s"} at the same time.`
        : undefined,
  };
}

/** Appointments that can still be rescheduled — cancelled ones cannot. */
export function isReschedulable(appt: Pick<Appointment, "status">): boolean {
  return appt.status !== "cancelled";
}
