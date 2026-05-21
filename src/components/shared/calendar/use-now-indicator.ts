"use client";

import { useEffect, useState } from "react";

/**
 * Current `Date`, re-rendering once a minute (aligned to the minute boundary
 * so the now-indicator ticks cleanly). Used by the time grid to draw the red
 * current-time line.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    // Align the first tick to the next minute boundary.
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return now;
}

/** Minutes since local midnight for a given date. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
