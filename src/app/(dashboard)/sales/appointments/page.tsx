"use client";

import { SharedCalendar } from "@/components/calendar/shared-calendar";

/**
 * Appointments — the same calendar surface as the Master Calendar, scoped to
 * customer appointments only, with a "Book appointment" create action. Day /
 * week / month views, click-a-slot to book, click an event to view/edit.
 */
export default function AppointmentsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
        <p className="text-sm text-muted-foreground">
          All booked customer test drives and viewings. Schedule new ones and
          see what is coming up.
        </p>
      </div>
      <SharedCalendar
        kinds={["appt"]}
        ctaLabel="Book appointment"
        lockCreateKind
      />
    </div>
  );
}
