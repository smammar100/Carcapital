"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { authService } from "@/lib/services/auth-service";
import type { SalesDeal, User, Vehicle } from "@/lib/types";
import { SALES_STAGES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  FilterBar,
  matchesFilterState,
  useFilterState,
  type SelectFilter,
} from "@/components/filters/filter-bar";

/**
 * A vehicle's purchase source as a single filterable label — the auction house
 * for auction buys (so "BCA" is a first-class option, per the client's
 * BCA-vs-non-BCA use case), otherwise the purchase-source type.
 */
const SOURCE_TYPE_LABEL: Record<string, string> = {
  private: "Private",
  trade_in: "Trade-in",
  dealer: "Dealer",
  other: "Other",
};
function sourceLabel(v: Vehicle | undefined): string {
  if (!v) return "—";
  if (v.purchaseSource === "auction") {
    return v.auctionHouse?.trim() || "Auction";
  }
  return SOURCE_TYPE_LABEL[v.purchaseSource] ?? "Other";
}

export default function DealsPage() {
  const { company } = useAuth();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      salesService.getAll(company.id),
      vehicleService.getAll(company.id),
      authService.getUsersForCompany(company.id),
    ]).then(([d, v, u]) => {
      setDeals(d);
      setVehicles(v);
      setUsers(u);
    });
  }, [company]);

  const { state: filters, setState: setFilters } = useFilterState();

  const vehicleById = useMemo(() => {
    const m = new Map<string, Vehicle>();
    vehicles.forEach((v) => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const closed = useMemo(
    () => deals?.filter((d) => d.stage === "completed_sale") ?? null,
    [deals],
  );

  // Source options are derived from the actual closed deals (schema-driven) so
  // BCA / specific auction houses appear only when present in the data (GEN-22).
  const sourceFilters: SelectFilter[] = useMemo(() => {
    if (!closed) return [];
    const labels = new Set<string>();
    closed.forEach((d) => {
      const label = sourceLabel(vehicleById.get(d.vehicleId));
      if (label !== "—") labels.add(label);
    });
    if (labels.size === 0) return [];
    return [
      {
        key: "source",
        label: "Source",
        allLabel: "All sources",
        options: [...labels]
          .sort()
          .map((l) => ({ value: l, label: l })),
      },
    ];
  }, [closed, vehicleById]);

  const filtered = useMemo(() => {
    if (!closed) return null;
    return closed.filter((d) => {
      const v = vehicleById.get(d.vehicleId);
      return matchesFilterState(d, filters, {
        searchText: () =>
          [
            v?.registration,
            v?.make,
            v?.model,
            v?.stockId,
            d.customerName,
          ]
            .filter(Boolean)
            .join(" "),
        date: () => d.completionDate ?? d.updatedAt,
        selectValue: (_row, key) =>
          key === "source" ? sourceLabel(v) : null,
      });
    });
  }, [closed, filters, vehicleById]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Closed Deals</h1>
        <p className="text-sm text-muted-foreground">
          Your completed sales history. For deals still in progress, see the{" "}
          <Link href="/sales/pipeline" className="text-primary hover:underline">
            Sales Pipeline
          </Link>
          .
        </p>
      </div>

      {closed && closed.length > 0 && (
        <FilterBar
          state={filters}
          onChange={setFilters}
          searchPlaceholder="Search reg, make/model, customer…"
          dateLabel="Completed"
          selects={sourceFilters}
        />
      )}

      {!closed || !filtered ? (
        <Skeleton className="h-72" />
      ) : closed.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No closed deals yet"
          description="Move a pipeline card to Completed Sale to see it here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No deals match your filters"
          description="Try widening the date range or clearing a filter."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const v = vehicles.find((x) => x.id === d.vehicleId);
            const agent = users.find((u) => u.id === d.sellingAgent);
            const stageLabel =
              SALES_STAGES.find((s) => s.value === d.stage)?.label ?? d.stage;
            return (
              <Card key={d.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  {v && <RegPlate registration={v.registration} size="sm" />}
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stageLabel}
                  </span>
                </div>
                <div className="text-sm font-medium">{d.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  {v ? `${v.make} ${v.model} · ${v.stockId}` : "—"}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {formatCurrency(d.agreedPrice ?? d.offerPrice ?? null)}
                  </span>
                  <span className="text-muted-foreground">
                    {agent?.name ?? "—"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Updated {formatRelativeTime(d.updatedAt)}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
