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
  /** True when the local value differs from the saved server value. */
  changed: boolean;
  onToggle: (userId: UUID, cap: Capability) => void;
}

export function PermissionCell({
  userId,
  capability,
  checked,
  superUser,
  changed,
  onToggle,
}: Props) {
  const box = (
    <Checkbox
      checked={superUser ? true : checked}
      disabled={superUser}
      onCheckedChange={() => onToggle(userId, capability)}
      aria-label={capability}
      data-testid={`perm-cell-${userId}-${capability}`}
    />
  );

  return (
    <td
      className={cn(
        "h-10 w-10 p-0 text-center align-middle",
        changed &&
          "bg-amber-50 ring-1 ring-amber-300 ring-inset dark:bg-amber-950/20 dark:ring-amber-700",
      )}
    >
      <div className="flex items-center justify-center">
        {superUser ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{box}</span>
            </TooltipTrigger>
            <TooltipContent>
              Super-user — all capabilities, cannot be edited here.
            </TooltipContent>
          </Tooltip>
        ) : (
          box
        )}
      </div>
    </td>
  );
}
