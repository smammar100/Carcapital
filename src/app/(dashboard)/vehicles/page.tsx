"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  List,
  Plus,
  Search as SearchIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { BodyType, FuelType, Vehicle, VehicleStatus } from "@/lib/types";
import { VEHICLE_STATUSES, BODY_TYPES, FUEL_TYPES } from "@/lib/constants";
import {
  formatCurrency,
  formatDate,
  cn,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  DataGridSkeletonRows,
  DataGridPagination,
  DataGridColumnsButton,
  useColumnVisibility,
  DataGridDensityToggle,
  useDensity,
} from "@/components/data-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegPlate } from "@/components/shared/reg-plate";
import { VehicleStatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DaysInStockChip } from "@/components/shared/days-in-stock-chip";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { PageHelper } from "@/components/layout/page-helper";
import {
  type ColumnDef,
  DataGridFooterRow,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridTable,
  VehicleCell,
} from "@/components/data-grid";

type SortKey =
  | "registration"
  | "daysInStock"
  | "make"
  | "year"
  | "mileage"
  | "variant"
  | "fuelType"
  | "bodyType"
  | "totalCost"
  | "listingPrice"
  | "profit"
  | "status"
  | "motExpiry";
type SortDir = "asc" | "desc";

const SORT_KEYS = new Set<string>([
  "registration",
  "daysInStock",
  "make",
  "year",
  "mileage",
  "variant",
  "fuelType",
  "bodyType",
  "totalCost",
  "listingPrice",
  "profit",
  "status",
  "motExpiry",
]);

/** SPEC Point 8 — push nullish values to the bottom in BOTH directions. */
function cmpNulls<T>(
  a: T,
  b: T,
  isNull: (v: T) => boolean,
  base: (a: T, b: T) => number,
  dir: number,
): number {
  const an = isNull(a);
  const bn = isNull(b);
  if (an && bn) return 0;
  if (an) return 1; // a sinks regardless of dir
  if (bn) return -1;
  return base(a, b) * dir;
}

const PAGE_SIZE = 25;

