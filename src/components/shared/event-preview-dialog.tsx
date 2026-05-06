"use client";

import type { ReactNode } from "react";
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
  /** Small uppercase pill rendered before the title (e.g., "Appointment"). */
  toneLabel?: string;
  /** Tailwind classes for the tone pill background + text. */
  toneClass?: string;
  /** Rows of label/value to render in the body. */
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
        <DialogHeader>
          <div className="flex items-start gap-2 pr-10">
            {toneLabel ? (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  toneClass ?? "bg-muted text-muted-foreground",
                )}
              >
                {toneLabel}
              </span>
            ) : null}
            <DialogTitle className="flex-1 truncate text-base">
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>
        <div className="grid gap-2 text-sm">
          {rows.map((r) => (
            <div key={r.label}>
              <span className="text-muted-foreground">{r.label}: </span>
              {r.value}
            </div>
          ))}
        </div>
        {bodySlot}
        <DialogFooter className="gap-2 sm:gap-2">
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
