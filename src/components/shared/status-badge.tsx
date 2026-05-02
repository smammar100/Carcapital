import { Badge } from "@/components/ui/badge";
import { VEHICLE_STATUSES, MAINTENANCE_STATUSES, SALES_STAGES } from "@/lib/constants";
import type {
  MaintenanceStatus,
  SalesStage,
  VehicleStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

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
  return (
    <Badge variant="outline" className={cn(COLOR_CLASSES[meta.color], className)}>
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

const STAGE_COLORS: Record<SalesStage, string> = {
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
  const meta = SALES_STAGES.find((s) => s.value === stage);
  return (
    <Badge variant="outline" className={cn(COLOR_CLASSES[STAGE_COLORS[stage]], className)}>
      {meta?.label ?? stage}
    </Badge>
  );
}
