"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, MoveRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  VEHICLE_LOCATION_LABELS,
  type UUID,
  type Vehicle,
  type VehicleLocation,
  type Vendor,
  type User,
} from "@/lib/types";
import { locationService } from "@/lib/services/location-service";
import { exportCsv } from "@/components/data-grid";
import { LocationBadge } from "./location-badge";

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

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Stock ID</th>
              <th className="px-3 py-2 text-left font-medium">Reg</th>
              <th className="px-3 py-2 text-left font-medium">Make / Model</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              {location === "staff" ? (
                <th className="px-3 py-2 text-left font-medium">Expected back</th>
              ) : null}
              <th className="px-3 py-2 text-right font-medium">Days here</th>
              <th className="px-3 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <SkeletonRows colCount={location === "staff" ? 7 : 6} />
            ) : filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={location === "staff" ? 7 : 6}
                  className="px-3 py-8 text-center text-sm italic text-muted-foreground"
                >
                  No cars at {VEHICLE_LOCATION_LABELS[location]}.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t transition-colors hover:bg-muted/30"
                >
                  <td className="px-3 py-2 align-top">
                    <Link
                      href={`/vehicles/${r.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {r.stockId}
                    </Link>
                    {/* Secondary line: workshop / staff name (Garage / Staff tabs) */}
                    {r.externalVendorId ? (
                      <div className="text-[11px] text-muted-foreground">
                        {vendorById[r.externalVendorId]?.name ?? "Unknown vendor"}
                      </div>
                    ) : r.staffUserId ? (
                      <div className="text-[11px] text-muted-foreground">
                        {userById[r.staffUserId]?.name ?? "Unknown staff"}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {r.registration}
                  </td>
                  <td className="px-3 py-2">
                    {r.make} {r.model}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {statusLabel(r.status)}
                    {r.outForTestDrive ? (
                      <div className="mt-1">
                        <LocationBadge
                          location={r.currentLocation}
                          outForTestDrive
                          testDriveExpectedBackAt={r.testDriveExpectedBackAt}
                          compact
                        />
                      </div>
                    ) : null}
                  </td>
                  {location === "staff" ? (
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.expectedReturnAt
                        ? new Date(r.expectedReturnAt).toLocaleString(undefined, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right tabular-nums">
                    {daysSince(r.locationSince)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => onRequestMove(r.id)}
                    >
                      Move <MoveRight className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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

function SkeletonRows({ colCount }: { colCount: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-t">
          {Array.from({ length: colCount }).map((__, j) => (
            <td key={j} className="px-3 py-3">
              <Skeleton className="h-3 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
