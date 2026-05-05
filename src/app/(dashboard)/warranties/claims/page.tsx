"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { claimService } from "@/lib/services/claim-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle, WarrantyClaim } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";

export default function ClaimsPage() {
  const { company } = useAuth();
  const [claims, setClaims] = useState<WarrantyClaim[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      claimService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([c, v]) => {
      setClaims(c);
      setVehicles(v);
    });
  }, [company]);

  const open = useMemo(
    () => claims?.filter((c) => c.status === "open" || c.status === "under_review") ?? null,
    [claims],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Open Claims</h1>
        <p className="text-sm text-muted-foreground">
          Warranty claims awaiting review or resolution. Resolved claims sit on the{" "}
          <Link href="/warranties" className="text-primary hover:underline">
            Active Warranties
          </Link>{" "}
          page.
        </p>
      </div>

      {!open ? (
        <Skeleton className="h-72" />
      ) : open.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No open claims"
          description="All warranty claims are resolved or rejected."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {open.map((c) => {
            const v = vehicles.find((x) => x.id === c.vehicleId);
            return (
              <Link
                key={c.id}
                href={`/warranties/${c.warrantyId}`}
                className="block"
              >
                <Card className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-center justify-between">
                    {v && <RegPlate registration={v.registration} size="sm" />}
                    <Badge
                      variant={c.status === "open" ? "destructive" : "secondary"}
                      className="capitalize"
                    >
                      {c.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium">{c.customerName}</div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {c.issueDescription}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Est. {formatCurrency(c.estimatedCost ?? null)}
                    </span>
                    <span className="text-muted-foreground">
                      Opened {formatRelativeTime(c.createdAt)}
                    </span>
                  </div>
                  {c.isComplaint && (
                    <Badge variant="outline" className="self-start text-[10px]">
                      Complaint
                    </Badge>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
