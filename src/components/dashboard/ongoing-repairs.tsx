"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { MaintenanceJob, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

/**
 * v4.1 §11.2 / Gap 9 — replaces the legacy "Total Revenue" widget.
 * Shows maintenance jobs in pending or in_progress status.
 */
export function OngoingRepairs() {
  const { company } = useAuth();
  const [jobs, setJobs] = useState<MaintenanceJob[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      maintenanceService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([j, v]) => {
      setJobs(j);
      setVehicles(v);
    });
  }, [company]);

  const active = useMemo(
    () =>
      jobs?.filter(
        (j) => j.status === "pending" || j.status === "in_progress",
      ) ?? null,
    [jobs],
  );

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Ongoing Repairs</h2>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {active?.length ?? 0}
        </Badge>
      </div>
      {!active ? (
        <Skeleton className="h-24" />
      ) : active.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No ongoing maintenance work.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {active.slice(0, 6).map((j) => {
            const v = vehicles.find((x) => x.id === j.vehicleId);
            return (
              <li key={j.id}>
                <Link
                  href={`/maintenance/jobs/${j.id}`}
                  className="flex items-center justify-between rounded border bg-background px-3 py-2 text-xs transition-colors hover:bg-muted/40"
                >
                  <div className="flex flex-col">
                    <span className="line-clamp-1 font-medium">
                      {j.description}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {v ? `${v.make} ${v.model} · ${v.stockId}` : "—"}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {j.status.replace("_", " ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
