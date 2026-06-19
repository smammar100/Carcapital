"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Download, MoveRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RegPlate } from "@/components/shared/reg-plate";
import { cn } from "@/lib/utils";
import {
  VEHICLE_LOCATION_LABELS,
  type UUID,
  type VehicleLocation,
  type VehicleStatus,
  type Vendor,
  type User,
} from "@/lib/types";
import { locationService } from "@/lib/services/location-service";
import { exportCsv } from "@/components/data-grid";
import { LocationBadge } from "./location-badge";

// Flat status pill tones — kept in sync with the Master Sheet / All
// Vehicles grids so a car's status reads identically across inventory.
const STATUS_TONE: Record<VehicleStatus, string> = {
  received: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  inspection_pending:
    "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300",
  being_prepared:
    "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
  photos_pending:
    "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300",
  photos_ready:
    "bg-lime-50 text-lime-700 dark:bg-lime-950/30 dark:text-lime-300",
  ready: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
  listed:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  reserved: "bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300",
  sold: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  returned: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
};

function StatusPill({ status }: { status: string }) {
  const tone =
    STATUS_TONE[status as VehicleStatus] ??
    "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

interface LocationTabProps {
  location: VehicleLocation;
  companyId: UUID;
  vendors: Vendor[];
  users: User[];
  /**
   * Bumped by the parent after every successful move so the tab can
   * re-fetch its rows. Pure state-bump pattern — no callback wiring.
   */
  refreshToken?: number;
  onRequestMove: (vehicleId: UUID) => void;
}

interface TabRow {
  id: UUID;
  registration: string;
  stockId: string;
  make: string;
  model: string;
  status: string;
  currentLocation: VehicleLocation;
  locationSince: string;
  outForTestDrive: boolean;
  testDriveExpectedBackAt: string | null;
  externalVendorId?: UUID | null;
  staffUserId?: UUID | null;
  expectedReturnAt?: string | null;
}

function daysSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  const rem = days - weeks * 7;
  return rem === 0 ? `${weeks}w` : `${weeks}w ${rem}d`;
}

