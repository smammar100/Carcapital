"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Plus } from "lucide-react";
import type { TodoItem, TodoStatus, Vendor } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { todoService } from "@/lib/services/todo-service";
import { vendorService } from "@/lib/services/vendor-service";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Panel, Pill } from "./primitives";

interface TodoTabProps {
  vehicleId: string;
  /** Download the Job Card PDF (the prep/repair job sheet for this vehicle). */
  onExportPdf?: () => void;
  exporting?: boolean;
}

const STATUS_TONE: Record<TodoStatus, React.ComponentProps<typeof Pill>["tone"]> = {
  pending: "neutral",
  in_progress: "warn",
  completed: "good",
  cancelled: "bad",
};
const STATUS_LABEL: Record<TodoStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Done",
  cancelled: "Cancelled",
};
const STATUS_ORDER: TodoStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

/**
 * Things to Do tab — repairs, prep work, and inspection follow-ups,
 * grouped by status (Variation B). Each group has its own "+ Add" that
 * opens an inline add row wired to `todoService.add`. No header CTA — the
 * per-group adds are the single, unambiguous way to create an item.
 */
export function TodoTab({ vehicleId, onExportPdf, exporting }: TodoTabProps) {
  const { company, user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [addingTo, setAddingTo] = useState<TodoStatus | null>(null);

  useEffect(() => {
    void todoService.getForVehicle(vehicleId).then(setTodos);
    if (company?.id) {
      void vendorService.getAll(company.id).then(setVendors);
    }
  }, [vehicleId, company?.id]);

  async function handleAdd(
    status: TodoStatus,
    input: { description: string; vendorId: string | null; cost: number | null },
  ) {
    if (!user?.id) return;
    try {
      const created = await todoService.add({
        vehicleId,
        description: input.description,
        vendorId: input.vendorId,
        cost: input.cost,
        source: "manual",
        createdBy: user.id,
      });
      // `add` always creates as "pending"; promote to the target group.
      if (status !== "pending") {
        await todoService.update(created.id, { status }, user.id);
      }
      setTodos(await todoService.getForVehicle(vehicleId));
      setAddingTo(null);
      toast.success("Item added");
    } catch (err) {
      const obj = err as { message?: string };
      toast.error(obj?.message ?? "Couldn't add item");
    }
  }

  if (todos === null) {
    return (
      <Panel title="Things to Do" subtitle="Loading…">
        <Skeleton className="h-32 w-full" />
      </Panel>
    );
  }

  const total = todos.reduce((acc, t) => acc + (t.cost ?? 0), 0);
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  // Show all status groups that have items; always show the three core
  // groups (pending / in_progress / completed) even when empty so there's
  // always somewhere to add. Cancelled only appears when it has items.
  const groups = STATUS_ORDER.filter(
    (s) => s !== "cancelled" || todos.some((t) => t.status === s),
  );

  return (
    <Panel
      title={`Things to Do · ${todos.length} ${todos.length === 1 ? "item" : "items"}`}
      subtitle="Repairs, prep work, and inspection follow-ups · grouped by status"
      action={
        onExportPdf && (
          <Button
            size="sm"
            variant="outline"
            disabled={exporting}
            onClick={onExportPdf}
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Job Card PDF
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {groups.map((status) => {
          const items = todos.filter((t) => t.status === status);
          return (
            <div
              key={status}
              className="overflow-hidden rounded-xl border border-border"
            >
              <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
                <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {items.length}
                </span>
                <button
                  type="button"
                  onClick={() => setAddingTo(status)}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3.5" /> Add
                </button>
              </div>

              <div className="divide-y divide-border">
                {items.length === 0 && addingTo !== status ? (
                  <div className="px-4 py-3 text-xs italic text-muted-foreground">
                    Nothing here.
                  </div>
                ) : null}

                {items.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium">{t.description}</span>
                    {t.vendorId ? (
                      <span className="text-xs text-muted-foreground">
                        · {vendorById.get(t.vendorId)?.name ?? "Unknown vendor"}
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs capitalize text-muted-foreground">
                      {t.source}
                    </span>
                    <span className="w-20 text-right tabular-nums">
                      {t.cost != null ? formatCurrency(t.cost) : "—"}
                    </span>
                  </div>
                ))}

                {addingTo === status ? (
                  <AddRow
                    vendors={vendors}
                    onAdd={(input) => void handleAdd(status, input)}
                    onCancel={() => setAddingTo(null)}
                  />
                ) : null}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Grand Total
          </span>
          <span className="text-base font-semibold tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </Panel>
  );
}

function AddRow({
  vendors,
  onAdd,
  onCancel,
}: {
  vendors: Vendor[];
  onAdd: (input: {
    description: string;
    vendorId: string | null;
    cost: number | null;
  }) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [vendorId, setVendorId] = useState<string>("none");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  function submit() {
    const desc = description.trim();
    if (!desc) {
      toast.error("Description is required");
      return;
    }
    setSaving(true);
    const n = Number(cost.replace(/[£,\s]/g, ""));
    onAdd({
      description: desc,
      vendorId: vendorId === "none" ? null : vendorId,
      cost: cost && !Number.isNaN(n) ? n : null,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-muted/20 px-4 py-2.5">
      <Input
        autoFocus
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="What needs doing?"
        className="h-8 min-w-[200px] flex-1 text-sm"
      />
      <Select
        items={{
          none: "No vendor",
          ...Object.fromEntries(vendors.map((v) => [v.id, v.name])),
        }}
        value={vendorId}
        onValueChange={setVendorId}
      >
        <SelectTrigger className="h-8 w-40 text-sm">
          <SelectValue placeholder="Vendor (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No vendor</SelectItem>
          {vendors.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        inputMode="decimal"
        placeholder="£0.00"
        className="h-8 w-24 text-right text-sm tabular-nums"
      />
      <Button type="button" size="sm" className="h-8" onClick={submit} disabled={saving}>
        {saving ? "Adding…" : "Add"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </Button>
    </div>
  );
}