// Status sorts by lifecycle order (received → … → returned), not
// alphabetically — `VEHICLE_STATUSES` is already declared in lifecycle
// order, so its index is the natural rank.
const STATUS_ORDER: Record<string, number> = Object.fromEntries(
  VEHICLE_STATUSES.map((s, i) => [s.value, i]),
);

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportCsv(rows: Vehicle[]): void {
  const head = [
    "Reg",
    "Stock ID",
    "Make",
    "Model",
    "Variant",
    "Year",
    "Colour",
    "Fuel",
    "Body",
    "Trans",
    "Mileage",
    "Status",
    "Days in Stock",
    "Total Cost",
    "Listing Price",
  ];
  const body = rows.map((v) =>
    [
      v.registration,
      v.stockId,
      v.make,
      v.model,
      v.variantCode ?? "",
      String(v.year),
      v.colour,
      v.fuelType,
      v.bodyType,
      v.transmission,
      String(v.mileage),
      v.status,
      String(v.daysInStock),
      String(v.baseCost),
      v.listingPrice !== null ? String(v.listingPrice) : "",
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [head.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vehicles-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function VehiclesPage() {
  const { company } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");
  const [bodyFilter, setBodyFilter] = useState<BodyType | "all">("all");
  const [fuelFilter, setFuelFilter] = useState<FuelType | "all">("all");
  const [view, setView] = useState<"table" | "card">("table");
  // SPEC Point 8 — sort lives in the URL (?sort=&dir=) so it survives
  // refresh + back-button. URL is the single source of truth (no local
  // sort state → no setState-in-effect). Absent params = default order
  // (registration A→Z, no active indicator).
  const sortParam = searchParams.get("sort");
  const sortKey: SortKey | null =
    sortParam && SORT_KEYS.has(sortParam) ? (sortParam as SortKey) : null;
  const sortDir: SortDir =
    searchParams.get("dir") === "desc" ? "desc" : "asc";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Reset to first page whenever filters/search/sort change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, bodyFilter, fuelFilter, sortKey, sortDir]);

  // Sync `?q=` from header search
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
  }, [searchParams]);

  // Sync `?status=`
  useEffect(() => {
    const s = searchParams.get("status");
    if (s && VEHICLE_STATUSES.some((v) => v.value === s)) {
      setStatusFilter(s as VehicleStatus);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!company) return;
    setVehicles(null);
    setError(null);
    vehicleService
      .getAll(company.id)
      .then(setVehicles)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load vehicles");
      });
  }, [company]);

  const filtered = useMemo(() => {
    if (!vehicles) return null;
    const term = search.trim().toLowerCase().replace(/\s+/g, "");
    let out = [...vehicles];
    if (statusFilter !== "all") out = out.filter((v) => v.status === statusFilter);
    if (bodyFilter !== "all") out = out.filter((v) => v.bodyType === bodyFilter);
    if (fuelFilter !== "all") out = out.filter((v) => v.fuelType === fuelFilter);
    if (term) {
      out = out.filter((v) => {
        const blob = `${v.registration}${v.stockId}${v.make}${v.model}${v.variantCode ?? ""}`
          .toLowerCase()
          .replace(/\s+/g, "");
        return blob.includes(term);
      });
    }
    out.sort((a, b) => {
      // Default (no active sort) = registration A→Z.
      if (sortKey === null) {
        return a.registration.localeCompare(b.registration);
      }
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "registration":
          return a.registration.localeCompare(b.registration) * dir;
        case "daysInStock":
          return (a.daysInStock - b.daysInStock) * dir;
        case "year":
          return (a.year - b.year) * dir;
        case "mileage":
          return (a.mileage - b.mileage) * dir;
        case "totalCost":
          return (a.baseCost - b.baseCost) * dir;
        case "listingPrice":
          // Empty web price sinks to the bottom in both directions.
          return cmpNulls(
            a.listingPrice,
            b.listingPrice,
            (v) => v === null,
            (x, y) => (x as number) - (y as number),
            dir,
          );
        case "profit": {
          const pa = a.listingPrice !== null ? a.listingPrice - a.baseCost : null;
          const pb = b.listingPrice !== null ? b.listingPrice - b.baseCost : null;
          return cmpNulls(
            pa,
            pb,
            (v) => v === null,
            (x, y) => (x as number) - (y as number),
            dir,
          );
        }
        case "make":
          return (
            `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`) * dir
          );
        case "variant":
          return (a.variantCode ?? "").localeCompare(b.variantCode ?? "") * dir;
        case "fuelType":
          return a.fuelType.localeCompare(b.fuelType) * dir;
        case "bodyType":
          return a.bodyType.localeCompare(b.bodyType) * dir;
        case "status":
          return (
            ((STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)) *
            dir
          );
        case "motExpiry":
          // Null MOT date sinks to the bottom in both directions.
          return cmpNulls(
            a.motExpiry,
            b.motExpiry,
            (v) => !v,
            (x, y) => String(x).localeCompare(String(y)),
            dir,
          );
        default:
          return 0;
      }
    });

    return out;
  }, [vehicles, search, statusFilter, bodyFilter, fuelFilter, sortKey, sortDir]);

  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    if (!filtered) return null;
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const tableCols = useMemo<ColumnDef<Vehicle>[]>(
    () => [
      {
        key: "vehicle",
        label: "Vehicle",
        type: "vehicle",
        sticky: true,
        width: 200,
        sortable: true,
        sortKey: "registration",
        render: (v) => <VehicleCell vehicle={v} />,
      },
      {
        key: "makeModel",
        label: "Make / Model",
        type: "text",
        width: 180,
        sortable: true,
        sortKey: "make",
        render: (v) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">
              {v.make} {v.model}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {v.year}
            </span>
          </div>
        ),
      },
      {
        key: "variantCode",
        label: "Variant",
        type: "text",
        width: 220,
        sortable: true,
        sortKey: "variant",
      },
      {
        key: "fuelType",
        label: "Fuel",
        type: "select",
        width: 100,
        sortable: true,
      },
      {
        key: "bodyType",
        label: "Body",
        type: "select",
        width: 110,
        sortable: true,
      },
      {
        key: "mileage",
        label: "Mileage",
        type: "number",
        width: 100,
        sortable: true,
      },
      {
        key: "daysInStock",
        label: "Days",
        type: "custom",
        width: 80,
        sortable: true,
        render: (v) => <DaysInStockChip days={v.daysInStock} />,
      },
      {
        key: "status",
        label: "Status",
        type: "vehicleStatus",
        width: 140,
        sortable: true,
        render: (v) => <VehicleStatusBadge status={v.status} />,
      },
      {
        key: "baseCost",
        label: "Total cost",
        type: "currency",
        width: 110,
        sortable: true,
        sortKey: "totalCost",
      },
      {
        key: "listingPrice",
        label: "Web price",
        type: "currency",
        width: 110,
        sortable: true,
      },
      {
        key: "profit",
        label: "Profit",
        type: "currency",
        width: 110,
        sortable: true,
        get: (v) =>
          v.listingPrice !== null ? v.listingPrice - v.baseCost : null,
        render: (v) => {
          const profit =
            v.listingPrice !== null ? v.listingPrice - v.baseCost : null;
          if (profit === null)
            return <span className="text-muted-foreground/40">—</span>;
          return (
            <span
              className={cn(
                "tabular-nums font-medium",
                profit > 0 && "text-emerald-600",
                profit < 0 && "text-rose-600",
              )}
            >
              {formatCurrency(profit)}
            </span>
          );
        },
      },
      {
        key: "motExpiry",
        label: "MOT",
        type: "date",
        width: 120,
        sortable: true,
      },
    ],
    [],
  );

  // Complex-table controls: row density + per-column show/hide. The
  // identity "vehicle" column is locked (always visible).
  const { density, setDensity } = useDensity();
  const { hiddenKeys, setHiddenKeys, visibleCols } =
    useColumnVisibility(tableCols);
  const lockedKeys = useMemo(() => new Set(["vehicle"]), []);

  // SPEC Point 8 — 3-state cycle per column: a different column → asc;
  // same column asc → desc; same column desc → cleared (default order).
  // State is written to the URL (router.replace, preserving q/status so
  // sort + filter combine) so it survives refresh + back-button.
  function applySort(nextKey: SortKey | null, nextDir: SortDir) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextKey) {
      params.set("sort", nextKey);
      params.set("dir", nextDir);
    } else {
      params.delete("sort");
      params.delete("dir");
    }
    const qs = params.toString();
    router.replace(qs ? `/vehicles?${qs}` : "/vehicles", { scroll: false });
  }

  function toggleSort(k: SortKey) {
    if (k !== sortKey) applySort(k, "asc");
    else if (sortDir === "asc") applySort(k, "desc");
    else applySort(null, "asc"); // third click → back to default
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">All Vehicles</h1>
          <PageHelper>
            Every car since the business opened. Sold, unsold, returned, all
            of them. For historical analysis and reporting.
          </PageHelper>
          <p className="text-sm text-muted-foreground">
            {filtered ? `${filtered.length} matching` : "Loading inventory…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => filtered && exportCsv(filtered)}
            disabled={!filtered || filtered.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          <Button asChild>
            <Link href="/inventory/add-vehicle">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Vehicle
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reg, stock ID, model…"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as VehicleStatus | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {VEHICLE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bodyFilter} onValueChange={(v) => setBodyFilter(v as BodyType | "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Body" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bodies</SelectItem>
            {BODY_TYPES.map((b) => (
              <SelectItem key={b} value={b} className="capitalize">
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fuelFilter} onValueChange={(v) => setFuelFilter(v as FuelType | "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Fuel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fuels</SelectItem>
            {FUEL_TYPES.map((f) => (
              <SelectItem key={f} value={f} className="capitalize">
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {view === "table" && (
            <>
              <DataGridColumnsButton
                columns={tableCols}
                hiddenKeys={hiddenKeys}
                onChange={setHiddenKeys}
                lockedKeys={lockedKeys}
              />
              <DataGridDensityToggle density={density} onChange={setDensity} />
            </>
          )}
          <div className="flex rounded-md border bg-background p-0.5">
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "card" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setView("card")}
              aria-pressed={view === "card"}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <EmptyState
          icon={Car}
          title="Couldn't load vehicles"
          description={error}
          action={
            <Button variant="outline" onClick={() => location.reload()}>
              Retry
            </Button>
          }
        />
      ) : !filtered ? (
        // Row-aware skeleton — matches the table's column structure so
        // the layout doesn't shift when real data lands. See the data-
        // table case study at /docs/case-studies/data-tables.md.
        <DataGridShell>
          <DataGridTable cols={visibleCols} density={density}>
            <DataGridHeaderRow
              cols={visibleCols}
              sortKey={sortKey ?? undefined}
              sortDir={sortDir}
              onSort={(k) => toggleSort(k as SortKey)}
            />
            <tbody>
              <DataGridSkeletonRows columns={visibleCols} rows={8} />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles found"
          description="Try clearing filters or add a new vehicle to your stock."
          action={
            <Button asChild size="sm">
              <Link href="/inventory/add-vehicle">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Vehicle
              </Link>
            </Button>
          }
        />
      ) : view === "table" ? (
        <DataGridShell>
          <DataGridTable cols={visibleCols} density={density}>
            <DataGridHeaderRow
              cols={visibleCols}
              sortKey={sortKey ?? undefined}
              sortDir={sortDir}
              onSort={(k) => toggleSort(k as SortKey)}
            />
            <tbody>
              {(pagedRows ?? []).map((v, i) => (
                <DataGridRow
                  key={v.id}
                  row={v}
                  cols={visibleCols}
                  index={i}
                  onClick={(row) => router.push(`/vehicles/${row.id}`)}
                />
              ))}
              <DataGridFooterRow
                label="New vehicle"
                span={visibleCols.length}
                href="/inventory/add-vehicle"
              />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(pagedRows ?? []).map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer overflow-hidden p-0 transition-colors hover:bg-muted/40"
              onClick={() => router.push(`/vehicles/${v.id}`)}
            >
              <VehicleImage vehicle={v} variant="card" className="rounded-none" />
              <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <RegPlate registration={v.registration} size="md" />
                <VehicleStatusBadge status={v.status} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {v.make} {v.model}
                </span>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {v.variantCode ?? "—"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="block text-foreground tabular-nums font-medium">
                    {v.year}
                  </span>
                  Year
                </div>
                <div>
                  <span className="block text-foreground tabular-nums font-medium">
                    {v.mileage.toLocaleString()}
                  </span>
                  Miles
                </div>
                <div className="capitalize">
                  <span className="block text-foreground font-medium">
                    {v.fuelType}
                  </span>
                  Fuel
                </div>
                <div>
                  <DaysInStockChip days={v.daysInStock} />
                  <span className="ml-1">Days</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-xs text-muted-foreground">
                  {v.stockId}
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {formatCurrency(v.listingPrice)}
                </span>
              </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtered && filtered.length > PAGE_SIZE && (
        // Shared pagination primitive — replaced the bespoke local
        // PaginationBar with the one from `@/components/data-grid`.
        // Same UI, same default page size, but the implementation is
        // now reused by every list page.
        <Card className="p-0">
          <DataGridPagination
            page={safePage}
            pageSize={PAGE_SIZE}
            totalPages={totalPages}
            total={filtered.length}
            onPageChange={setPage}
          />
        </Card>
      )}
    </div>
  );
}
