"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Car,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type SortKey = "daysInStock" | "make" | "year" | "listingPrice" | "status";
type SortDir = "asc" | "desc";

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
  const [sortKey, setSortKey] = useState<SortKey>("daysInStock");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

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
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "daysInStock":
          return (a.daysInStock - b.daysInStock) * dir;
        case "year":
          return (a.year - b.year) * dir;
        case "listingPrice":
          return ((a.listingPrice ?? 0) - (b.listingPrice ?? 0)) * dir;
        case "make":
          return a.make.localeCompare(b.make) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
      }
    });
    return out;
  }, [vehicles, search, statusFilter, bodyFilter, fuelFilter, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">All Vehicles</h1>
          <p className="text-sm text-muted-foreground">
            {filtered ? `${filtered.length} matching` : "Loading inventory…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/vehicles/new">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => filtered && exportCsv(filtered)}
            disabled={!filtered || filtered.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
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
        <Card className="p-3">
          <div className="grid gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles found"
          description="Try clearing filters or add a new vehicle to your stock."
          action={
            <Button asChild size="sm">
              <Link href="/vehicles/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Vehicle
              </Link>
            </Button>
          }
        />
      ) : view === "table" ? (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Image</TableHead>
                <TableHead>Reg</TableHead>
                <TableHead
                  onClick={() => toggleSort("make")}
                  className="cursor-pointer select-none"
                >
                  Make / Model
                </TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Fuel</TableHead>
                <TableHead>Body</TableHead>
                <TableHead>Mileage</TableHead>
                <TableHead
                  onClick={() => toggleSort("daysInStock")}
                  className="cursor-pointer select-none"
                >
                  Days
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("status")}
                  className="cursor-pointer select-none"
                >
                  Status
                </TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead
                  onClick={() => toggleSort("listingPrice")}
                  className="cursor-pointer select-none text-right"
                >
                  Web Price
                </TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead>MOT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => {
                const profit =
                  v.listingPrice !== null ? v.listingPrice - v.baseCost : null;
                return (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/vehicles/${v.id}`)}
                  >
                    <TableCell>
                      <VehicleImage
                        vehicle={v}
                        variant="thumb"
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <RegPlate registration={v.registration} size="sm" />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium">
                          {v.make} {v.model}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {v.year} · {v.stockId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {v.variantCode ?? "—"}
                    </TableCell>
                    <TableCell className="capitalize">{v.fuelType}</TableCell>
                    <TableCell className="capitalize">{v.bodyType}</TableCell>
                    <TableCell className="tabular-nums">
                      {v.mileage.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <DaysInStockChip days={v.daysInStock} />
                    </TableCell>
                    <TableCell>
                      <VehicleStatusBadge status={v.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(v.baseCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(v.listingPrice)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        profit !== null && profit > 0 && "text-emerald-600",
                        profit !== null && profit < 0 && "text-rose-600",
                      )}
                    >
                      {profit !== null ? formatCurrency(profit) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(v.motExpiry)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => (
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
    </div>
  );
}
