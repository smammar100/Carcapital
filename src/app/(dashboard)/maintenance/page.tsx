"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Wrench,
  Plus,
  CircleDashed,
  CircleDot,
  CheckCircle2,
  CircleAlert,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { vendorService } from "@/lib/services/vendor-service";
import { authService } from "@/lib/services/auth-service";
import type {
  MaintenanceJob,
  MaintenanceStatus,
  User,
  Vehicle,
  Vendor,
} from "@/lib/types";
import { MAINTENANCE_STATUSES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { AddVehicleButton } from "@/components/vehicles/add-vehicle-button";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_META: Record<
  MaintenanceStatus,
  { Icon: typeof CircleDashed; tone: string }
> = {
  pending: { Icon: CircleDashed, tone: "text-muted-foreground" },
  in_progress: { Icon: CircleDot, tone: "text-blue-500" },
  completed: { Icon: CheckCircle2, tone: "text-emerald-500" },
  stalled: { Icon: CircleAlert, tone: "text-amber-500" },
};

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(-6).toUpperCase();
}

export default function MaintenancePage() {
  const { user, company } = useAuth();
  const [jobs, setJobs] = useState<MaintenanceJob[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      maintenanceService.getAll(company.id),
      vehicleService.getAll(company.id),
      vendorService.getAll(company.id),
      authService.getUsersForCompany(company.id),
    ]).then(([j, v, ve, u]) => {
      setJobs(j);
      setVehicles(v);
      setVendors(ve);
      setUsers(u);
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
    if (!user || !company) return;
    await maintenanceService.updateStatus(id, status, user.id);
    setJobs(await maintenanceService.getAll(company.id));
    toast.success("Job moved");
  }

  const totalJobs = jobs?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Maintenance Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalJobs} {totalJobs === 1 ? "job" : "jobs"} across{" "}
            {MAINTENANCE_STATUSES.length} stages.
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
            <Skeleton key={s.value} className="h-72" />
          ))}
        </div>
      ) : jobs && jobs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance jobs yet"
          description="Add a vehicle to auto-create a pending job."
          action={
            <AddVehicleButton size="sm">Add a vehicle</AddVehicleButton>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-4">
          {MAINTENANCE_STATUSES.map((status) => {
            const list = grouped[status.value];
            const { Icon, tone } = STATUS_META[status.value];
            const laneTotal = list.reduce(
              (sum, j) => sum + (j.actualCost ?? j.estimatedCost ?? 0),
              0,
            );
            return (
              <div
                key={status.value}
                className="flex min-h-32 flex-col gap-3 rounded-xl bg-muted/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("h-3.5 w-3.5", tone)} />
                    <h3 className="text-sm font-semibold">{status.label}</h3>
                    <span className="text-xs text-muted-foreground">
                      {list.length}
                    </span>
                  </div>
                  <AddVehicleButton
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    aria-label="Add new job"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </AddVehicleButton>
                </div>
                <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs text-muted-foreground">
                  <span>Lane total</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(laneTotal)}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {list.length === 0 ? (
                    <AddVehicleButton
                      variant="ghost"
                      className="h-auto justify-start gap-1 px-2 py-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                      New
                    </AddVehicleButton>
                  ) : (
                    list.map((j) => {
                      const v = vehicles.find((x) => x.id === j.vehicleId);
                      const vendor = vendors.find((x) => x.id === j.vendorId);
                      const assignee = users.find((u) => u.id === j.assignedTo);
                      const cardTotal = j.actualCost ?? j.estimatedCost;
                      const cardDate =
                        j.completedDate ?? j.dueDate ?? j.startDate;
                      return (
                        <article
                          key={j.id}
                          className="flex flex-col gap-2.5 rounded-lg border bg-background p-3 shadow-xs transition-shadow hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">
                                Job:
                              </p>
                              <Link
                                href={v ? `/vehicles/${v.id}` : "/vehicles"}
                                className="font-mono text-base font-bold tracking-tight hover:underline"
                              >
                                #{shortId(j.id)}
                              </Link>
                            </div>
                            <div className="flex items-start gap-1">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  Total
                                </p>
                                <p className="text-base font-semibold leading-tight">
                                  {formatCurrency(cardTotal)}
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="-mt-0.5 h-6 w-6 shrink-0 text-muted-foreground"
                                    aria-label="Move job"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {MAINTENANCE_STATUSES.filter(
                                    (s) => s.value !== j.status,
                                  ).map((s) => (
                                    <DropdownMenuItem
                                      key={s.value}
                                      onClick={() =>
                                        void handleMove(j.id, s.value)
                                      }
                                    >
                                      {s.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground">
                              Work:
                            </p>
                            <p className="line-clamp-2 text-sm font-medium leading-snug">
                              {j.description}
                            </p>
                          </div>

                          {(vendor || v) && (
                            <div className="flex flex-wrap gap-1">
                              {vendor && (
                                <Badge
                                  variant="secondary"
                                  className="rounded-full px-2 py-0.5 text-xs font-normal"
                                >
                                  {vendor.name}
                                </Badge>
                              )}
                              {v && (
                                <Badge
                                  variant="secondary"
                                  className="rounded-full px-2 py-0.5 text-xs font-normal"
                                >
                                  {v.make} {v.model}
                                </Badge>
                              )}
                            </div>
                          )}

                          {v && (
                            <Link
                              href={`/vehicles/${v.id}`}
                              className="block w-fit"
                              aria-label={`Open ${v.registration}`}
                            >
                              <VehicleImage
                                vehicle={v}
                                variant="thumb"
                                className="w-20"
                              />
                            </Link>
                          )}

                          <div className="mt-1 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                            <span>{cardDate ? formatDate(cardDate) : "—"}</span>
                            {assignee ? (
                              <Avatar
                                size="sm"
                                title={assignee.name}
                              >
                                <AvatarFallback>
                                  {getInitials(assignee.name)}
                                </AvatarFallback>
                              </Avatar>
                            ) : vendor ? (
                              <Avatar size="sm" title={vendor.name}>
                                <AvatarFallback>
                                  {getInitials(vendor.name)}
                                </AvatarFallback>
                              </Avatar>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
