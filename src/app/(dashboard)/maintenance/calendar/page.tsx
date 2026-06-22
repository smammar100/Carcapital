"use client";

import { SharedCalendar } from "@/components/calendar/shared-calendar";

/**
 * Maintenance Calendar — the same calendar surface as the Master Calendar,
 * scoped to maintenance dues only, with an "Add job" create action.
 */
export default function MaintenanceCalendarPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Maintenance Calendar
        </h1>
        <p className="text-sm text-muted-foreground">
          All maintenance and inspection jobs on one calendar, colour-coded by
          status. Click a slot to add or an event to open it.
        </p>
      </div>
      <SharedCalendar kinds={["maint"]} ctaLabel="Add job" lockCreateKind />
    </div>
  );
}
