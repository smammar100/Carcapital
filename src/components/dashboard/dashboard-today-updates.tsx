"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { returnService } from "@/lib/services/return-service";
import type { MaintenanceJob, Vehicle, VehicleReturn } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardTodayUpdates() {
  const { company } = useAuth();
  const [data, setData] = useState<{
    jobs: MaintenanceJob[];
    vehicles: Vehicle[];
    returns: VehicleReturn[];
  } | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      maintenanceService.getAll(company.id),
      vehicleService.getAll(company.id),
      returnService.getAll(company.id),
    ]).then(([jobs, vehicles, returns]) =>
      setData({ jobs, vehicles, returns }),
    );
  }, [company]);

  const items = useMemo(() => {
    if (!data) return null;
    const prep = data.jobs.filter(
      (j) => j.status === "pending" || j.status === "in_progress",
    ).length;
    const inspections = data.vehicles.filter(
      (v) => v.status === "inspection_pending",
    ).length;
    const returns = data.returns.filter(
      (r) => r.status === "pending" || r.status === "in_review",
    ).length;
    const photos = data.vehicles.filter(
      (v) => v.status === "photos_pending",
    ).length;
    return [
      {
        label: "Cars to prep for forecourt",
        count: prep,
        href: "/maintenance/workshop",
      },
      {
        label: "Inspections pending",
        count: inspections,
        href: "/maintenance/inspection",
      },
      {
        label: "Returns & cancellations to review",
        count: returns,
        href: "/admin/vehicle-returns",
      },
      {
        label: "Adverts awaiting photos",
        count: photos,
        href: "/advert/photo-processing",
      },
    ];
  }, [data]);

  return (
    <Card className="h-full overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Today&apos;s updates</h2>
      </div>
      {items === null ? (
        <div className="p-4">
          <Skeleton className="h-40" />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((t) => (
            <li key={t.label}>
              <Link
                href={t.href}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-accent/40"
              >
                <span className="text-muted-foreground">{t.label}</span>
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
                  {t.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
