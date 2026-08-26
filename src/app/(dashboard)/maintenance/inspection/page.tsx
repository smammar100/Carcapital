"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { inspectionService } from "@/lib/services/inspection-service";
import { inspectionChecklistService } from "@/lib/services/inspection-checklist-service";
import { authService } from "@/lib/services/auth-service";
import { motFlagFor } from "@/lib/services/mot-derivation";
import { NEGATIVE_INSPECTION_STATUSES } from "@/lib/constants";
import type { InspectionCheck, InspectionChecklistItem, User, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RegPlate } from "@/components/shared/reg-plate";
import { EmptyState } from "@/components/shared/empty-state";
import { InspectionSidePanel } from "@/components/inspection/inspection-side-panel";
import { cn, formatDate, getInitials } from "@/lib/utils";

interface Row {
  vehicle: Vehicle;
  checks: InspectionCheck[];
  progress: number;
  total: number;
}

type SquareKind = "pass" | "flag" | "empty";

/** Per-point square state across all checklist items: passed / flagged / not done. */
function buildSquares(
  checks: InspectionCheck[],
  items: InspectionChecklistItem[],
): SquareKind[] {
  return items.map((item) => {
    const c = checks.find((x) => x.checkNumber === item.number);
    if (!c || !c.status) return "empty";
    return NEGATIVE_INSPECTION_STATUSES.has(c.status) ? "flag" : "pass";
  });
}

const flaggedCount = (checks: InspectionCheck[]): number =>
  checks.filter((c) => c.status && NEGATIVE_INSPECTION_STATUSES.has(c.status))
    .length;

// Lifecycle states relevant to inspection: awaiting/in-progress + the two
// post-inspection states (being_prepared = done with faults, ready = done clean).
const SCOPE = new Set([
  "received",
  "inspection_pending",
  "being_prepared",
  "ready",
]);

