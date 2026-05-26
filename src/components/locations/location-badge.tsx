"use client";

import { Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  VEHICLE_LOCATION_LABELS,
  type VehicleLocation,
} from "@/lib/types";

interface LocationBadgeProps {
  location: VehicleLocation;
  outForTestDrive?: boolean;
  testDriveExpectedBackAt?: string | null;
  /** Vendor name shown in the off-site tooltip for garage moves. */
  workshopName?: string | null;
  /** Staff member name shown in the off-site tooltip for staff moves. */
  staffName?: string | null;
  /** Expected return time shown in the off-site tooltip. */
  expectedReturnAt?: string | null;
  /** Hide the "Off-site" label for a compact inline rendering. */
  compact?: boolean;
  className?: string;
}

const OFF_SITE_LOCATIONS: VehicleLocation[] = ["garage", "staff"];

const OFF_SITE_DOT: Record<"garage" | "staff", string> = {
  garage: "bg-red-500",
  staff: "bg-amber-500",
};

function formatHm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/**
 * Inline location chip — renders the location name plus an "Off-site"
 * red/amber dot when the car is at Garage / Staff, and a clock icon when
 * the customer has it out for a test drive (Decision D-A1). Tooltip on
 * either side-affordance shows the relevant context (workshop / staff /
 * expected return).
 */
export function LocationBadge({
  location,
  outForTestDrive,
  testDriveExpectedBackAt,
  workshopName,
  staffName,
  expectedReturnAt,
  compact = false,
  className,
}: LocationBadgeProps) {
  const isOffSite = OFF_SITE_LOCATIONS.includes(location);
  const offSiteTooltip =
    location === "garage"
      ? workshopName
        ? `At ${workshopName}`
        : "Off-site at workshop"
      : location === "staff"
        ? staffName
          ? `With ${staffName}${expectedReturnAt ? ` · back ${formatHm(expectedReturnAt)}` : ""}`
          : "With a staff member"
        : null;
  const testDriveTooltip = outForTestDrive
    ? testDriveExpectedBackAt
      ? `Out for test drive · back ${formatHm(testDriveExpectedBackAt)}`
      : "Out for test drive"
    : null;

  return (
    <TooltipProvider delayDuration={150}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap text-xs",
          className,
        )}
      >
        <span className="text-foreground">{VEHICLE_LOCATION_LABELS[location]}</span>

        {isOffSite ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
                  compact && "gap-0 px-0.5 py-0",
                )}
              >
                <span
                  className={cn(
                    "block size-1.5 rounded-full",
                    location === "garage" ? OFF_SITE_DOT.garage : OFF_SITE_DOT.staff,
                  )}
                  aria-hidden
                />
                {!compact ? <span>Off-site</span> : null}
              </span>
            </TooltipTrigger>
            {offSiteTooltip ? (
              <TooltipContent side="top">{offSiteTooltip}</TooltipContent>
            ) : null}
          </Tooltip>
        ) : null}

        {outForTestDrive ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center text-muted-foreground"
                aria-label="Out for test drive"
              >
                <Clock className="size-3" aria-hidden />
              </span>
            </TooltipTrigger>
            {testDriveTooltip ? (
              <TooltipContent side="top">{testDriveTooltip}</TooltipContent>
            ) : null}
          </Tooltip>
        ) : null}
      </span>
    </TooltipProvider>
  );
}
