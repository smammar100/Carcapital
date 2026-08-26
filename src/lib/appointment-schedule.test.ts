import { describe, expect, it } from "vitest";
import {
  checkReschedule,
  findConflicts,
  formatMinutes,
  isReschedulable,
  isWithinWorkingHours,
  parseTimeToMinutes,
  type SlotRef,
} from "./appointment-schedule";

const HOURS = { start: "09:00", end: "18:00" };

describe("parseTimeToMinutes", () => {
  it("parses a padded time", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570);
  });

  it("parses an unpadded hour", () => {
    expect(parseTimeToMinutes("9:05")).toBe(545);
  });

  it("rejects malformed input", () => {
    expect(parseTimeToMinutes("nine")).toBeNull();
    expect(parseTimeToMinutes("0930")).toBeNull();
    expect(parseTimeToMinutes("")).toBeNull();
  });

  // Postgres time columns return "19:00:00"; the input yields "19:00".
  it("tolerates a seconds component", () => {
    expect(parseTimeToMinutes("19:00:00")).toBe(1140);
  });

  it("rejects impossible clock values", () => {
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("10:75")).toBeNull();
  });
});

describe("formatMinutes", () => {
  it("round-trips with the parser", () => {
    expect(formatMinutes(parseTimeToMinutes("09:30")!)).toBe("09:30");
  });

  it("pads single digits", () => {
    expect(formatMinutes(545)).toBe("09:05");
  });
});

describe("isWithinWorkingHours", () => {
  it("accepts a slot in the middle of the day", () => {
    expect(isWithinWorkingHours("14:00", HOURS)).toBe(true);
  });

  it("accepts a slot starting exactly at opening", () => {
    expect(isWithinWorkingHours("09:00", HOURS)).toBe(true);
  });

  // GEN-104 UAT 4 / GEN-83: the END must fit, not just the start.
  it("accepts a 60-minute slot that finishes exactly at close", () => {
    expect(isWithinWorkingHours("17:00", HOURS)).toBe(true);
  });

  it("rejects a slot that would run past close", () => {
    expect(isWithinWorkingHours("17:45", HOURS)).toBe(false);
  });

  it("rejects a slot before opening", () => {
    expect(isWithinWorkingHours("08:00", HOURS)).toBe(false);
  });

  it("honours a shorter duration", () => {
    expect(isWithinWorkingHours("17:45", HOURS, 15)).toBe(true);
  });

  it("rejects an unparseable time", () => {
    expect(isWithinWorkingHours("half nine", HOURS)).toBe(false);
  });
});

const existing: SlotRef[] = [
  { id: "a", date: "2026-09-01", time: "10:00" },
  { id: "b", date: "2026-09-01", time: "14:00" },
  { id: "c", date: "2026-09-02", time: "10:00" },
  { id: "d", date: "2026-09-01", time: "16:00", status: "cancelled" },
];

describe("findConflicts", () => {
  it("finds an exact-time clash on the same day", () => {
    const hits = findConflicts({ id: "new", date: "2026-09-01", time: "14:00" }, existing);
    expect(hits.map((h) => h.id)).toEqual(["b"]);
  });

  it("finds a partial overlap", () => {
    const hits = findConflicts({ id: "new", date: "2026-09-01", time: "14:30" }, existing);
    expect(hits.map((h) => h.id)).toEqual(["b"]);
  });

  it("does not treat back-to-back slots as clashing", () => {
    const hits = findConflicts({ id: "new", date: "2026-09-01", time: "15:00" }, existing);
    expect(hits).toHaveLength(0);
  });

  it("ignores other days", () => {
    const hits = findConflicts({ id: "new", date: "2026-09-03", time: "10:00" }, existing);
    expect(hits).toHaveLength(0);
  });

  it("ignores cancelled appointments", () => {
    const hits = findConflicts({ id: "new", date: "2026-09-01", time: "16:00" }, existing);
    expect(hits).toHaveLength(0);
  });

  // Rescheduling an appointment must not report it clashing with itself.
  it("excludes the appointment being edited", () => {
    const hits = findConflicts({ id: "b", date: "2026-09-01", time: "14:00" }, existing);
    expect(hits).toHaveLength(0);
  });
});