export default function MaintenanceInspectionListPage() {
  const { company } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [items, setItems] = useState<InspectionChecklistItem[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);

  async function load() {
    if (!company) return;
    const [vs, u, checklist] = await Promise.all([
      vehicleService.getAll(company.id),
      authService.getUsersForCompany(company.id),
      inspectionChecklistService.getAll(company.id),
    ]);
    const scope = vs.filter((v) => SCOPE.has(v.status));
    // GEN-70: was one awaited round trip per vehicle in series — on a queue
    // of any real size that's a visible stall before the page shows
    // anything. Fire them together instead.
    const checksByVehicle = await Promise.all(
      scope.map((v) => inspectionService.getForVehicle(v.id)),
    );
    const out: Row[] = scope.map((v, i) => {
      const checks = checksByVehicle[i];
      const progress = checks.filter((c) => c.status).length;
      return { vehicle: v, checks, progress, total: checklist.length };
    });
    setRows(out);
    setUsers(u);
    setItems(checklist);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  // Pending = still needs inspection. Completed = all 20 points recorded, so
  // it auto-moves to the Completed tab the moment the inspection is finished.
  const { pending, completed } = useMemo(() => {
    const p: Row[] = [];
    const c: Row[] = [];
    for (const r of rows ?? []) {
      if (r.progress >= r.total) c.push(r);
      else p.push(r);
    }
    return { pending: p, completed: c };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inspection Queue</h1>
        <p className="text-sm text-muted-foreground">
          Vehicles waiting on their 20-point inspection. Run a check and cars
          move through automatically once it is done.
        </p>
      </div>

      {!rows ? (
        <Skeleton className="h-72" />
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              <Badge variant="secondary" className="ml-1.5 tabular-nums">
                {pending.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed
              <Badge variant="secondary" className="ml-1.5 tabular-nums">
                {completed.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pending.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No vehicles awaiting inspection"
                description="All current stock has cleared the inspection step."
              />
            ) : (
              <QueueTable
                rows={pending}
                users={users}
                items={items}
                mode="pending"
                onOpen={setSelected}
              />
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {completed.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No completed inspections yet"
                description="Inspected vehicles will appear here."
              />
            ) : (
              <QueueTable
                rows={completed}
                users={users}
                items={items}
                mode="completed"
                onOpen={setSelected}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      <InspectionSidePanel
        vehicle={selected}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        onComplete={() => void load()}
      />
    </div>
  );
}

/** Days a vehicle has been waiting, with an urgency tone past 14 / 30 days. */
function waitInfo(receivedDate: string): {
  days: number;
  cls: string;
  urgent: boolean;
} {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(receivedDate).getTime()) / 86_400_000),
  );
  if (days > 30)
    return {
      days,
      cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
      urgent: true,
    };
  if (days > 14)
    return {
      days,
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      urgent: true,
    };
  return { days, cls: "bg-muted text-muted-foreground", urgent: false };
}

const SQUARE_TONE: Record<SquareKind, string> = {
  pass: "bg-emerald-500",
  flag: "bg-rose-500",
  empty: "bg-muted",
};

/** 20-point progress as squares: green = passed, red = flagged, grey = not done. */
function ProgressSquares({
  squares,
  progress,
  total,
}: {
  squares: SquareKind[];
  progress: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex flex-wrap gap-[3px]"
        title={`${progress} of ${total} points recorded`}
      >
        {squares.map((kind, i) => (
          <span
            key={i}
            className={cn("h-2.5 w-2.5 rounded-[2px]", SQUARE_TONE[kind])}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {progress}/{total}
      </span>
    </div>
  );
}

const MOT_TONE: Record<string, string> = {
  expired: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  expiring: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  unknown: "bg-muted text-muted-foreground",
};

/** MOT expiry flag (GEN-75) — silent for a valid, not-soon-expiring MOT. */
function MotBadge({ motExpiry }: { motExpiry: string | null }) {
  const flag = motFlagFor(motExpiry);
  if (flag.tone === "ok") return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        MOT_TONE[flag.tone],
      )}
    >
      {flag.tone !== "unknown" && <AlertTriangle className="size-3" />}
      {flag.label}
    </span>
  );
}

function QueueTable({
  rows,
  users,
  items,
  mode,
  onOpen,
}: {
  rows: Row[];
  users: User[];
  items: InspectionChecklistItem[];
  mode: "pending" | "completed";
  onOpen: (v: Vehicle) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {/*
              Responsive columns (GEN-93). On a phone this table is 896px of
              content in a ~326px window, so the secondary columns are hidden
              rather than left behind a long horizontal drag. Reg, Vehicle and
              Action — identify the car and act on it — are always present, and
              the hidden signals (waiting time, progress, flags) fold into the
              Vehicle cell so nothing is actually lost.
            */}
            <TableHead className="hidden sm:table-cell">Reg</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead className="hidden sm:table-cell">Waiting</TableHead>
            <TableHead className="hidden lg:table-cell">MOT</TableHead>
            <TableHead className="hidden lg:table-cell">Inspector</TableHead>
            <TableHead className="hidden lg:table-cell">Progress</TableHead>
            <TableHead className="hidden md:table-cell">Flagged</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ vehicle, checks, progress, total }) => {
            const wait = waitInfo(vehicle.receivedDate);
            const squares = buildSquares(checks, items);
            const flagged = flaggedCount(checks);
            // The actual person who recorded the checks for THIS vehicle, not a
            // single global inspector applied to every row.
            const inspectorId = checks.find((c) => c.carriedOutBy)?.carriedOutBy;
            const inspector = inspectorId
              ? users.find((u) => u.id === inspectorId)
              : undefined;
            return (
              <TableRow key={vehicle.id}>
                <TableCell className="hidden sm:table-cell">
                  <RegPlate registration={vehicle.registration} size="sm" />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col leading-tight">
                    {/* Below sm the Reg column is dropped entirely — three
                        columns will not fit 326px without clipping the action
                        button — so the plate rides in this cell instead. */}
                    <span className="mb-1 sm:hidden">
                      <RegPlate registration={vehicle.registration} size="sm" />
                    </span>
                    <span className="font-medium">
                      {vehicle.make} {vehicle.model}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {vehicle.stockId} · {formatDate(vehicle.receivedDate)}
                    </span>
                    {/* Carries the hidden columns' signal on small screens so
                        nothing is lost when they drop out. */}
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground lg:hidden">
                      <span className="tabular-nums">
                        {progress}/{total} checked
                      </span>
                      <span className={cn("sm:hidden", wait.urgent && "text-destructive")}>
                        · {wait.days}d waiting
                      </span>
                      {flagged > 0 && (
                        <span className="text-destructive md:hidden">
                          · {flagged} flagged
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      wait.cls,
                    )}
                  >
                    {wait.urgent && <AlertTriangle className="size-3" />}
                    {wait.days}d waiting
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <MotBadge motExpiry={vehicle.motExpiry} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {inspector ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Avatar size="sm" title={inspector.name}>
                        <AvatarFallback>
                          {getInitials(inspector.name)}
                        </AvatarFallback>
                      </Avatar>
                      {inspector.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <ProgressSquares squares={squares} progress={progress} total={total} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {flagged > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                      <AlertTriangle className="size-3" />
                      {flagged}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                      0
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant={mode === "completed" ? "outline" : "default"}
                    onClick={() => onOpen(vehicle)}
                  >
                    {mode === "completed"
                      ? "View"
                      : progress > 0
                        ? "Continue"
                        : "Start"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
