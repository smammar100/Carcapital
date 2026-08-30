"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The "this card moves" affordance.
 *
 * The card itself stays `draggable`. Moving the drag target onto the grip would
 * break the habit of anyone who had already found that the body drags, and the
 * complaint was never that dragging failed -- it was that nothing said the card
 * could be dragged at all. Most of a card's surface is links, so the pointer
 * reads "clickable" almost everywhere and the grab cursor only surfaces in the
 * gaps between them: measured on a pipeline card, three of five sample points
 * were links (GEN-115).
 *
 * Shown at rest rather than on hover. A grip that only appears once you are
 * already hovering answers a question the user has to have asked first, which
 * is the opposite of an affordance; it firms up on hover instead.
 *
 * Deliberately decorative -- `aria-hidden`, no tab stop. The drag target is the
 * card, so a grip that cannot be activated would be a promise to keyboard users
 * that nothing keeps. Keyboard reordering is real work and belongs in its own
 * ticket, not a fake control here.
 */
export function DragHandle({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      title="Drag to move"
      className={cn(
        "pointer-events-none inline-flex shrink-0 cursor-grab text-muted-foreground/40 transition-colors",
        // The card owns the hover, so the grip darkens with it rather than
        // needing its own hover target.
        "group-hover/card:text-muted-foreground/70",
        className,
      )}
    >
      <GripVertical className="size-3.5" />
    </span>
  );
}
