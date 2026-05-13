"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { TodoItem, Vendor } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { todoService } from "@/lib/services/todo-service";
import { vendorService } from "@/lib/services/vendor-service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { PanelCard, Pill } from "./primitives";
import { cn } from "@/lib/utils";

interface TodoTabProps {
  vehicleId: string;
}

const STATUS_TONE: Record<TodoItem["status"], React.ComponentProps<typeof Pill>["tone"]> = {
  pending: "neutral",
  in_progress: "warn",
  completed: "good",
  cancelled: "bad",
};

const STATUS_LABEL: Record<TodoItem["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Things to Do tab — repairs, prep work, and inspection follow-ups for
 * this vehicle. Rendered as a data table with a grand-total footer so
 * the dealer can see the prep-cost commitment at a glance.
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
      <PanelCard noHead>
        <Skeleton className="h-32 w-full" />
      </PanelCard>
    );
  }

  const total = todos.reduce((acc, t) => acc + (t.cost ?? 0), 0);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  return (
    <PanelCard
      title={`Things to Do · ${todos.length} ${todos.length === 1 ? "item" : "items"}`}
      subtitle="Repairs, prep work, and inspection follow-ups"
      trailing={
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Item
        </Button>
      }
      bodyClassName="p-0"
    >
      {todos.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          Nothing to do — this vehicle is prep-ready.
        </div>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b bg-muted/30 text-left">
              <Th className="w-10">#</Th>
              <Th>Description</Th>
              <Th>Vendor</Th>
              <Th>Status</Th>
              <Th>Source</Th>
              <Th className="text-right">Cost</Th>
            </tr>
          </thead>
          <tbody>
            {todos.map((t) => (
              <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <Td className="font-mono">{t.serialNumber}</Td>
                <Td>{t.description}</Td>
                <Td>{t.vendorId ? vendorById.get(t.vendorId)?.name ?? "—" : "—"}</Td>
                <Td>
                  <Pill tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Pill>
                </Td>
                <Td className="capitalize text-muted-foreground">{t.source}</Td>
                <Td className="text-right font-mono">{formatCurrency(t.cost)}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-foreground text-background">
              <td
                colSpan={5}
                className="px-4 py-3 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#F5C518]/70"
              >
                Grand Total
              </td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-[#F5C518]">
                {formatCurrency(total, { showZero: true })}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
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
