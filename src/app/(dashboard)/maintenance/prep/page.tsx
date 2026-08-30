"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Car,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  Download,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  prepService,
  PREP_STATUSES,
  type PrepCar,
  type PrepStatus,
} from "@/lib/services/prep-service";
import { authService } from "@/lib/services/auth-service";
import { vendorService } from "@/lib/services/vendor-service";
import { downloadBlob, pdfService } from "@/lib/services/pdf-service";
import { vehicleDetailHref } from "@/lib/vehicle-nav";
import type { User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { TodoTab } from "@/components/vehicle-detail/todo-tab";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { toast } from "@/lib/toast";

const STATUS_META: Record<
  PrepStatus,
  { Icon: typeof CircleDashed; tone: string }
> = {
  unassigned: { Icon: CircleDashed, tone: "text-muted-foreground" },
  in_progress: { Icon: CircleDot, tone: "text-amber-500" },
  ready: { Icon: CheckCircle2, tone: "text-emerald-500" },
};

/** Amber past a fortnight, red past a month — the same nudge the pipeline uses. */
function waitTone(days: number): string {
  if (days > 30) return "text-rose-600 dark:text-rose-400";
  if (days > 14) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/**
 * Prep & Repair — the stage between "inspection complete" and the sales
 * pipeline (GEN-63). A car lands here automatically the moment its inspection
 * is submitted with outstanding items, starting Unassigned; clearing its last
 * Things to Do item moves it to Ready and releases it to Sales.
 */
export default function PrepAndRepairPage() {
  const pathname = usePathname();
  const { company, user } = useAuth();
  const [cars, setCars] = useState<PrepCar[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [openCarId, setOpenCarId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!company) return;
    prepService.invalidate();
    setCars(await prepService.getQueue(company.id));
  }, [company]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      prepService.getQueue(company.id),
      authService.getUsersForCompany(company.id),
    ]).then(([q, u]) => {
      setCars(q);
      setUsers(u);
    });
  }, [company]);

  const grouped = useMemo(() => {
    if (!cars) return null;
    const map: Record<PrepStatus, PrepCar[]> = {
      unassigned: [],
      in_progress: [],
      ready: [],
    };
    for (const c of cars) map[c.status].push(c);
    return map;
  }, [cars]);

  const openCar = cars?.find((c) => c.vehicle.id === openCarId) ?? null;

  async function handleAssign(vehicleId: string, userId: string | null) {
    if (!user) return;
    try {
      await prepService.assign(vehicleId, userId, user.id);
      await refresh();
      toast.success(userId ? "Assigned" : "Returned to Unassigned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't assign this car");
    }
  }

  async function handleExport(car: PrepCar) {
    if (!company) return;
    setExportingId(car.vehicle.id);
    try {
      const vendors = await vendorService.getAll(company.id);
      const blob = await pdfService.generateJobCard({
        vehicle: car.vehicle,
        todos: car.todos,
        preparedBy: user?.name ?? "—",
        companyName: company.name,
        vendorNames: Object.fromEntries(vendors.map((v) => [v.id, v.name])),
      });
      downloadBlob(blob, `job-card-${car.vehicle.stockId}.pdf`);
      toast.success("Job card downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setExportingId(null);
    }
  }

  const totalCars = grouped
    ? Object.values(grouped).reduce((n, l) => n + l.length, 0)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Prep &amp; Repair
          </h1>
          <p className="text-sm text-muted-foreground">
            Every car between inspection and sale. Cars arrive here
            automatically when their inspection completes, and leave once
            their Things to Do list is clear.
          </p>
        </div>
      </div>

      {!grouped ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {PREP_STATUSES.map((s) => (
            <Skeleton key={s.value} className="h-72" />
          ))}
        </div>
      ) : totalCars === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nothing in prep"
          description="Cars appear here the moment an inspection is completed with outstanding items."
        />
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-3">
          {PREP_STATUSES.map((status) => {
            const list = grouped[status.value];
            const { Icon, tone } = STATUS_META[status.value];
            return (
              <div
                key={status.value}
                className="flex min-h-32 flex-col gap-2 rounded-xl border border-border bg-card p-2.5"
              >
                <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
                  <Icon className={cn("h-3.5 w-3.5", tone)} />
                  <h2 className="text-sm font-semibold">{status.label}</h2>
                  <span className="rounded-full bg-background px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {list.length}
                  </span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {status.subtitle}
                  </span>
                </div>

                <div className="flex min-h-12 flex-col gap-2">
                  {list.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                      Nothing here.
                    </p>
                  ) : (
                    list.map((car) => (
                      <PrepCard
                        key={car.vehicle.id}
                        car={car}
                        users={users}
                        exporting={exportingId === car.vehicle.id}
                        onOpen={() => setOpenCarId(car.vehicle.id)}
                        onAssign={(uid) =>
                          void handleAssign(car.vehicle.id, uid)
                        }
                        onExport={() => void handleExport(car)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Things to Do for one car — the same tab the vehicle page shows, so
          there is exactly one implementation of the list (GEN-64). */}
      <Sheet
        open={openCar !== null}
        onOpenChange={(o) => {
          if (!o) setOpenCarId(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {openCar ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  <RegPlate
                    registration={openCar.vehicle.registration}
                    size="sm"
                  />
                  <span>
                    {openCar.vehicle.make} {openCar.vehicle.model}
                  </span>
                </SheetTitle>
                <SheetDescription>
                  <Link
                    href={vehicleDetailHref(openCar.vehicle.id, pathname)}
                    className="underline underline-offset-2"
                  >
                    Open the full vehicle record
                  </Link>
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <TodoTab
                  vehicleId={openCar.vehicle.id}
                  onExportPdf={() => void handleExport(openCar)}
                  exporting={exportingId === openCar.vehicle.id}
                  onChanged={() => void refresh()}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PrepCard({
  car,
  users,
  exporting,
  onOpen,
  onAssign,
  onExport,
}: {
  car: PrepCar;
  users: User[];
  exporting: boolean;
  onOpen: () => void;
  onAssign: (userId: string | null) => void;
  onExport: () => void;
}) {
  const pathname = usePathname();
  const {
    vehicle,
    done,
    total,
    pending,
    inProgress,
    cancelled,
    cost,
    daysWaiting,
    status,
  } = car;
  // The roll-up has to add up, so it counts live work only -- `total` includes
  // cancelled items, which aren't jobs anyone still has to do (GEN-112).
  const liveTotal = total - cancelled;
  const assignee = users.find((u) => u.id === vehicle.prepAssignedTo) ?? null;
  const percent = total === 0 ? 100 : Math.round((done / total) * 100);

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
        <Link
          href={vehicleDetailHref(vehicle.id, pathname)}
          className="min-w-0 truncate"
          title="Open vehicle details"
        >
          <RegPlate registration={vehicle.registration} size="sm" />
        </Link>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-xs",
            waitTone(daysWaiting),
          )}
          title="Days in stock"
        >
          <Clock className="size-3" />
          {daysWaiting}d
        </span>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col gap-2 p-3 text-left transition-colors hover:bg-muted/30"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Car className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {vehicle.make} {vehicle.model}
          </span>
        </span>

        {/* Progress — the roll-up the card exists to show. */}
        <span className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {liveTotal === 0
                ? total === 0
                  ? "No items raised"
                  : "All items cancelled"
                : `${liveTotal} ${liveTotal === 1 ? "job" : "jobs"}: ${pending} pending, ${inProgress} in progress, ${done} completed`}
            </span>
            {cost > 0 ? (
              <span className="tabular-nums">{formatCurrency(cost)}</span>
            ) : null}
          </span>
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <span
              className={cn(
                "block h-full rounded-full transition-[width]",
                status === "ready" ? "bg-emerald-500" : "bg-amber-500",
              )}
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>

        {status === "ready" ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Sparkles className="size-3" />
            Ready to move to Sales
          </span>
        ) : null}
      </button>

      <div className="flex items-center gap-1.5 border-t px-2.5 py-2">
        {/* Type-ahead, not a 20-name scroll — the team asked for this shape
            explicitly (GEN-81). Clearing the field unassigns the car. */}
        <Combobox
          items={users}
          value={assignee}
          onValueChange={(u: User | null) => onAssign(u?.id ?? null)}
          itemToStringLabel={(u: User) => u.name}
          // Type "sara", press Enter, done. Without this the top match isn't
          // highlighted and Enter does nothing, which reads as a broken field.
          autoHighlight
        >
          <ComboboxInput
            size="sm"
            showClear={assignee !== null}
            placeholder="Unassigned"
            aria-label={`Assign ${vehicle.registration}`}
            className="w-full flex-1"
          />
          <ComboboxPopup>
            <ComboboxEmpty>No one by that name.</ComboboxEmpty>
            <ComboboxList>
              {(u: User) => (
                <ComboboxItem key={u.id} value={u}>
                  {u.name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>

        {assignee ? (
          <Avatar size="sm" title={assignee.name}>
            <AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
          </Avatar>
        ) : null}

        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 px-2"
          disabled={exporting}
          onClick={onExport}
          title="Download Job Card PDF"
          aria-label={`Download job card for ${vehicle.registration}`}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </article>
  );
}
