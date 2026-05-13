"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { InspectionCheck, Vehicle } from "@/lib/types";
import { inspectionService } from "@/lib/services/inspection-service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Panel, Pill } from "./primitives";
import { cn } from "@/lib/utils";

interface InspectionTabProps {
  vehicle: Vehicle;
  onOpenInspection?: () => void;
}

const STATUS_TONE: Record<string, React.ComponentProps<typeof Pill>["tone"]> = {
  pass: "good",
  good: "good",
  valid: "good",
  present: "good",
  minor: "warn",
  minor_damage: "warn",
  replace: "bad",
  fail: "bad",
  missing: "bad",
};

/**
 * 20-point inspection report — shadcn Table with pass/fail/warn pills
 * and any action-required notes. Failed items have already been auto-
 * added to Things to Do by the inspection flow.
 */
export function InspectionTab({ vehicle, onOpenInspection }: InspectionTabProps) {
  const [checks, setChecks] = useState<InspectionCheck[] | null>(null);

  useEffect(() => {
    void inspectionService.getForVehicle(vehicle.id).then(setChecks);
  }, [vehicle.id]);

  if (checks === null) {
    return (
      <Panel title="Inspection" subtitle="Loading…">
        <Skeleton className="h-32 w-full" />
      </Panel>
    );
  }

  if (checks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No inspection yet"
        description="Run a 20-point inspection to surface issues and auto-generate Things to Do."
        action={
          onOpenInspection ? (
            <Button onClick={onOpenInspection}>Start Inspection</Button>
          ) : null
        }
      />
    );
  }

  const passed = checks.filter(
    (c) => c.status === "pass" || c.status === "good",
  ).length;

  return (
    <Panel
      title="20-Point Post-Arrival Inspection"
      subtitle={`${passed} of ${checks.length} passed`}
      action={
        onOpenInspection ? (
          <Button variant="outline" size="sm" onClick={onOpenInspection}>
            Re-inspect
          </Button>
        ) : null
      }
      flush
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Check</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action Required</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checks.map((c) => {
            const norm = c.status?.toLowerCase().replace(/\s+/g, "_") ?? "";
            const tone = STATUS_TONE[norm] ?? "neutral";
            return (
              <TableRow key={c.id}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {c.checkNumber}
                </TableCell>
                <TableCell className="font-medium">{c.checkItem}</TableCell>
                <TableCell>
                  <Pill tone={tone}>{(c.status ?? "—").replace(/_/g, " ")}</Pill>
                </TableCell>
                <TableCell className={cn(!c.actionRequired && "text-muted-foreground")}>
                  {c.actionRequired ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}
