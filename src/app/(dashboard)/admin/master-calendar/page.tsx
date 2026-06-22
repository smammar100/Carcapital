"use client";

import { SharedCalendar } from "@/components/calendar/shared-calendar";

/**
 * Master Calendar — overlay of appointments (sky), workshop walk-ins (amber)
 * and maintenance dues (violet) in one shared view. Built on the reusable
 * <SharedCalendar/> surface (also powers the Maintenance Calendar).
 */
export default function MasterCalendarPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Master Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Every customer appointment, workshop walk-in, and maintenance due in
          one shared view. Click a slot to book or an event to open it.
        </p>
      </div>
      <SharedCalendar />
    </div>
  );
}
