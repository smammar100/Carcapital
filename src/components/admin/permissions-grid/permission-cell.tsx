"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Capability } from "@/lib/capabilities";
import type { UUID } from "@/lib/types";

interface Props {
  userId: UUID;
  capability: Capability;
  checked: boolean;
  /** True when the user is a super-user — all caps, locked. */
  superUser: boolean;
  /**
   * True when this capability is derived from the member's role(s). It's
   * implied (always on) and cannot be toggled off here — only explicit grants
   * are editable.
   */
  roleGranted: boolean;
  /** True when the local value differs from the saved server value. */
  changed: boolean;
  onToggle: (userId: UUID, cap: Capability) => void;
}

export function PermissionCell({
  userId,
  capability,
  checked,
  superUser,
  roleGranted,
  changed,
  onToggle,
}: Props) {
  const locked = superUser || roleGranted;
  const box = (
    <Checkbox
      checked={superUser || roleGranted ? true : checked}
      disabled={locked}
      onCheckedChange={() => onToggle(userId, capability)}
      aria-label={capability}
      data-testid={`perm-cell-${userId}-${capability}`}
    />
  );

  return (
    <td
      className={cn(
        "h-12 border-b border-l p-0 text-center align-middle transition-colors group-hover/row:bg-muted",
        changed &&
          "bg-amber-50 ring-1 ring-amber-300 ring-inset group-hover/row:bg-amber-50 dark:bg-amber-950/20 dark:ring-amber-700 dark:group-hover/row:bg-amber-950/20",
      )}
    >
      {/*
        The checkbox draws at 16px inside a 92x49 cell, so all but 3% of the
        cell was dead space and the box had to be hit dead-on (GEN-122). Fill
        the cell and toggle from anywhere in it. Clicks that land on the
        checkbox itself fall through to it, so they aren't counted twice.
      */}
      <div
        className={cn(
          "flex h-12 w-full items-center justify-center",
          !locked && "cursor-pointer",
        )}
        onClick={(event) => {
          if (locked || event.target !== event.currentTarget) return;
          onToggle(userId, capability);
        }}
      >
        {superUser ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{box}</span>
            </TooltipTrigger>
            <TooltipContent>
              Super-user: all capabilities, cannot be edited here.
            </TooltipContent>
          </Tooltip>
        ) : roleGranted ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{box}</span>
            </TooltipTrigger>
            <TooltipContent>
              Granted by role: edit the member&apos;s roles to change this.
            </TooltipContent>
          </Tooltip>
        ) : (
          box
        )}
      </div>
    </td>
  );
}
