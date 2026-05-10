"use client";

import { Badge as SpectrumBadge } from "@react-spectrum/s2";
import {
  VEHICLE_STATUSES,
  MAINTENANCE_STATUSES,
  SALES_STAGES,
} from "@/lib/constants";
import type {
  MaintenanceStatus,
  SalesStage,
  VehicleStatus,
} from "@/lib/types";

/**
 * v4.5 — status badges using Spectrum 2 Badge variants directly.
 * Replaces the prior Tailwind COLOR_CLASSES map with Spectrum's native palette.
 */
type SpectrumColor =
  | "accent"
  | "informative"
  | "neutral"
  | "positive"
  | "notice"
  | "negative"
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "indigo"
  | "purple"
  | "pink";

const TONE_TO_SPECTRUM: Record<string, SpectrumColor> = {
  blue: "blue",
  yellow: "yellow",
  orange: "orange",
  green: "green",
  purple: "purple",
  pink: "pink",
  gray: "gray",
  red: "red",
};

interface VehicleStatusBadgeProps {
  status: VehicleStatus;
  className?: string;
}

export function VehicleStatusBadge({
  status,
  className,
}: VehicleStatusBadgeProps) {
  const meta = VEHICLE_STATUSES.find((s) => s.value === status);
  const variant = TONE_TO_SPECTRUM[meta?.color ?? "gray"] ?? "neutral";
  return (
    <SpectrumBadge variant={variant} UNSAFE_className={className}>
      {meta?.label ?? status}
    </SpectrumBadge>
  );
}

const MAINTENANCE_COLORS: Record<MaintenanceStatus, SpectrumColor> = {
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
    <SpectrumBadge
      variant={MAINTENANCE_COLORS[status]}
      UNSAFE_className={className}
    >
      {meta?.label ?? status}
    </SpectrumBadge>
  );
}

const STAGE_COLORS: Record<SalesStage, SpectrumColor> = {
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
    <SpectrumBadge
      variant={STAGE_COLORS[stage]}
      UNSAFE_className={className}
    >
      {meta?.label ?? stage}
    </SpectrumBadge>
  );
}
