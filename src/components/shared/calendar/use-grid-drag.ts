"use client";

import { useCallback, useRef, useState } from "react";
import type {
  EventMoveHandler,
  SlotSelectHandler,
  WeekCalendarEvent,
} from "./types";
import { HOUR_HEIGHT } from "./date-utils";

/** Pixels the pointer must travel before a press becomes a drag. */
const DEAD_ZONE = 4;
/** Minute granularity drags snap to. */
const SNAP_MIN = 15;
/** Default duration (minutes) for a plain click-to-create. */
const DEFAULT_CREATE_MIN = 60;

export interface DragDraft {
  mode: "create" | "move";
  /** Index into the visible `days` array. */
  dayIndex: number;
  startMin: number;
  endMin: number;
  eventId?: string;
  allDay?: boolean;
}

interface GridDragOptions {
  days: Date[];
  startHour: number;
  endHour: number;
  onSlotSelect?: SlotSelectHandler;
  onEventMove?: EventMoveHandler;
}

interface Gesture {
  type: "create" | "move";
  pointerId: number;
  originX: number;
  originY: number;
  dragging: boolean;
  rects: DOMRect[];
  originDayIndex: number;
  event: WeekCalendarEvent | null;
  /** create: snapped origin minute. move: pointer-minute − event-start-minute. */
  grabOffsetMin: number;
  /** move only — fixed event duration. */
  durationMin: number;
  cleanup: () => void;
}

function snap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** A local Date on `day` at `min` minutes past midnight. */
function dateAtMinute(day: Date, min: number): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(min);
  return d;
}

/**
 * Swallow exactly the one synthetic `click` that fires after a real drag, so a
 * drag never also triggers click-to-open / click-to-create. Capturing listener
 * removes itself on first hit (or after a short fallback timeout).
 */
function suppressNextClick() {
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    cleanup();
  };
  const cleanup = () => {
    document.removeEventListener("click", onClick, true);
    clearTimeout(timer);
  };
  const timer = setTimeout(cleanup, 350);
  document.addEventListener("click", onClick, true);
}

/**
 * Pointer-event drag engine for the daily/weekly time grid. Presentational —
 * it computes geometry and emits `onSlotSelect` / `onEventMove`; the page owns
 * persistence. Drag is mouse/pen only; touch falls through to tap (click).
 */
