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
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  Trash2,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { AddEventSheet } from "@/components/shared/add-event-sheet";
import { EditJobDialog } from "@/components/maintenance/edit-job-dialog";
import {
  cn,
  formatCurrency,
  formatDate,
  formatRegPlate,
  getInitials,
} from "@/lib/utils";
import { toast } from "@/lib/toast";

const STATUS_META: Record<
  MaintenanceStatus,
  { Icon: typeof CircleDashed; tone: string }
> = {
  pending: { Icon: CircleDashed, tone: "text-muted-foreground" },
  in_progress: { Icon: CircleDot, tone: "text-blue-500" },
  completed: { Icon: CheckCircle2, tone: "text-emerald-500" },
  stalled: { Icon: CircleAlert, tone: "text-amber-500" },
};

type Urgency = "overdue" | "today" | "week" | "later" | "done";
const URGENCY_TONE: Record<Exclude<Urgency, "later" | "done">, string> = {
  overdue: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  today: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  week: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
};
const URGENCY_LABEL: Record<Exclude<Urgency, "later" | "done">, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "This week",
};

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(-6).toUpperCase();
}

/** Derive an at-a-glance urgency from the job's due date (open jobs only). */
function urgencyOf(job: MaintenanceJob): Urgency {
  if (job.status === "completed") return "done";
  if (!job.dueDate) return "later";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${job.dueDate.slice(0, 10)}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  if (urgency === "later" || urgency === "done") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        URGENCY_TONE[urgency],
      )}
    >
      {urgency === "overdue" && <AlertTriangle className="h-3 w-3" />}
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

