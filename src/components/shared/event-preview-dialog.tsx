"use client";

import type { ReactNode } from "react";
import { Fragment } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EventPreviewRow {
  label: string;
  value: ReactNode;
}

interface EventPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title shown in the dialog header. */
  title: string;
  /** Small uppercase pill rendered above the title (e.g., "Appointment"). */
  toneLabel?: string;
  /** Tailwind classes for the tone pill background + text. */
  toneClass?: string;
  /** Rows of label/value to render in the body as a definition list. */
  rows: EventPreviewRow[];
  /** Optional edit handler. When omitted, the Edit button is hidden. */
  onEdit?: () => void;
  /** Label for the primary CTA button. */
  ctaLabel: string;
  /** Click handler for the primary CTA. */
  onCta: () => void;
  /** Extra body slot rendered between the rows and the footer (e.g., notes). */
  bodySlot?: ReactNode;
}

/**
 * Shared event-preview dialog used across the calendar pages. Shows event
 * details and offers an Edit button + a primary CTA.
 */
export function EventPreviewDialog({
  open,
  onOpenChange,
  title,
  toneLabel,
  toneClass,
  rows,
  onEdit,
  ctaLabel,
  onCta,
  bodySlot,
}: EventPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-2 pr-8">
          {toneLabel ? (
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                toneClass ?? "bg-muted text-muted-foreground",
              )}
            >
              {toneLabel}
            </span>
          ) : null}
          <DialogTitle className="text-lg font-semibold leading-snug">
            {title}
          </DialogTitle>
        </DialogHeader>

        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm">
          {rows.map((r) => (
            <Fragment key={r.label}>
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="min-w-0 break-words text-foreground">{r.value}</dd>
            </Fragment>
          ))}
        </dl>

        {bodySlot}

        <DialogFooter className="mt-2 flex-row justify-end gap-2 sm:justify-end">
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              onClick={onEdit}
              className="gap-1"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : null}
          <Button type="button" onClick={onCta}>
            {ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
