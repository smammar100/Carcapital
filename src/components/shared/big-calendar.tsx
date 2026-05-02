"use client";

import {
  Calendar,
  dateFnsLocalizer,
  type CalendarProps,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-GB": enGB };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
  getDay,
  locales,
});

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: { kind: string; href?: string; color?: string };
};

interface Props extends Omit<CalendarProps<CalendarEvent>, "localizer"> {
  events: CalendarEvent[];
}

export function BigCalendar(props: Props) {
  return (
    <div className="rbc-host">
      <Calendar
        localizer={localizer}
        culture="en-GB"
        defaultView="month"
        views={["month", "week", "day"]}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 700 }}
        eventPropGetter={(event) => {
          const color = event.resource?.color;
          return color
            ? {
                style: {
                  backgroundColor: color,
                  borderColor: color,
                  color: "white",
                },
              }
            : {};
        }}
        {...props}
      />
    </div>
  );
}
