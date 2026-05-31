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

  const closed = useMemo(
    () => deals?.filter((d) => d.stage === "completed_sale") ?? null,
    [deals],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Closed Deals</h1>
        <p className="text-sm text-muted-foreground">
          Completed sales — for active deals see{" "}
          <Link href="/sales/pipeline" className="text-primary hover:underline">
            Sales Pipeline
          </Link>
          .
        </p>
      </div>

      {!closed ? (
        <Skeleton className="h-72" />
      ) : closed.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No closed deals yet"
          description="Move a pipeline card to Completed Sale to see it here."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {closed.map((d) => {
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