export function useGridDrag(opts: GridDragOptions) {
  const [draft, setDraft] = useState<DragDraft | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const columnEls = useRef<(HTMLElement | null)[]>([]);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const registerColumn = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      columnEls.current[index] = el;
    },
    [],
  );

  function snapshotRects(): DOMRect[] {
    return columnEls.current.map((el) =>
      el ? el.getBoundingClientRect() : new DOMRect(),
    );
  }

  function minuteAt(clientY: number, rect: DOMRect): number {
    const { startHour, endHour } = optsRef.current;
    const gridStartMin = startHour * 60;
    const gridEndMin = (endHour + 1) * 60;
    const raw = gridStartMin + ((clientY - rect.top) / HOUR_HEIGHT) * 60;
    return clamp(raw, gridStartMin, gridEndMin);
  }

  function dayIndexAt(clientX: number, rects: DOMRect[]): number {
    for (let i = 0; i < rects.length; i++) {
      if (clientX >= rects[i].left && clientX < rects[i].right) return i;
    }
    return rects.length > 0 && clientX < rects[0].left ? 0 : rects.length - 1;
  }

  function updateDraft(gesture: Gesture, clientX: number, clientY: number) {
    const { startHour, endHour } = optsRef.current;
    const gridStartMin = startHour * 60;
    const gridEndMin = (endHour + 1) * 60;

    if (gesture.type === "create") {
      const rect = gesture.rects[gesture.originDayIndex];
      const cur = snap(minuteAt(clientY, rect));
      const lo = Math.min(gesture.grabOffsetMin, cur);
      let hi = Math.max(gesture.grabOffsetMin, cur);
      if (hi - lo < SNAP_MIN) hi = lo + SNAP_MIN;
      setDraft({
        mode: "create",
        dayIndex: gesture.originDayIndex,
        startMin: lo,
        endMin: hi,
      });
      return;
    }

    const evt = gesture.event!;
    const dayIndex = dayIndexAt(clientX, gesture.rects);
    if (evt.allDay) {
      setDraft({
        mode: "move",
        dayIndex,
        startMin: 0,
        endMin: 0,
        eventId: evt.id,
        allDay: true,
      });
      return;
    }
    const rawMin = minuteAt(clientY, gesture.rects[dayIndex]);
    const startMin = clamp(
      snap(rawMin - gesture.grabOffsetMin),
      gridStartMin,
      gridEndMin - gesture.durationMin,
    );
    setDraft({
      mode: "move",
      dayIndex,
      startMin,
      endMin: startMin + gesture.durationMin,
      eventId: evt.id,
    });
  }

  function finishGesture(
    gesture: Gesture,
    clientX: number,
    clientY: number,
    cancelled: boolean,
  ) {
    gesture.cleanup();
    if (gestureRef.current === gesture) gestureRef.current = null;
    setDraft(null);

    if (cancelled || !gesture.dragging) return;
    suppressNextClick();

    const { days, startHour, endHour, onSlotSelect, onEventMove } =
      optsRef.current;

    if (gesture.type === "create") {
      const rect = gesture.rects[gesture.originDayIndex];
      const cur = snap(minuteAt(clientY, rect));
      const lo = Math.min(gesture.grabOffsetMin, cur);
      let hi = Math.max(gesture.grabOffsetMin, cur);
      if (hi - lo < SNAP_MIN) hi = lo + SNAP_MIN;
      const day = days[gesture.originDayIndex];
      onSlotSelect?.(dateAtMinute(day, lo), dateAtMinute(day, hi), false);
      return;
    }

    const evt = gesture.event!;
    const dayIndex = dayIndexAt(clientX, gesture.rects);
    const day = days[dayIndex];
    if (evt.allDay) {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      onEventMove?.(evt, start, new Date(start));
      return;
    }
    const rawMin = minuteAt(clientY, gesture.rects[dayIndex]);
    const startMin = clamp(
      snap(rawMin - gesture.grabOffsetMin),
      startHour * 60,
      (endHour + 1) * 60 - gesture.durationMin,
    );
    onEventMove?.(
      evt,
      dateAtMinute(day, startMin),
      dateAtMinute(day, startMin + gesture.durationMin),
    );
  }

  function beginGesture(
    seed: Omit<Gesture, "cleanup" | "dragging" | "rects">,
  ) {
    const rects = snapshotRects();
    const gesture: Gesture = {
      ...seed,
      dragging: false,
      rects,
      cleanup: () => {},
    };
    gestureRef.current = gesture;

    const handleMove = (e: PointerEvent) => {
      if (e.pointerId !== gesture.pointerId) return;
      if (!gesture.dragging) {
        const moved = Math.hypot(
          e.clientX - gesture.originX,
          e.clientY - gesture.originY,
        );
        if (moved < DEAD_ZONE) return;
        gesture.dragging = true;
        document.body.style.userSelect = "none";
      }
      e.preventDefault();
      updateDraft(gesture, e.clientX, e.clientY);
    };
    const handleUp = (e: PointerEvent) => {
      if (e.pointerId !== gesture.pointerId) return;
      finishGesture(gesture, e.clientX, e.clientY, false);
    };
    const handleCancel = () => finishGesture(gesture, 0, 0, true);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishGesture(gesture, 0, 0, true);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleCancel);
    window.addEventListener("keydown", handleKey);
    gesture.cleanup = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleKey);
      document.body.style.userSelect = "";
    };
  }

  /** Pointer-down on empty grid → begin a drag-to-create gesture. */
  const startCreate = useCallback(
    (dayIndex: number, e: React.PointerEvent) => {
      if (e.button !== 0 || e.pointerType === "touch") return;
      const rect = columnEls.current[dayIndex]?.getBoundingClientRect();
      if (!rect) return;
      beginGesture({
        type: "create",
        pointerId: e.pointerId,
        originX: e.clientX,
        originY: e.clientY,
        originDayIndex: dayIndex,
        event: null,
        grabOffsetMin: snap(minuteAt(e.clientY, rect)),
        durationMin: 0,
      });
    },
    [],
  );

  /** Plain click on empty grid → create a default 60-minute block. */
  const clickCreate = useCallback((dayIndex: number, e: React.MouseEvent) => {
    const { days, startHour, endHour, onSlotSelect } = optsRef.current;
    const rect = columnEls.current[dayIndex]?.getBoundingClientRect();
    if (!rect) return;
    const gridStartMin = startHour * 60;
    const gridEndMin = (endHour + 1) * 60;
    const raw = gridStartMin + ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
    const start = clamp(
      snap(raw),
      gridStartMin,
      gridEndMin - DEFAULT_CREATE_MIN,
    );
    const day = days[dayIndex];
    onSlotSelect?.(
      dateAtMinute(day, start),
      dateAtMinute(day, start + DEFAULT_CREATE_MIN),
      false,
    );
  }, []);

  /** Pointer-down on an event block → begin a drag-to-move gesture. */
  const startMove = useCallback(
    (event: WeekCalendarEvent, dayIndex: number, e: React.PointerEvent) => {
      if (e.button !== 0 || e.pointerType === "touch") return;
      e.stopPropagation();
      const rect = columnEls.current[dayIndex]?.getBoundingClientRect();
      if (!rect) return;
      const eventStartMin =
        event.start.getHours() * 60 + event.start.getMinutes();
      const durationMin = Math.max(
        15,
        Math.round((event.end.getTime() - event.start.getTime()) / 60_000),
      );
      beginGesture({
        type: "move",
        pointerId: e.pointerId,
        originX: e.clientX,
        originY: e.clientY,
        originDayIndex: dayIndex,
        event,
        grabOffsetMin: event.allDay
          ? 0
          : minuteAt(e.clientY, rect) - eventStartMin,
        durationMin,
      });
    },
    [],
  );

  return { draft, registerColumn, startCreate, clickCreate, startMove };
}
