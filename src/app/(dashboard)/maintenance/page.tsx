"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { vendorService } from "@/lib/services/vendor-service";
import type {
  MaintenanceJob,
  MaintenanceStatus,
  Vehicle,
  Vendor,
} from "@/lib/types";
import { MAINTENANCE_STATUSES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function MaintenancePage() {
  const { user, company } = useAuth();
  const [jobs, setJobs] = useState<MaintenanceJob[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      maintenanceService.getAll(company.id),
      vehicleService.getAll(company.id),
      vendorService.getAll(company.id),
    ]).then(([j, v, ve]) => {
      setJobs(j);
      setVehicles(v);
      setVendors(ve);
    });
  }, [company]);

  const grouped = useMemo(() => {
    if (!jobs) return null;
    const map: Record<MaintenanceStatus, MaintenanceJob[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      stalled: [],
    };
    for (const j of jobs) map[j.status].push(j);
    return map;
  }, [jobs]);

  async function handleMove(id: string, status: MaintenanceStatus) {
    if (!user) return;
    await maintenanceService.updateStatus(id, status, user.id);
    if (!company) return;
    const fresh = await maintenanceService.getAll(company.id);
    setJobs(fresh);
    toast.success("Job moved");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Maintenance Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Internal stock prep jobs across all 4 statuses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/maintenance/calendar">Calendar</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/maintenance/inspection">Inspection</Link>
          </Button>
        </div>
      </div>

      {!grouped ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {MAINTENANCE_STATUSES.map((s) => (
            <Skeleton key={s.value} className="h-64" />
          ))}
        </div>
      ) : jobs && jobs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance jobs yet"
          description="Add a vehicle to auto-create a pending job."
          action={
            <Button asChild size="sm">
              <Link href="/vehicles/new">Add a vehicle</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-4">
          {MAINTENANCE_STATUSES.map((status) => {
            const list = grouped[status.value];
            return (
              <Card key={status.value} className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold capitalize">
                      {status.label}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {status.subtitle}
                    </p>
                  </div>
                  <Badge variant="secondary">{list.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {list.length === 0 ? (
                    <div className="rounded border border-dashed p-3 text-center text-[11px] text-muted-foreground">
                      Empty
                    </div>
                  ) : (
                    list.map((j) => {
                      const v = vehicles.find((x) => x.id === j.vehicleId);
                      const vendor = vendors.find((x) => x.id === j.vendorId);
                      return (
                        <Card
                          key={j.id}
                          className="border bg-background p-3 transition-shadow hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              {v && <RegPlate registration={v.registration} size="sm" />}
                              <Link
                                href={v ? `/vehicles/${v.id}` : "/vehicles"}
                                className="text-xs font-medium hover:underline"
                              >
                                {v ? `${v.make} ${v.model}` : "—"}
                              </Link>
                            </div>
                            <Select
                              value={j.status}
                              onValueChange={(s) =>
                                void handleMove(j.id, s as MaintenanceStatus)
                              }
                            >
                              <SelectTrigger className="h-7 w-32 text-[11px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MAINTENANCE_STATUSES.map((opt) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs">
                            {j.description}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            {vendor && (
                              <Badge variant="outline" className="text-[10px]">
                                {vendor.name}
                              </Badge>
                            )}
                            {j.dueDate && <span>Due {formatDate(j.dueDate)}</span>}
                            {j.estimatedCost !== null && (
                              <span>· {formatCurrency(j.estimatedCost)}</span>
                            )}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
