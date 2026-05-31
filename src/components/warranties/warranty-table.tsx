"use client";

import { MoreHorizontal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RegPlate } from "@/components/shared/reg-plate";
import { StatusPill } from "./status-pill";
import { ProviderBadge } from "./provider-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import type { Vehicle, Warranty, WarrantyClaim } from "@/lib/types";

export interface WarrantyRow extends Warranty {
  vehicle: Vehicle | null;
  claimCount: number;
}

interface WarrantyTableProps {
  rows: WarrantyRow[];
  variant: "in-house" | "external";
  onRowClick: (warranty: WarrantyRow) => void;
  onFileClaim?: (warranty: WarrantyRow) => void;
  onMarkPurchased?: (warranty: WarrantyRow) => void;
}

function daysRemaining(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(endDate).getTime() - today.getTime()) / 86_400_000);
}

function remainingLabel(endDate: string): string {
  const d = daysRemaining(endDate);
  if (d < 0) return `Expired ${-d}d ago`;
  if (d === 0) return "Ends today";
  if (d < 60) return `${d}d remaining`;
  const months = Math.round(d / 30);
  return `${months}mo remaining`;
}

export function WarrantyTable({
  rows,
  variant,
  onRowClick,
  onFileClaim,
  onMarkPurchased,
}: WarrantyTableProps) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vehicle</TableHead>
            <TableHead>Customer</TableHead>
            {variant === "in-house" ? (
              <>
                <TableHead>Coverage period</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead className="text-center">Claims</TableHead>
              </>
            ) : (
              <>
                <TableHead>Provider</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Purchase</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </>
            )}
            <TableHead>Status</TableHead>
            <TableHead className="w-12"> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-row-action]")) return;
                onRowClick(row);
              }}
              className="cursor-pointer"
            >
              <TableCell className="font-medium">
                {row.vehicle ? (
                  <div className="flex items-center gap-2">
                    <RegPlate registration={row.vehicle.registration} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {row.vehicle.make} {row.vehicle.model}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">{row.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  {row.customerPhone}
                </div>
              </TableCell>
              {variant === "in-house" ? (
                <>
                  <TableCell className="text-xs">
                    {formatDate(row.startDate)} → {formatDate(row.endDate)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {remainingLabel(row.endDate)}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {row.claimCount > 0 ? (
                      <span className="font-medium">{row.claimCount}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell>
                    <ProviderBadge provider={row.provider} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(row.startDate)} → {formatDate(row.endDate)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={row.purchaseStatus} />
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrency(row.costToDealership)}
                  </TableCell>
                </>
              )}
              <TableCell>
                <StatusPill status={row.status} />
              </TableCell>
              <TableCell data-row-action>
                <RowActions
                  row={row}
                  variant={variant}
                  onOpen={() => onRowClick(row)}
                  onFileClaim={onFileClaim}
                  onMarkPurchased={onMarkPurchased}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RowActions({
  row,
  variant,
  onOpen,
  onFileClaim,
  onMarkPurchased,
}: {
  row: WarrantyRow;
  variant: "in-house" | "external";
  onOpen: () => void;
  onFileClaim?: (warranty: WarrantyRow) => void;
  onMarkPurchased?: (warranty: WarrantyRow) => void;
}) {
  const { can } = usePermissions();
  const canEdit = can("warranty:edit");
  const isPendingExternal =
    variant === "external" && row.purchaseStatus === "pending";

  if (isPendingExternal) {
    return (
      <Button
        type="button"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onMarkPurchased?.(row);
        }}
        disabled={!canEdit}
        title={canEdit ? undefined : "Requires Warranty Edit capability"}
      >
        Mark purchased
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
          aria-label="Row actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}>View details</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onFileClaim?.(row)}
          disabled={row.status !== "active"}
        >
          File claim
        </DropdownMenuItem>
        {variant === "external" && row.purchaseStatus === "pending" && (
          <DropdownMenuItem
            onSelect={() => onMarkPurchased?.(row)}
            disabled={!canEdit}
          >
            Mark purchased
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ClaimsRow extends WarrantyClaim {
  vehicle: Vehicle | null;
  warranty: Warranty | null;
}

export function ClaimsTable({
  rows,
  onRowClick,
}: {
  rows: ClaimsRow[];
  onRowClick?: (claim: ClaimsRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vehicle</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead>Warranty</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={
                row.isComplaint
                  ? "cursor-pointer bg-destructive/5 hover:bg-destructive/10"
                  : "cursor-pointer"
              }
            >
              <TableCell>
                {row.vehicle ? (
                  <div className="flex items-center gap-2">
                    <RegPlate registration={row.vehicle.registration} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {row.vehicle.make} {row.vehicle.model}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">{row.customerName}</div>
                {row.isComplaint && (
                  <div className="text-xs font-medium uppercase tracking-wide text-destructive">
                    Complaint
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-[260px] truncate text-sm">
                {row.issueDescription}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.warranty
                  ? row.warranty.type === "external"
                    ? row.warranty.provider ?? "External"
                    : "In-house"
                  : "—"}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {formatCurrency(row.actualCost ?? row.estimatedCost ?? 0)}
              </TableCell>
              <TableCell>
                <StatusPill status={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