function statusLabel(s: string): string {
  return s
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * One tab pane on `/admin/locations`. Renders the cars currently at this
 * location, with a search box, a Garage/Staff sub-filter chip set, CSV
 * export, and a Move button per row. The page owns the MoveDialog state
 * and the global vendors/users lookup.
 */
export function LocationTab({
  location,
  companyId,
  vendors,
  users,
  refreshToken = 0,
  onRequestMove,
}: LocationTabProps) {
  const [rows, setRows] = useState<TabRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [filterId, setFilterId] = useState<UUID | null>(null);

  // Pre-index lookups so secondary-line lookups stay O(1).
  const vendorById = useMemo(
    () => Object.fromEntries(vendors.map((v) => [v.id, v])),
    [vendors],
  );
  const userById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u])),
    [users],
  );

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    locationService
      .getByLocation(companyId, location)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, location, refreshToken]);

  // Filter-chip options for garage / staff tabs — distinct vendor / staff
  // ids in the currently-rendered rows.
  const filterChips = useMemo(() => {
    if (!rows) return [];
    if (location === "garage") {
      const ids = new Set<UUID>();
      for (const r of rows) if (r.externalVendorId) ids.add(r.externalVendorId);
      return [...ids].map((id) => ({ id, label: vendorById[id]?.name ?? "—" }));
    }
    if (location === "staff") {
      const ids = new Set<UUID>();
      for (const r of rows) if (r.staffUserId) ids.add(r.staffUserId);
      return [...ids].map((id) => ({ id, label: userById[id]?.name ?? "—" }));
    }
    return [];
  }, [rows, location, vendorById, userById]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (location === "garage" && filterId && r.externalVendorId !== filterId)
        return false;
      if (location === "staff" && filterId && r.staffUserId !== filterId)
        return false;
      if (!q) return true;
      return (
        r.registration.toLowerCase().includes(q) ||
        r.stockId.toLowerCase().includes(q) ||
        `${r.make} ${r.model}`.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filterId, location]);

  function handleExport() {
    if (!filteredRows.length) return;
    const cols = [
      { key: "stockId", label: "Stock ID", get: (r: TabRow) => r.stockId },
      { key: "registration", label: "Reg", get: (r: TabRow) => r.registration },
      {
        key: "vehicle",
        label: "Make/Model",
        get: (r: TabRow) => `${r.make} ${r.model}`,
      },
      { key: "status", label: "Status", get: (r: TabRow) => statusLabel(r.status) },
      {
        key: "daysHere",
        label: "Days here",
        get: (r: TabRow) => daysSince(r.locationSince),
      },
      {
        key: "context",
        label: "Workshop / Staff",
        get: (r: TabRow) =>
          r.externalVendorId
            ? (vendorById[r.externalVendorId]?.name ?? "")
            : r.staffUserId
              ? (userById[r.staffUserId]?.name ?? "")
              : "",
      },
    ];
    exportCsv(
      filteredRows,
      // ColumnDef from data-grid expects `key` as a string; ours match.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cols as any,
      `locations-${location}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${VEHICLE_LOCATION_LABELS[location]}…`}
            className="h-9 w-64 pl-8"
          />
        </div>

        {/* Garage / Staff sub-filter chips */}
        {filterChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterId(null)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                filterId === null
                  ? "border-foreground/30 bg-muted font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/60",
              )}
            >
              All
            </button>
            {filterChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilterId(filterId === c.id ? null : c.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  filterId === c.id
                    ? "border-foreground/30 bg-muted font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/60",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto gap-1.5"
          onClick={handleExport}
          disabled={filteredRows.length === 0}
        >
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      {/* List (Variation E) */}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
        {rows === null ? (
          <ListSkeleton />
        ) : filteredRows.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm italic text-muted-foreground">
            No cars at {VEHICLE_LOCATION_LABELS[location]}.
          </li>
        ) : (
          filteredRows.map((r) => {
            const context = r.externalVendorId
              ? (vendorById[r.externalVendorId]?.name ?? "Unknown vendor")
              : r.staffUserId
                ? (userById[r.staffUserId]?.name ?? "Unknown staff")
                : null;
            const back =
              location === "staff" && r.expectedReturnAt
                ? formatBack(r.expectedReturnAt)
                : null;
            return (
              <li
                key={r.id}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <RegPlate registration={r.registration} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/vehicles/${r.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {r.make} {r.model}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.stockId}
                    {context ? ` · ${context}` : ""}
                    {back ? ` · back ${back}` : ""}
                  </div>
                </div>
                {r.outForTestDrive ? (
                  <LocationBadge
                    location={r.currentLocation}
                    outForTestDrive
                    testDriveExpectedBackAt={r.testDriveExpectedBackAt}
                    compact
                  />
                ) : null}
                <StatusPill status={r.status} />
                <span className="inline-flex w-20 shrink-0 items-center justify-end gap-1 text-xs tabular-nums text-muted-foreground">
                  <Clock className="size-3" />
                  {daysSince(r.locationSince)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 gap-1"
                  onClick={() => onRequestMove(r.id)}
                >
                  Move <MoveRight className="size-3.5" />
                </Button>
              </li>
            );
          })
        )}
      </ul>

      {rows !== null ? (
        <div className="text-xs text-muted-foreground">
          {filteredRows.length} of {rows.length} car
          {rows.length === 1 ? "" : "s"} at {VEHICLE_LOCATION_LABELS[location]}
          {query || filterId ? " (filtered)" : ""}
        </div>
      ) : null}
    </div>
  );
}

/** Expected-back timestamp for the staff sub-line ("· back 21 Jun, 14:30"). */
function formatBack(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-5 w-16 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-10 shrink-0" />
          <Skeleton className="h-7 w-16 shrink-0 rounded-md" />
        </li>
      ))}
    </>
  );
}
