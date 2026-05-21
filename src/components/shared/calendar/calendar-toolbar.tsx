"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { CalendarTone, CalendarViewMode } from "./types";
import { TONE_CLASSES } from "./tone";
import { getMonthLabel, startOfDay, stepDate } from "./date-utils";

interface CalendarToolbarProps {
  view: CalendarViewMode;
  onViewChange: (v: CalendarViewMode) => void;
  currentDate: Date;
  onCurrentDateChange: (d: Date) => void;
  rightSlot?: ReactNode;
}

/**
 * Calendar header: a clickable month label that opens a mini-month date
 * picker, prev/next stepping, a Today shortcut, the view switcher, and an
 * optional right-hand slot for filter chips / action buttons.
 */
export function CalendarToolbar({
  view,
  onViewChange,
  currentDate,
  onCurrentDateChange,
  rightSlot,
}: CalendarToolbarProps) {
  const label = getMonthLabel(view, currentDate);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-baseline gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted"
              title="Jump to date"
            >
              <span className="text-h3 leading-none text-foreground">
                {label.primary}
              </span>
              <span className="text-h3 font-normal leading-none text-muted-foreground">
                {label.secondary}
              </span>
              <ChevronDown className="size-3.5 self-center text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <DatePicker
              mode="single"
              captionLayout="dropdown"
              defaultMonth={currentDate}
              selected={currentDate}
              onSelect={(d) => {
                if (d) {
                  onCurrentDateChange(startOfDay(d));
                  setPickerOpen(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>

        <div className="flex items-center text-muted-foreground">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => onCurrentDateChange(stepDate(view, currentDate, -1))}
            className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => onCurrentDateChange(stepDate(view, currentDate, 1))}
            className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <CalendarViewSwitcher value={view} onChange={onViewChange} />
      </div>
      {rightSlot ? (
        <div className="flex flex-wrap items-center gap-2">{rightSlot}</div>
      ) : null}
    </div>
  );
}

export function CalendarViewSwitcher({
  value,
  onChange,
}: {
  value: CalendarViewMode;
  onChange: (v: CalendarViewMode) => void;
}) {
  const options: CalendarViewMode[] = ["daily", "weekly", "monthly"];
  const labels: Record<CalendarViewMode, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };
  return (
    <div className="inline-flex items-center rounded-full bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === opt
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export function CalendarFilterChip({
  checked,
  onChange,
  label,
  tone,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tone: CalendarTone;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        checked
          ? "border-foreground/15 bg-background text-foreground"
          : "border-transparent bg-muted text-muted-foreground line-through",
      )}
    >
      <span className={cn("size-2 rounded-full", TONE_CLASSES[tone].chip)} />
      {label}
    </button>
  );
}
