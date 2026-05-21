/**
 * Token-driven calendar tone palette. Every class reads a `--cal-*` CSS
 * variable defined in `globals.css`, so tones adapt to light/dark mode with no
 * per-component branching. This is the single source of tone truth — the grid,
 * month chips, the all-day band, filter chips, and the preview dialog all read
 * from here. No hard-coded hex anywhere.
 */

import type { CalendarTone } from "./types";

export interface ToneClasses {
  /** Solid accent — left bar on event blocks, filter-chip dots. */
  bar: string;
  /** Soft tinted background for event surfaces. */
  surface: string;
  /** Readable text colour on top of `surface`. */
  text: string;
  /** Small status dot (same solid colour as `bar`). */
  chip: string;
  /** Focus / hover ring colour. */
  ring: string;
}

export const TONE_CLASSES: Record<CalendarTone, ToneClasses> = {
  blue: {
    bar: "bg-[var(--cal-blue-bar)]",
    surface: "bg-[var(--cal-blue-surface)]",
    text: "text-[var(--cal-blue-text)]",
    chip: "bg-[var(--cal-blue-bar)]",
    ring: "ring-[var(--cal-blue-bar)]",
  },
  purple: {
    bar: "bg-[var(--cal-purple-bar)]",
    surface: "bg-[var(--cal-purple-surface)]",
    text: "text-[var(--cal-purple-text)]",
    chip: "bg-[var(--cal-purple-bar)]",
    ring: "ring-[var(--cal-purple-bar)]",
  },
  amber: {
    bar: "bg-[var(--cal-amber-bar)]",
    surface: "bg-[var(--cal-amber-surface)]",
    text: "text-[var(--cal-amber-text)]",
    chip: "bg-[var(--cal-amber-bar)]",
    ring: "ring-[var(--cal-amber-bar)]",
  },
  emerald: {
    bar: "bg-[var(--cal-emerald-bar)]",
    surface: "bg-[var(--cal-emerald-surface)]",
    text: "text-[var(--cal-emerald-text)]",
    chip: "bg-[var(--cal-emerald-bar)]",
    ring: "ring-[var(--cal-emerald-bar)]",
  },
  rose: {
    bar: "bg-[var(--cal-rose-bar)]",
    surface: "bg-[var(--cal-rose-surface)]",
    text: "text-[var(--cal-rose-text)]",
    chip: "bg-[var(--cal-rose-bar)]",
    ring: "ring-[var(--cal-rose-bar)]",
  },
  slate: {
    bar: "bg-[var(--cal-slate-bar)]",
    surface: "bg-[var(--cal-slate-surface)]",
    text: "text-[var(--cal-slate-text)]",
    chip: "bg-[var(--cal-slate-bar)]",
    ring: "ring-[var(--cal-slate-bar)]",
  },
};

/** Raw `var()` reference for a tone's solid colour — for inline styles. */
export const TONE_VAR: Record<CalendarTone, string> = {
  blue: "var(--cal-blue-bar)",
  purple: "var(--cal-purple-bar)",
  amber: "var(--cal-amber-bar)",
  emerald: "var(--cal-emerald-bar)",
  rose: "var(--cal-rose-bar)",
  slate: "var(--cal-slate-bar)",
};
