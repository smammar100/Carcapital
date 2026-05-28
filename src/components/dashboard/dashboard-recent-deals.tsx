"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Filter, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { SalesDeal, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type ColumnDef,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridTable,
  VehicleCell,
} from "@/components/data-grid";

interface DealRow extends SalesDeal {
  vehicle: Vehicle | null;
  total: number | null;
  date: string;
}

export function DashboardRecentDeals() {
  const { company } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      salesService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([d, v]) => {
      setDeals(d);
      setVehicles(v);
    });
  }, [company]);

  const rows = useMemo<DealRow[] | null>(() => {
    if (!deals) return null;
    const byMostRecent = [...deals].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const filtered = query.trim()
      ? byMostRecent.filter((d) => {
          const v = vehicles.find((x) => x.id === d.vehicleId);
          const hay =
            `${d.customerName} ${v?.registration ?? ""} ${v?.make ?? ""} ${v?.model ?? ""}`.toLowerCase();
          return hay.includes(query.trim().toLowerCase());
        })
      : byMostRecent;
    return filtered.slice(0, 20).map((d) => {
      const dt =
        d.completionDate ?? d.depositDate ?? d.collectionDate ?? d.updatedAt;
      return {
        ...d,
        vehicle: vehicles.find((v) => v.id === d.vehicleId) ?? null,
        total: d.agreedPrice ?? d.offerPrice,
        date: dt.slice(0, 10),
      };
    });
  }, [deals, vehicles, query]);

  const cols = useMemo<ColumnDef<DealRow>[]>(
    () => [
      {
        key: "vehicle",
        label: "Vehicle",
        type: "vehicle",
        sticky: true,
        width: 200,
        render: (r) => <VehicleCell vehicle={r.vehicle} />,
      },
      { key: "customerName", label: "Customer", type: "text", width: 160 },
      { key: "stage", label: "Stage", type: "salesStage", width: 130 },
      { key: "total", label: "Total", type: "currency", width: 110 },
      { key: "date", label: "Date", type: "date", width: 120 },
    ],
    [],
  );

  return (
    <Card className="flex flex-col gap-4 pt-5 pb-4" size="sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Recent Deals</h2>
          <Badge variant="secondary" className="text-[10px]">
            {rows?.length ?? "—"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reg or customer…"
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
        </div>
      </div>

      {rows === null ? (
        <Skeleton className="mx-5 h-72" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No deals match.
        </p>
      ) : (
        <DataGridShell bare className="px-5">
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              {rows.map((r, i) => (
                <DataGridRow
                  key={r.id}
                  row={r}
                  cols={cols}
                  index={i}
                  onClick={(row) =>
                    row.vehicle && router.push(`/vehicles/${row.vehicle.id}`)
                  }
                />
              ))}
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}
    </Card>
  );
}
