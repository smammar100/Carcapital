"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { SalesDeal, SalesStage, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

const ACTIVE_STAGES: SalesStage[] = [
  "contacted",
  "test_drive",
  "offer_made",
  "deposit_taken",
];

/**
 * v4.1 §11.2 / Gap 9 — replaces the legacy "Recently Listed" widget.
 * Shows pipeline cards in any of the active stages with a quick-jump link.
 */
export function DealsInProgress() {
  const { company } = useAuth();
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

  const active = useMemo(
    () => deals?.filter((d) => ACTIVE_STAGES.includes(d.stage)) ?? null,
    [deals],
  );

  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Deals in Progress</h2>
        </div>
        <Badge variant="secondary" className="text-2xs">
          {active?.length ?? 0}
        </Badge>
      </div>
      {!active ? (
        <Skeleton className="h-24" />
      ) : active.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active deals.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {active.slice(0, 6).map((d) => {
            const v = vehicles.find((x) => x.id === d.vehicleId);
            return (
              <li key={d.id}>
                <Link
                  href="/sales/pipeline"
                  className="flex items-center justify-between rounded border bg-background px-3 py-2 text-xs transition-colors hover:bg-muted/40"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{d.customerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {v ? `${v.make} ${v.model} · ${v.stockId}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase text-muted-foreground">
                      {d.stage.replace("_", " ")}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(d.agreedPrice ?? d.offerPrice ?? null)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