export default function MaintenancePage() {
  const { user, company } = useAuth();
  const [jobs, setJobs] = useState<MaintenanceJob[] | null>(null);
  const [editJob, setEditJob] = useState<MaintenanceJob | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overLane, setOverLane] = useState<MaintenanceStatus | null>(null);

  function refetch() {
    if (!company) return;
    void maintenanceService.getAll(company.id).then(setJobs);
  }

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
    // Auto-archive: jobs completed more than 6 months ago drop off the live
    // pipeline (they remain in history / the master sheet).
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    const map: Record<MaintenanceStatus, MaintenanceJob[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      stalled: [],
    };
    for (const j of jobs) {
      if (
        j.status === "completed" &&
        j.completedDate &&
        j.completedDate < cutoffDate
      ) {
        continue;
      }
      map[j.status].push(j);
    }
    return map;
  }, [jobs]);

  async function handleMove(id: string, status: MaintenanceStatus) {
    if (!user || !company) return;
    await maintenanceService.updateStatus(id, status, user.id);
    setJobs(await maintenanceService.getAll(company.id));
    toast.success("Job moved");
  }

  async function handleDelete(id: string, label: string) {
    if (!company) return;
    if (!window.confirm(`Delete the maintenance job for ${label}? This cannot be undone.`)) {
      return;
    }
    try {
      await maintenanceService.remove(id);
      setJobs(await maintenanceService.getAll(company.id));
      toast.success("Job deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete job");
    }
  }

  const totalJobs = grouped
    ? Object.values(grouped).reduce((n, l) => n + l.length, 0)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Maintenance Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Track every repair and prep job through its stages, from booked to
            completed, across all your stock.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add job
        </Button>
      </div>

      {!grouped ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {MAINTENANCE_STATUSES.map((s) => (
            <Skeleton key={s.value} className="h-72" />
          ))}
        </div>
      ) : totalJobs === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance jobs yet"
          description="Add a job, or add a vehicle to auto-create a pending one."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add job
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-4">
          {MAINTENANCE_STATUSES.map((status) => {
            const list = grouped[status.value];
            const { Icon, tone } = STATUS_META[status.value];
            return (
              <div
                key={status.value}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setOverLane(status.value);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const job = dragId
                    ? jobs?.find((x) => x.id === dragId)
                    : undefined;
                  if (dragId && job && job.status !== status.value) {
                    void handleMove(dragId, status.value);
                  }
                  setDragId(null);
                  setOverLane(null);
                }}
                className={cn(
                  "flex min-h-32 flex-col gap-2 rounded-xl bg-muted/40 p-2.5 transition-colors",
                  dragId &&
                    overLane === status.value &&
                    "bg-primary/5 ring-2 ring-primary/40",
                )}
              >
                <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
                  <Icon className={cn("h-3.5 w-3.5", tone)} />
                  <h3 className="text-sm font-semibold">{status.label}</h3>
                  <span className="rounded-full bg-background px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {list.length}
                  </span>
                </div>
                <div className="flex max-h-[calc(100dvh-22rem)] min-h-12 flex-col gap-2 overflow-y-auto pr-0.5">
                  {list.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setAddOpen(true)}
                      className="flex shrink-0 items-center justify-center gap-1 rounded-lg border border-dashed border-border py-3 text-xs text-muted-foreground transition hover:bg-background hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> Add job
                    </button>
                  ) : (
                    list.map((j) => {
                      const v = vehicles.find((x) => x.id === j.vehicleId);
                      const vendor = vendors.find((x) => x.id === j.vendorId);
                      const assignee = users.find((u) => u.id === j.assignedTo);
                      const cardTotal = j.actualCost ?? j.estimatedCost;
                      const cardDate =
                        j.completedDate ?? j.dueDate ?? j.startDate;
                      const urgency = urgencyOf(j);
                      return (
                        <article
                          key={j.id}
                          draggable
                          onDragStart={(e) => {
                            setDragId(j.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", j.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverLane(null);
                          }}
                          className={cn(
                            "flex shrink-0 cursor-grab flex-col overflow-hidden rounded-lg border bg-background shadow-xs transition-shadow hover:shadow-md active:cursor-grabbing",
                            urgency === "overdue" &&
                              "border-rose-200 dark:border-rose-500/30",
                            dragId === j.id && "opacity-50",
                          )}
                        >
                          {/* Accent header — reg + job # */}
                          <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
                            <div className="flex min-w-0 items-baseline gap-2">
                              {v ? (
                                <>
                                  <Link
                                    href={`/vehicles/${v.id}`}
                                    className="truncate font-mono text-base font-bold tracking-tight hover:underline"
                                  >
                                    {formatRegPlate(v.registration)}
                                  </Link>
                                  <Link
                                    href={`/maintenance/jobs/${j.id}`}
                                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline"
                                  >
                                    #{shortId(j.id)}
                                  </Link>
                                </>
                              ) : (
                                <Link
                                  href={`/maintenance/jobs/${j.id}`}
                                  className="font-mono text-base font-bold tracking-tight hover:underline"
                                >
                                  #{shortId(j.id)}
                                </Link>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                                    aria-label="Job actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setEditJob(j)}
                                  >
                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                    Edit job
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() =>
                                      void handleDelete(
                                        j.id,
                                        v ? formatRegPlate(v.registration) : `#${shortId(j.id)}`,
                                      )
                                    }
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    Delete job
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Body */}
                          <div className="flex flex-col gap-2 p-3">
                            {cardTotal ? (
                              <span className="text-base font-semibold tabular-nums">
                                {formatCurrency(cardTotal)}
                              </span>
                            ) : null}

                            <p className="line-clamp-2 text-sm font-medium leading-snug">
                              {j.description}
                            </p>

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

                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">
                                  {cardDate ? formatDate(cardDate) : "—"}
                                </span>
                                <UrgencyBadge urgency={urgency} />
                              </div>
                              {assignee ? (
                                <Avatar size="sm" title={assignee.name}>
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
                              ) : (
                                <span
                                  className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-border text-xs text-muted-foreground"
                                  title="Unassigned"
                                >
                                  ?
                                </span>
                              )}
                            </div>
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

      <AddEventSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        lockKind="maintenance"
        onCreated={refetch}
      />

      <EditJobDialog
        open={editJob !== null}
        onOpenChange={(o) => {
          if (!o) setEditJob(null);
        }}
        job={editJob}
        vehicle={
          editJob
            ? (vehicles.find((v) => v.id === editJob.vehicleId) ?? null)
            : null
        }
        vendors={vendors}
        users={users}
        onSaved={refetch}
      />
    </div>
  );
}
