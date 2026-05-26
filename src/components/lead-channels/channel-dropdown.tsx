"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeadChannel, UUID } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  channels: LeadChannel[];
  value: UUID | undefined;
  onValueChange: (id: UUID) => void;
  placeholder?: string;
  /** Mark the trigger as aria-invalid (for required validation styling). */
  invalid?: boolean;
  /** Disable enabled-only filtering — show every channel including disabled. */
  includeDisabled?: boolean;
  className?: string;
}

/**
 * Lead channel dropdown — used on the Create Lead form (Spec v3.0 ·
 * Module C · Phase 1) and the Super User override modal (Phase 3.3).
 *
 * Channels are passed in (parent loads them once via
 * `leadChannelService.getEnabled(companyId)`) so the dropdown stays
 * synchronous and rendering predictable across many leads on the same
 * page. Renders each option with a coloured dot + label.
 */
export function ChannelDropdown({
  channels,
  value,
  onValueChange,
  placeholder = "Select channel…",
  invalid,
  includeDisabled,
  className,
}: Props) {
  const visible = includeDisabled
    ? channels
    : channels.filter((c) => c.enabled);
  const ordered = [...visible].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(className)}
        aria-invalid={invalid ? true : undefined}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {ordered.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: c.colour }}
              />
              <span>{c.label}</span>
              {!c.enabled ? (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  disabled
                </span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
