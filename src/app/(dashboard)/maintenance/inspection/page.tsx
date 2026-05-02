"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RegPlate } from "@/components/shared/reg-plate";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/utils";

interface Row {
  vehicle: Vehicle;
  progress: number;
  total: number;
}

export default function MaintenanceInspectionListPage() {
  const { company } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!company) return;
    void (async () => {
      const [vs, u] = await Promise.all([
        vehicleService.getAll(company.id),
        authService.getUsersForCompany(company.id),
      ]);
      const candidates = vs.filter(
        (v) =>
          v.status === "received" ||
          v.status === "inspection_pending" ||
          v.status === "being_prepared",
      );
      const out: Row[] = [];
      for (const v of candidates) {
        const checks = await inspectionService.getForVehicle(v.id);
        const progress = checks.filter((c) => c.status).length;
        out.push({ vehicle: v, progress, total: 20 });
      }
      setRows(out);
      setUsers(u);
    })();
  }, [company]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Inspection Queue</h1>
        <p className="text-sm text-muted-foreground">
          Vehicles in received / pending / being-prepared states.
        </p>
      </div>
      {!rows ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No vehicles need inspection"
          description="All current stock has cleared the inspection step."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
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
              {rows.map(({ vehicle, progress, total }) => {
                const inspector = users.find((u) => u.role === "inspector");
                return (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <RegPlate registration={vehicle.registration} size="sm" />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium">
                          {vehicle.make} {vehicle.model}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
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
                      <Badge variant="outline">
                        {progress}/{total}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/vehicles/${vehicle.id}/inspection`}>
                          {progress > 0 ? "Continue" : "Start"}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
