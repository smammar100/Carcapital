"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { InspectionCheck, Vehicle } from "@/lib/types";
import { inspectionService } from "@/lib/services/inspection-service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PanelCard, Pill } from "./primitives";
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
 * 20-point inspection report — table style. Each row carries a
 * pass/fail/warn pill plus any action-required note. Failed items will
 * have already been auto-added to Things to Do by the inspection flow.
 */
export function InspectionTab({ vehicle, onOpenInspection }: InspectionTabProps) {
  const [checks, setChecks] = useState<InspectionCheck[] | null>(null);

  useEffect(() => {
    void inspectionService.getForVehicle(vehicle.id).then(setChecks);
  }, [vehicle.id]);

  if (checks === null) {
    return (
      <PanelCard noHead>
        <Skeleton className="h-32 w-full" />
      </PanelCard>
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

  const passed = checks.filter((c) => c.status === "pass" || c.status === "good").length;

  return (
    <PanelCard
      title="20-Point Post-Arrival Inspection"
      subtitle={`${passed} of ${checks.length} passed`}
      trailing={
        onOpenInspection ? (
          <Button variant="outline" size="sm" onClick={onOpenInspection}>
            Re-inspect
          </Button>
        ) : null
      }
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b bg-muted/30 text-left">
            <Th className="w-10">#</Th>
            <Th>Check</Th>
            <Th>Status</Th>
            <Th>Action Required</Th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => {
            const norm = c.status?.toLowerCase().replace(/\s+/g, "_") ?? "";
            const tone = STATUS_TONE[norm] ?? "neutral";
            return (
              <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <Td className="font-mono">{c.checkNumber}</Td>
                <Td>{c.checkItem}</Td>
                <Td>
                  <Pill tone={tone}>
                    <span className="capitalize">
                      {(c.status ?? "—").replace(/_/g, " ")}
                    </span>
                  </Pill>
                </Td>
                <Td className={cn(!c.actionRequired && "text-muted-foreground")}>
                  {c.actionRequired ?? "—"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PanelCard>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
