"use client";

import { cn } from "@/lib/utils";
import type { LeadChannel } from "@/lib/types";

/**
 * Channel chip used on Lead Detail headers, Sales Pipeline cards, and
 * anywhere a lead's channel needs to render with the spec's brand colour
 * (Spec v3.0 · Module C · Phase 1).
 *
 * Pass either the resolved `channel` object or just the colour + label —
 * both shapes are accepted so callers don't always need the full LeadChannel.
 */
type Props =
  | {
      channel: Pick<LeadChannel, "label" | "colour">;
      /** Compact form — just the dot + label, no chip surround. */
      compact?: boolean;
      className?: string;
    }
  | {
      colour: string;
      label: string;
      compact?: boolean;
      className?: string;
    };

function isChannelShape(
  p: Props,
): p is { channel: Pick<LeadChannel, "label" | "colour">; compact?: boolean; className?: string } {
  return "channel" in p;
}

export function ChannelChip(props: Props) {
  const colour = isChannelShape(props) ? props.channel.colour : props.colour;
  const label = isChannelShape(props) ? props.channel.label : props.label;
  const compact = props.compact;
  const className = props.className;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-foreground",
          className,
        )}
      >
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ backgroundColor: colour }}
        />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: colour }}
      />
      <span>{label}</span>
    </span>
  );
}

/**
 * Bare coloured dot — used on Sales Pipeline cards (Phase 3.2). Tooltip
 * with the label is the caller's responsibility (so the trigger can opt
 * into a richer surface like Radix Tooltip).
 */
export function ChannelDot({
  colour,
  className,
}: {
  colour: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 rounded-full", className)}
      style={{ backgroundColor: colour }}
    />
  );
}
