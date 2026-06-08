"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { SalesDeal, SalesStage, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { formatCurrency } from "@/lib/utils";

interface DealRow extends SalesDeal {
  vehicle: Vehicle | null;
  total: number | null;
  date: string;
}

const STAGE: Record<
  SalesStage,
  {
    label: string;
    variant: "info" | "warning" | "success" | "neutral" | "highlight";
  }
> = {
  new_lead: { label: "New lead", variant: "info" },
  contacted: { label: "Contacted", variant: "info" },
  test_drive: { label: "Test drive", variant: "warning" },
  offer_made: { label: "Offer made", variant: "warning" },
  deposit_taken: { label: "Deposit taken", variant: "highlight" },
  collection_delivery: { label: "Collection", variant: "highlight" },
  completed_sale: { label: "Completed", variant: "success" },
  lost: { label: "Lost", variant: "neutral" },
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function DashboardRecentDeals() {
  const { company } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

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
    return [...deals]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map((d) => {
        const dt =
          d.completionDate ?? d.depositDate ?? d.collectionDate ?? d.updatedAt;
        return {
          ...d,
          vehicle: vehicles.find((v) => v.id === d.vehicleId) ?? null,
          total: d.agreedPrice ?? d.offerPrice,
          date: dt.slice(0, 10),
        };
      });
  }, [deals, vehicles]);

  return (
    <Card className="h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Recent deals</h2>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {rows?.length ?? "—"}
          </span>
        </div>
        <Link
          href="/sales/deals"
          className="text-xs text-link underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>

      {rows === null ? (
        <div className="p-4">
          <Skeleton className="h-64" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No deals yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const stage = STAGE[r.stage];
                return (
                  <tr
                    key={r.id}
                    onClick={() =>
                      r.vehicle && router.push(`/vehicles/${r.vehicle.id}`)
                    }
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {r.vehicle ? (
                          <VehicleImage
                            vehicle={r.vehicle}
                            variant="thumb"
                            className="h-9 w-12 shrink-0 rounded"
                          />
                        ) : (
                          <span className="h-9 w-12 shrink-0 rounded bg-muted" />
                        )}
                        <div className="leading-tight">
                          <div className="font-mono text-xs font-semibold">
                            {r.vehicle?.registration ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.vehicle
                              ? `${r.vehicle.stockId} · ${r.vehicle.make} ${r.vehicle.model}`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{r.customerName}</td>
                    <td className="px-3 py-2.5">
                      <nord-badge variant={stage.variant}>
                        {stage.label}
                      </nord-badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(r.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {fmtDate(r.date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
