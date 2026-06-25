"use client";

import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MaintenanceStatusBadge,
  SalesStageBadge,
  VehicleStatusBadge,
} from "@/components/shared/status-badge";
import { RegPlate } from "@/components/shared/reg-plate";
import { VehicleImage } from "@/components/shared/vehicle-image";
import {
  APPOINTMENT_OUTCOME_TONE,
  APPOINTMENT_STATUS_TONE,
  AT_INDICATOR_TONE,
  INVOICE_STATUS_TONE,
  LEAD_STATUS_TONE,
  RETURN_RESOLUTION_TONE,
  RETURN_STATUS_TONE,
  WARRANTY_STATUS_TONE,
  toneClass,
} from "@/lib/tone-maps";
import type {
  AppointmentOutcome,
  AppointmentStatus,
  InvoiceStatus,
  LeadStatus,
  ReturnResolutionPath,
  ReturnStatus,
  Vehicle,
  WarrantyStatus,
} from "@/lib/types";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Generic value-shaped cells
// ────────────────────────────────────────────────────────────────────────────

export function EmptyCell() {
  return <span className="text-muted-foreground/40">—</span>;
}

export function TextCell({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <EmptyCell />;
  return <span className="truncate">{String(value)}</span>;
}

export function PhoneCell({ value }: { value: string | null | undefined }) {
  if (!value) return <EmptyCell />;
  const stripped = value.replace(/\s+/g, "");
  return (
    <a
      href={`tel:${stripped}`}
      className="tabular-nums hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {value}
    </a>
  );
}

export function NumberCell({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || Number.isNaN(value))
    return <EmptyCell />;
  return (
    <span className="tabular-nums">
      {new Intl.NumberFormat("en-GB").format(value)}
    </span>
  );
}

export function CurrencyCell({
  value,
  bold,
}: {
  value: number | null | undefined;
  bold?: boolean;
}) {
  if (value === null || value === undefined) return <EmptyCell />;
  return (
    <span
      className={cn("tabular-nums", bold ? "font-semibold" : "font-medium")}
    >
      {formatCurrency(value)}
    </span>
  );
}

export function DateCell({ value }: { value: string | null | undefined }) {
  if (!value) return <EmptyCell />;
  return <span className="tabular-nums">{formatDate(value)}</span>;
}

export function DateRangeCell({
  start,
  end,
}: {
  start: string | null | undefined;
  end: string | null | undefined;
}) {
  if (!start && !end) return <EmptyCell />;
  return (
    <span className="tabular-nums text-xs">
      {start ? formatDate(start) : "—"}
      <span className="px-1 text-muted-foreground">→</span>
      {end ? formatDate(end) : "—"}
    </span>
  );
}

export function BooleanCell({ value }: { value: boolean | null | undefined }) {
  if (value === true) {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Check className="h-2.5 w-2.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <X className="h-2.5 w-2.5" />
    </span>
  );
}

export function SelectCell({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <EmptyCell />;
  return (
    <span className="inline-flex max-w-full items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-foreground/80">
      <span className="truncate">{String(value).replace(/_/g, " ")}</span>
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Domain-specific cells
// ────────────────────────────────────────────────────────────────────────────

export function VehicleCell({ vehicle }: { vehicle: Vehicle | null | undefined }) {
  if (!vehicle) return <EmptyCell />;
  return (
    <div className="flex items-center gap-2">
      <VehicleImage
        vehicle={vehicle}
        variant="thumb"
        className="h-9 w-12 shrink-0 rounded"
      />
      <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
        <RegPlate registration={vehicle.registration} size="sm" />
        <span className="font-mono text-xs text-muted-foreground">
          {vehicle.stockId}
        </span>
      </div>
    </div>
  );
}

export function UserCell({
  name,
  email,
}: {
  name: string | null | undefined;
  email?: string | null;
}) {
  if (!name) return <EmptyCell />;
  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        <AvatarFallback className="text-2xs">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-xs font-medium">{name}</span>
        {email ? (
          <span className="truncate text-xs text-muted-foreground">
            {email}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ChannelsCell({
  channels,
  onToggle,
}: {
  channels: Record<string, boolean>;
  onToggle?: (channel: string) => void;
}) {
  const entries = Object.entries(channels);
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([channel, enabled]) => {
        const cls = cn(
          "rounded-md px-1.5 py-0.5 text-2xs font-medium capitalize",
          enabled
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground",
          onToggle && "cursor-pointer transition-opacity hover:opacity-80",
        );
        if (!onToggle) {
          return (
            <span key={channel} className={cls}>
              {channel}
            </span>
          );
        }
        return (
          <button
            key={channel}
            type="button"
            className={cls}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(channel);
            }}
          >
            {channel}
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pill cells — wrap existing badges where possible
// ────────────────────────────────────────────────────────────────────────────

export function VehicleStatusCell({
  status,
}: {
  status: Parameters<typeof VehicleStatusBadge>[0]["status"] | null | undefined;
}) {
  if (!status) return <EmptyCell />;
  return <VehicleStatusBadge status={status} />;
}

export function SalesStageCell({
  stage,
}: {
  stage: Parameters<typeof SalesStageBadge>[0]["stage"] | null | undefined;
}) {
  if (!stage) return <EmptyCell />;
  return <SalesStageBadge stage={stage} />;
}

export function MaintenanceStatusCell({
  status,
}: {
  status:
    | Parameters<typeof MaintenanceStatusBadge>[0]["status"]
    | null
    | undefined;
}) {
  if (!status) return <EmptyCell />;
  return <MaintenanceStatusBadge status={status} />;
}

function tonePill(label: string, tone: string | undefined): ReactNode {
  return (
    <Badge variant="outline" className={cn(toneClass(tone))}>
      {label.replace(/_/g, " ")}
    </Badge>
  );
}

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  appointment_booked: "Appointment",
  lost: "Lost",
};

export function LeadStatusCell({
  status,
}: {
  status: LeadStatus | null | undefined;
}) {
  if (!status) return <EmptyCell />;
  return tonePill(LEAD_STATUS_LABEL[status] ?? status, LEAD_STATUS_TONE[status]);
}

const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export function AppointmentStatusCell({
  status,
}: {
  status: AppointmentStatus | null | undefined;
}) {
  if (!status) return <EmptyCell />;
  return tonePill(
    APPOINTMENT_STATUS_LABEL[status] ?? status,
    APPOINTMENT_STATUS_TONE[status],
  );
}

const APPOINTMENT_OUTCOME_LABEL: Record<AppointmentOutcome, string> = {
  pending: "Pending",
  test_drive: "Test drive",
  offer_made: "Offer made",
  deposit_taken: "Deposit",
  sold: "Sold",
  lost: "Lost",
};

export function AppointmentOutcomeCell({
  outcome,
}: {
  outcome: AppointmentOutcome | null | undefined;
}) {
  if (!outcome) return <EmptyCell />;
  return tonePill(
    APPOINTMENT_OUTCOME_LABEL[outcome] ?? outcome,
    APPOINTMENT_OUTCOME_TONE[outcome],
  );
}

const WARRANTY_STATUS_LABEL: Record<WarrantyStatus, string> = {
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function WarrantyStatusCell({
  status,
}: {
  status: WarrantyStatus | null | undefined;
}) {
  if (!status) return <EmptyCell />;
  return tonePill(
    WARRANTY_STATUS_LABEL[status] ?? status,
    WARRANTY_STATUS_TONE[status],
  );
}

const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  issued: "Issued",
  cancelled: "Cancelled",
};

export function InvoiceStatusCell({
  status,
}: {
  status: InvoiceStatus | null | undefined;
}) {
  if (!status) return <EmptyCell />;
  return tonePill(
    INVOICE_STATUS_LABEL[status] ?? status,
    INVOICE_STATUS_TONE[status],
  );
}

const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  resolved: "Resolved",
  rejected: "Rejected",
};

export function ReturnStatusCell({
  status,
}: {
  status: ReturnStatus | null | undefined;
}) {
  if (!status) return <EmptyCell />;
  return tonePill(
    RETURN_STATUS_LABEL[status] ?? status,
    RETURN_STATUS_TONE[status],
  );
}

const RETURN_RESOLUTION_LABEL: Record<ReturnResolutionPath, string> = {
  vendor: "Vendor",
  supplier: "Supplier",
  g_trader: "G-Trader",
  other: "Other",
};

export function ReturnResolutionCell({
  resolution,
}: {
  resolution: ReturnResolutionPath | null | undefined;
}) {
  if (!resolution) return <EmptyCell />;
  return tonePill(
    RETURN_RESOLUTION_LABEL[resolution] ?? resolution,
    RETURN_RESOLUTION_TONE[resolution],
  );
}

const AT_INDICATOR_LABEL: Record<string, string> = {
  great: "Great price",
  good: "Good price",
  above_average: "Above avg",
  high: "Overpriced",
  unrated: "Unrated",
};

export function AtIndicatorCell({
  indicator,
}: {
  indicator: string | null | undefined;
}) {
  if (!indicator) return <EmptyCell />;
  return tonePill(
    AT_INDICATOR_LABEL[indicator] ?? indicator,
    AT_INDICATOR_TONE[indicator],
  );
}
