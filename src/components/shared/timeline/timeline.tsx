"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared GitHub-style timeline (Mobbin reference: GitHub contribution
 * activity feed). One continuous vertical rail; each event is a circular
 * tone-coded icon node anchored to the rail with an inline title +
 * right-aligned timestamp. Rich events drop a bordered card body below
 * the title row.
 *
 * Use across:
 *   - vehicle-detail/activity-tab.tsx       (every action_type)
 *   - vehicle-detail/location-tab.tsx       (per location_movement)
 *   - locations/location-history-drawer.tsx (same movement list, sheet)
 */

export type TimelineTone =
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "sky"
  | "slate";

const TONE_STYLES: Record<TimelineTone, { wrap: string; icon: string }> = {
  emerald: {
    wrap: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50",
    icon: "",
  },
  amber: {
    wrap: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50",
    icon: "",
  },
  rose: {
    wrap: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50",
    icon: "",
  },
  violet: {
    wrap: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/50",
    icon: "",
  },
  sky: {
    wrap: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/50",
    icon: "",
  },
  slate: {
    wrap: "bg-muted text-muted-foreground ring-border",
    icon: "",
  },
};

/** Diameter of the icon node + half of it as left offset for the rail. */
const NODE_SIZE_CLASS = "size-8";   // 32px
const RAIL_LEFT_PX = 15;            // = (32px - 2px rail) / 2
const CONTENT_PADDING_LEFT = "pl-12"; // 32px node + 16px gap

/** Root list. Renders a single dashed vertical rail behind the children. */
export function Timeline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ol className={cn("relative space-y-4", className)}>
      <span
        aria-hidden
        className="absolute top-3 bottom-3 border-l-2 border-dashed border-border"
        style={{ left: RAIL_LEFT_PX }}
      />
      {children}
    </ol>
  );
}

/**
 * A non-event divider inside the timeline (date / section header). Doesn't
 * render a node — just the text, indented to align with item titles.
 */
export function TimelineDayHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("relative", CONTENT_PADDING_LEFT, className)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-1.5 inline-flex size-2 items-center justify-center rounded-full bg-border",
        )}
        style={{ left: RAIL_LEFT_PX - 3 }}
      />
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </div>
    </li>
  );
}

export interface TimelineItemProps {
  /** Icon shown inside the node. Lucide preferred. */
  icon: LucideIcon;
  /** Visual tone for the node (controls bg / text / ring). */
  tone?: TimelineTone;
  /** Right-aligned secondary text (date, time, "Aug 14", etc.). */
  timestamp?: ReactNode;
  /**
   * Optional rich body shown in a bordered card below the title row.
   * Pass real React content (paragraphs, buttons, etc.) — leave undefined
   * for an inline-only event.
   */
  body?: ReactNode;
  /**
   * Inline title content — text, bold strong tags, links, anything. The
   * actor name typically lives here as a leading <strong>.
   */
  children: ReactNode;
  className?: string;
}

/**
 * One row in a timeline. The title row sits on the rail with the icon
 * node; the optional body card hangs below indented to match.
 */
export function TimelineItem({
  icon: Icon,
  tone = "slate",
  timestamp,
  body,
  children,
  className,
}: TimelineItemProps) {
  const tones = TONE_STYLES[tone];
  return (
    <li className={cn("relative", CONTENT_PADDING_LEFT, className)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-0 inline-flex items-center justify-center rounded-full ring-2 ring-background",
          NODE_SIZE_CLASS,
          tones.wrap,
        )}
        style={{ left: 0 }}
      >
        <Icon className={cn("size-4", tones.icon)} />
      </span>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pt-1.5">
        <div className="min-w-0 text-sm leading-snug text-foreground">
          {children}
        </div>
        {timestamp ? (
          <div className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {timestamp}
          </div>
        ) : null}
      </div>

      {body ? (
        <div className="mt-2 rounded-lg border bg-card p-3 text-sm">{body}</div>
      ) : null}
    </li>
  );
}