describe("checkReschedule", () => {
  it("accepts a clean slot", () => {
    const res = checkReschedule(
      { id: "new", date: "2026-09-01", time: "11:30" },
      existing,
      HOURS,
    );
    expect(res.ok).toBe(true);
    expect(res.warning).toBeUndefined();
    expect(res.conflicts).toHaveLength(0);
  });

  // GEN-104 UAT 4 — working hours are a hard stop.
  it("blocks a slot outside working hours", () => {
    const res = checkReschedule(
      { id: "new", date: "2026-09-01", time: "20:00" },
      existing,
      HOURS,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/working hours/i);
  });

  /**
   * GEN-104 UAT 5 — a clash surfaces, but does not block. Dealerships do
   * double-book two viewings with different salespeople; the requirement is
   * that it is never *silent*.
   */
  it("warns about a clash without blocking it", () => {
    const res = checkReschedule(
      { id: "new", date: "2026-09-01", time: "14:00" },
      existing,
      HOURS,
    );
    expect(res.ok).toBe(true);
    expect(res.warning).toMatch(/overlaps 1 other appointment/i);
    expect(res.conflicts.map((c) => c.id)).toEqual(["b"]);
  });

  it("pluralises multiple clashes", () => {
    const busy: SlotRef[] = [
      { id: "x", date: "2026-09-01", time: "14:00" },
      { id: "y", date: "2026-09-01", time: "14:15" },
    ];
    const res = checkReschedule(
      { id: "new", date: "2026-09-01", time: "14:00" },
      busy,
      HOURS,
    );
    expect(res.warning).toMatch(/overlaps 2 other appointments/i);
  });

  it("rejects an invalid time", () => {
    const res = checkReschedule(
      { id: "new", date: "2026-09-01", time: "abc" },
      existing,
      HOURS,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/valid time/i);
  });

  it("rejects an invalid date", () => {
    const res = checkReschedule(
      { id: "new", date: "not-a-date", time: "11:00" },
      existing,
      HOURS,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/valid date/i);
  });
});

describe("isReschedulable", () => {
  it("allows an upcoming appointment", () => {
    expect(isReschedulable({ status: "upcoming" })).toBe(true);
  });

  it("allows a completed one to be corrected", () => {
    expect(isReschedulable({ status: "completed" })).toBe(true);
  });

  it("refuses a cancelled one", () => {
    expect(isReschedulable({ status: "cancelled" })).toBe(false);
  });
});

describe("checkReschedule — untouched slot", () => {
  const ORIGINAL = { date: "2026-07-16", time: "19:00" };

  /**
   * Real data had appointments sitting outside working hours. Blocking those
   * from any edit would mean a typo in the customer's name could not be fixed
   * without also rescheduling the viewing.
   */
  it("allows saving an out-of-hours appointment when the slot is unchanged", () => {
    const res = checkReschedule(
      { id: "a", date: "2026-07-16", time: "19:00" },
      [],
      HOURS,
      60,
      ORIGINAL,
    );
    expect(res.ok).toBe(true);
  });

  it("still blocks moving it to a different out-of-hours slot", () => {
    const res = checkReschedule(
      { id: "a", date: "2026-07-16", time: "20:00" },
      [],
      HOURS,
      60,
      ORIGINAL,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/working hours/i);
  });

  it("still blocks a new out-of-hours slot when no original is supplied", () => {
    const res = checkReschedule(
      { id: "a", date: "2026-07-16", time: "19:00" },
      [],
      HOURS,
      60,
    );
    expect(res.ok).toBe(false);
  });

  it("tolerates a seconds-bearing stored time", () => {
    const res = checkReschedule(
      { id: "a", date: "2026-07-16", time: "19:00" },
      [],
      HOURS,
      60,
      { date: "2026-07-16", time: "19:00:00" },
    );
    expect(res.ok).toBe(true);
  });
});

describe("findConflicts — stored time formats", () => {
  /**
   * The bug this covers: existing appointments come from Postgres as
   * "19:00:00" while the edit form produces "19:00". A parser that rejected
   * seconds silently dropped every stored appointment from clash detection,
   * so a genuine double-booking produced no warning at all.
   */
  it("matches a stored seconds-bearing time against a form-entered one", () => {
    const hits = findConflicts(
      { id: "new", date: "2026-07-16", time: "19:00" },
      [{ id: "other", date: "2026-07-16", time: "19:00:00" }],
    );
    expect(hits.map((h) => h.id)).toEqual(["other"]);
  });
});
