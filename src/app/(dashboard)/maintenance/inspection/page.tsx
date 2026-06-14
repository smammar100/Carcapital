"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { inspectionService } from "@/lib/services/inspection-service";
import { authService } from "@/lib/services/auth-service";
import type { User, Vehicle } from "@/lib/types";
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
import { RegPlate } from "@/components/shared/reg-plate";
import { EmptyState } from "@/components/shared/empty-state";
import { InspectionSidePanel } from "@/components/inspection/inspection-side-panel";
import { formatDate } from "@/lib/utils";

interface Row {
  vehicle: Vehicle;
  progress: number;
  total: number;
}

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
  const [selected, setSelected] = useState<Vehicle | null>(null);

  async function load() {
    if (!company) return;
    const [vs, u] = await Promise.all([
      vehicleService.getAll(company.id),
      authService.getUsersForCompany(company.id),
    ]);
    const scope = vs.filter((v) => SCOPE.has(v.status));
    const out: Row[] = [];
    for (const v of scope) {
      const checks = await inspectionService.getForVehicle(v.id);
      const progress = checks.filter((c) => c.status).length;
      out.push({ vehicle: v, progress, total: 20 });
    }
    setRows(out);
    setUsers(u);
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
      else if (r.vehicle.status !== "ready") p.push(r);
    }
    return { pending: p, completed: c };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inspection Queue</h1>
        <p className="text-sm text-muted-foreground">
          Pending vehicles need a 20-point inspection; completed ones move across
          automatically. Click a row to open the inspection side panel.
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

function QueueTable({
  rows,
  users,
  mode,
  onOpen,
}: {
  rows: Row[];
  users: User[];
  mode: "pending" | "completed";
  onOpen: (v: Vehicle) => void;
}) {
  const inspector = users.find((u) => u.role === "inspector");
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reg</TableHead>
            <TableHead>Make / Model</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Inspector</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ vehicle, progress, total }) => (
            <TableRow key={vehicle.id}>
              <TableCell>
                <RegPlate registration={vehicle.registration} size="sm" />
              </TableCell>
              <TableCell>
                <div className="flex flex-col leading-tight">
                  <span className="font-medium">
                    {vehicle.make} {vehicle.model}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {vehicle.stockId}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(vehicle.receivedDate)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {inspector?.name ?? "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={mode === "completed" ? "secondary" : "outline"}
                  className="tabular-nums"
                >
                  {progress}/{total}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
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
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
