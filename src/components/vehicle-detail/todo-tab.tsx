"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import type { TodoItem, Vendor } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { todoService } from "@/lib/services/todo-service";
import { vendorService } from "@/lib/services/vendor-service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Panel, Pill } from "./primitives";

interface TodoTabProps {
  vehicleId: string;
}

const STATUS_TONE: Record<TodoItem["status"], React.ComponentProps<typeof Pill>["tone"]> = {
  pending: "neutral",
  in_progress: "warn",
  completed: "good",
  cancelled: "bad",
};

/**
 * Things to Do tab — repairs, prep work, and inspection follow-ups for
 * this vehicle. Rendered as a shadcn Table with a grand-total footer row.
 */
export function TodoTab({ vehicleId }: TodoTabProps) {
  const { company } = useAuth();
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    void todoService.getForVehicle(vehicleId).then(setTodos);
    if (company?.id) {
      void vendorService.getAll(company.id).then(setVendors);
    }
  }, [vehicleId, company?.id]);

  if (todos === null) {
    return (
      <Panel title="Things to Do" subtitle="Loading…">
        <Skeleton className="h-32 w-full" />
      </Panel>
    );
  }

  const total = todos.reduce((acc, t) => acc + (t.cost ?? 0), 0);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  return (
    <Panel
      title={`Things to Do · ${todos.length} ${todos.length === 1 ? "item" : "items"}`}
      subtitle="Repairs, prep work, and inspection follow-ups"
      action={
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Item
        </Button>
      }
      flush
    >
      {todos.length === 0 ? (
        <div className="px-4 py-8">
          <EmptyState
            icon={ClipboardCheck}
            title="All clear — prep-ready"
            description="No repairs, prep, or inspection follow-ups logged for this vehicle yet."
            action={
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Item
              </Button>
            }
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {todos.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {t.serialNumber}
                </TableCell>
                <TableCell className="font-medium">{t.description}</TableCell>
                <TableCell>
                  {t.vendorId
                    ? vendorById.get(t.vendorId)?.name ?? "—"
                    : "—"}
                </TableCell>
                <TableCell>
                  <Pill tone={STATUS_TONE[t.status]}>{t.status.replace(/_/g, " ")}</Pill>
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {t.source}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(t.cost)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t bg-muted/40 hover:bg-muted/40">
              <TableCell
                colSpan={5}
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Grand Total
              </TableCell>
              <TableCell className="text-right text-base font-semibold tabular-nums">
                {formatCurrency(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
