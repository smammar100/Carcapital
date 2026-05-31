"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { warrantyService } from "@/lib/services/warranty-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { claimService } from "@/lib/services/claim-service";
import type { Vehicle, Warranty, WarrantyClaim, WarrantyStatus } from "@/lib/types";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiStrip } from "@/components/warranties/kpi-strip";
import { FilterChips, type FilterOption } from "@/components/warranties/filter-chips";
import {
  WarrantyTable,
  type WarrantyRow,
} from "@/components/warranties/warranty-table";
import { NewWarrantyDialog } from "@/components/warranties/new-warranty-dialog";
import { NewClaimDialog } from "@/components/warranties/new-claim-dialog";
import { WarrantyDetailSheet } from "@/components/warranties/warranty-detail-sheet";

type Filter = "all" | WarrantyStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

export default function InHouseWarrantiesPage() {
  const { company } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as Filter | null) ?? "all";
  const initialQuery = searchParams.get("q") ?? "";

  const [warranties, setWarranties] = useState<Warranty[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState(initialQuery);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newWarrantyOpen, setNewWarrantyOpen] = useState(false);
  const [sheetWarranty, setSheetWarranty] = useState<Warranty | null>(null);
  const [fileClaimFor, setFileClaimFor] = useState<Warranty | null>(null);
  const refetch = () => setRefreshKey((k) => k + 1);

  // Initial + on-refresh data load.
  useEffect(() => {
    if (!company) return;
    let cancel = false;
    void Promise.all([
      warrantyService.getByType("in_house", company.id),
      vehicleService.getAll(company.id),
      claimService.getAll(company.id),
    ]).then(([w, v, c]) => {
      if (cancel) return;
      setWarranties(w);
      setVehicles(v);
      setClaims(c);
    });
    return () => {
      cancel = true;
    };
  }, [company, refreshKey]);

  // Realtime subscription — invalidate cache + bump refreshKey on any change.
  useRealtimeTable({
    table: "warranties",
    companyId: company?.id,
    invalidatePrefix: "warranties:",
    onChange: () => setRefreshKey((k) => k + 1),
  });

  // Sync filter + query to URL so views are shareable / bookmarkable.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filter === "all") next.delete("filter");
    else next.set("filter", filter);
    if (!query) next.delete("q");
    else next.set("q", query);
    router.replace(`?${next.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, query]);

  const filterOptions: FilterOption<Filter>[] = useMemo(() => {
    if (!warranties) return FILTERS;
    return FILTERS.map((f) => ({
      ...f,
      count:
        f.value === "all"
          ? warranties.length
          : warranties.filter((w) => w.status === f.value).length,
    }));
  }, [warranties]);

  const rows: WarrantyRow[] | null = useMemo(() => {
    if (!warranties) return null;
    const q = query.trim().toLowerCase();
    return warranties
      .filter((w) => filter === "all" || w.status === filter)
      .filter((w) => {
        if (!q) return true;
        const v = vehicles.find((x) => x.id === w.vehicleId);
        const hay = `${w.customerName} ${v?.registration ?? ""} ${v?.make ?? ""} ${v?.model ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .map((w) => ({
        ...w,
        vehicle: vehicles.find((x) => x.id === w.vehicleId) ?? null,
        claimCount: claims.filter((c) => c.warrantyId === w.id).length,
      }));
  }, [warranties, vehicles, claims, filter, query]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            In-House Warranties
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Warranties Car Capital provides directly to buyers. Track active
            coverage, expirations, and claims.
          </p>
        </div>
        <Button type="button" onClick={() => setNewWarrantyOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New warranty
        </Button>
      </header>

      <KpiStrip refreshKey={refreshKey} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChips
          options={filterOptions}
          activeValue={filter}
          onChange={setFilter}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, vehicle…"
            className="h-9 w-64 pl-8"
          />
        </div>
      </div>

      {!rows ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No in-house warranties"
          description={
            query
              ? "Try a different search term or clear the filter."
              : "Create a warranty when you sell a vehicle with Car Capital cover."
          }
        />
      ) : (
        <WarrantyTable
          rows={rows}
          variant="in-house"
          onRowClick={(w) => setSheetWarranty(w)}
          onFileClaim={(w) => setFileClaimFor(w)}
        />
      )}

      <NewWarrantyDialog
        open={newWarrantyOpen}
        onOpenChange={setNewWarrantyOpen}
        initialType="in_house"
        onCreated={refetch}
      />

      <WarrantyDetailSheet
        warranty={sheetWarranty}
        onOpenChange={(open) => !open && setSheetWarranty(null)}
        onChanged={refetch}
      />

      <NewClaimDialog
        open={fileClaimFor !== null}
        onOpenChange={(open) => !open && setFileClaimFor(null)}
        warrantyId={fileClaimFor?.id}
        onCreated={refetch}
      />
    </div>
  );
}
