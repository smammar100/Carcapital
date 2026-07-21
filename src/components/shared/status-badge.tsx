import { Badge } from "@/components/ui/badge";
import {
  VEHICLE_STATUSES,
  MAINTENANCE_STATUSES,
  salesStageLabel,
} from "@/lib/constants";
import type {
  MaintenanceStatus,
  SalesStage,
  VehicleStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusRing, type StatusRingVariant } from "./status-ring";

/**
 * VehicleStatus is the app's one true lifecycle, so it gets the
 * progress-ring icon (per the order-status reference). The 10 states
 * map monotonically onto the ring: `received` hasn't started (dashed
 * pending), the middle states fill the wedge progressively, `sold` is
 * the full disc (done), and `returned` is the exclamation (issue).
 */
const VEHICLE_STATUS_RING: Record<
  VehicleStatus,
  { variant: StatusRingVariant; fill?: number }
> = {
  received: { variant: "pending" },
  inspection_pending: { variant: "progress", fill: 0 },
  being_prepared: { variant: "progress", fill: 0.3 },
  photos_pending: { variant: "progress", fill: 0.45 },
  photos_ready: { variant: "progress", fill: 0.6 },
  ready: { variant: "progress", fill: 0.75 },
  listed: { variant: "progress", fill: 0.85 },
  reserved: { variant: "progress", fill: 0.95 },
  sold: { variant: "progress", fill: 1 },
  returned: { variant: "issue" },
};

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
  yellow:
    "bg-yellow-100 text-yellow-900 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-900",
  orange:
    "bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900",
  green:
    "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  purple:
    "bg-purple-100 text-purple-900 border-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-900",
  pink: "bg-pink-100 text-pink-900 border-pink-200 dark:bg-pink-950/40 dark:text-pink-200 dark:border-pink-900",
  gray: "bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-700",
  red: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900",
};

interface VehicleStatusBadgeProps {
  status: VehicleStatus;
  className?: string;
}

export function VehicleStatusBadge({ status, className }: VehicleStatusBadgeProps) {
  const meta = VEHICLE_STATUSES.find((s) => s.value === status);
  if (!meta) return <Badge variant="outline">{status}</Badge>;
  const ring = VEHICLE_STATUS_RING[status];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", COLOR_CLASSES[meta.color], className)}
    >
      {ring && <StatusRing variant={ring.variant} fill={ring.fill} />}
      {meta.label}
    </Badge>
  );
}

const MAINTENANCE_COLORS: Record<MaintenanceStatus, string> = {
  pending: "yellow",
  in_progress: "blue",
  completed: "green",
  stalled: "red",
};

interface MaintenanceStatusBadgeProps {
  status: MaintenanceStatus;
  className?: string;
}

export function MaintenanceStatusBadge({
  status,
  className,
}: MaintenanceStatusBadgeProps) {
  const meta = MAINTENANCE_STATUSES.find((s) => s.value === status);
  return (
    <Badge variant="outline" className={cn(COLOR_CLASSES[MAINTENANCE_COLORS[status]], className)}>
      {meta?.label ?? status}
    </Badge>
  );
}

// Stages are user-configurable, so this is a best-effort accent keyed by the
// shipped slugs; anything unrecognised (a custom stage) falls back to gray.
const STAGE_COLORS: Record<string, string> = {
  new_lead: "blue",
  contacted: "purple",
  test_drive: "orange",
  offer_made: "yellow",
  deposit_taken: "pink",
  collection_delivery: "purple",
  completed_sale: "green",
  lost: "gray",
};

interface SalesStageBadgeProps {
  stage: SalesStage;
  className?: string;
}

export function SalesStageBadge({ stage, className }: SalesStageBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(COLOR_CLASSES[STAGE_COLORS[stage] ?? "gray"], className)}
    >
      {salesStageLabel(stage)}
    </Badge>
  );
}
