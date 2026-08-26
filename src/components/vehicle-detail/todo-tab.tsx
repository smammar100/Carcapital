"use client";

import { useEffect, useState } from "react";
import { Check, Download, Loader2, Plus, Trash2 } from "lucide-react";
import type { TodoItem, TodoStatus, Vendor } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { todoService } from "@/lib/services/todo-service";
import { vendorService } from "@/lib/services/vendor-service";
import { toast } from "@/lib/toast";
import { parseNumeric } from "@/lib/field-edit";
import { useAutoFocus } from "@/hooks/use-auto-focus";
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { Panel, Pill } from "./primitives";

interface TodoTabProps {
  vehicleId: string;
  /** Download the Job Card PDF (the prep/repair job sheet for this vehicle). */
  onExportPdf?: () => void;
  exporting?: boolean;
  /** Fired after any change that can move the car's status (GEN-64). */
  onChanged?: () => void;
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
const STATUS_ITEMS: Record<string, string> = Object.fromEntries(
  STATUS_ORDER.map((s) => [s, STATUS_LABEL[s]]),
);

/**
 * "£1,250.50" / "1250.5" → 1250.5, "" → null (cleared), anything else →
 * `undefined` so the caller can reject it instead of silently storing null.
 *
 * Shared with the vehicle-detail inline editors so money parses identically
 * wherever it is typed.
 */
const parseCost = parseNumeric;

const costToInput = (cost: number | null): string =>
  cost == null ? "" : String(cost);

/**
 * Things to Do tab — repairs, prep work, and inspection follow-ups, grouped by
 * status. Every field on a row is editable in place (status, description,
 * vendor, cost) and saves straight through to `todo_items`; the list was
 * previously render-only, which is why nothing a user did to it stuck (GEN-64).
 */
export function TodoTab({
  vehicleId,
  onExportPdf,
  exporting,
  onChanged,
}: TodoTabProps) {
  const { company, user } = useAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [addingTo, setAddingTo] = useState<TodoStatus | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void todoService.getForVehicle(vehicleId).then(setTodos);
    if (company?.id) {
      void vendorService.getAll(company.id).then(setVendors);
    }
  }, [vehicleId, company?.id]);

  async function refresh() {
    setTodos(await todoService.getForVehicle(vehicleId));
    onChanged?.();
  }

  async function handleAdd(
    status: TodoStatus,
    input: { description: string; vendorId: string | null; cost: number | null },
  ) {
    if (!user?.id) return;
    try {
      await todoService.add({
        vehicleId,
        description: input.description,
        vendorId: input.vendorId,
        cost: input.cost,
        source: "manual",
        createdBy: user.id,
        status,
      });
      await refresh();
      setAddingTo(null);
      toast.success("Item added");
    } catch (err) {
      const obj = err as { message?: string };
      toast.error(obj?.message ?? "Couldn't add item");
    }
  }

  /**
   * Save one field of one row. Applied optimistically so the list doesn't
   * flicker, then reconciled against what the database actually stored.
   */
  async function handlePatch(
    id: string,
    patch: {
      description?: string;
      vendorId?: string | null;
      status?: TodoStatus;
      cost?: number | null;
    },
  ) {
    if (!user?.id) return;
    const previous = todos;
    setTodos((prev) =>
      prev?.map((t) => (t.id === id ? { ...t, ...patch } : t)) ?? prev,
    );
    setSavingId(id);
    try {
      await todoService.update(id, patch, user.id);
      await refresh();
    } catch (err) {
      setTodos(previous ?? null);
      const obj = err as { message?: string };
      toast.error(obj?.message ?? "Couldn't save that change");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(item: TodoItem) {
    if (!user?.id) return;
    const ok = await confirm({
      title: "Delete this item?",
      description: `"${item.description}" will be removed from this car's Things to Do. This cannot be undone.`,
      confirmText: "Delete item",
      destructive: true,
    });
    if (!ok) return;
    try {
      await todoService.remove(item.id, user.id);
      await refresh();
      toast.success("Item deleted");
    } catch (err) {
      const obj = err as { message?: string };
      toast.error(obj?.message ?? "Couldn't delete item");
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
  const open = todos.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  ).length;
  const done = todos.filter((t) => t.status === "completed").length;
  const allDone = todos.length > 0 && open === 0;
  // Show all status groups that have items; always show the three core
  // groups (pending / in_progress / completed) even when empty so there's
  // always somewhere to add. Cancelled only appears when it has items.
  const groups = STATUS_ORDER.filter(
    (s) => s !== "cancelled" || todos.some((t) => t.status === s),
  );

  return (
    <Panel
      title={`Things to Do · ${todos.length} ${todos.length === 1 ? "item" : "items"}`}
      subtitle={
        todos.length === 0
          ? "Repairs, prep work, and inspection follow-ups"
          : `${done} of ${todos.length} done · ${open} still outstanding`
      }
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
        {allDone ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <Check className="size-4 shrink-0" />
            All prep work is complete, this car is ready to move to Sales.
          </div>
        ) : null}

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
                  <TodoRow
                    key={t.id}
                    item={t}
                    vendors={vendors}
                    vendorName={
                      t.vendorId
                        ? (vendorById.get(t.vendorId)?.name ?? "Unknown vendor")
                        : null
                    }
                    saving={savingId === t.id}
                    onPatch={(patch) => void handlePatch(t.id, patch)}
                    onDelete={() => void handleDelete(t)}
                  />
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
      {confirmDialog}
    </Panel>
  );
}

/**
 * One editable row. Description and cost are local until blur/Enter so typing
 * doesn't fire a write per keystroke; status and vendor save on change.
 */
function TodoRow({
  item,
  vendors,
  vendorName,
  saving,
  onPatch,
  onDelete,
}: {
  item: TodoItem;
  vendors: Vendor[];
  vendorName: string | null;
  saving: boolean;
  onPatch: (patch: {
    description?: string;
    vendorId?: string | null;
    status?: TodoStatus;
    cost?: number | null;
  }) => void;
  onDelete: () => void;
}) {
  const [description, setDescription] = useState(item.description);
  const [cost, setCost] = useState(costToInput(item.cost));
  // Re-sync when the stored row changes underneath us — a server refresh, or a
  // failed save rolling back — so the inputs never drift from what's stored.
  // Adjusted during render rather than in an effect: no extra commit, and it
  // keeps focus where the user put it (React's "adjusting state on prop
  // change" pattern).
  const [stored, setStored] = useState({
    description: item.description,
    cost: item.cost,
  });
  if (stored.description !== item.description || stored.cost !== item.cost) {
    setStored({ description: item.description, cost: item.cost });
    setDescription(item.description);
    setCost(costToInput(item.cost));
  }

  function commitDescription() {
    const next = description.trim();
    if (!next) {
      setDescription(item.description);
      toast.error("Description can't be empty");
      return;
    }
    if (next !== item.description) onPatch({ description: next });
  }

  function commitCost() {
    const next = parseCost(cost);

    /**
     * A cost that will not parse is a typo, not an instruction to clear the
     * field. Writing null here silently destroyed the stored figure — typing
     * one stray character into a £125.50 cost dropped it to £0.00 with no
     * warning, and the job total moved with it (GEN-105).
     */
    if (next === undefined) {
      toast.error("That cost is not a number. Enter an amount like 125.50.");
      setCost(costToInput(item.cost));
      return;
    }

    if (next !== item.cost) onPatch({ cost: next });
    setCost(costToInput(next));
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2 text-sm transition-opacity",
        saving && "opacity-60",
        item.status === "completed" && "text-muted-foreground",
      )}
    >
      <Select
        items={STATUS_ITEMS}
        value={item.status}
        onValueChange={(v) => onPatch({ status: v as TodoStatus })}
      >
        <SelectTrigger className="h-8 w-28 shrink-0 text-xs" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={commitDescription}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDescription(item.description);
        }}
        aria-label="Description"
        className={cn(
          "h-8 min-w-[120px] flex-1 border-transparent bg-transparent text-sm shadow-none hover:border-border focus-visible:border-input",
          item.status === "completed" && "line-through",
        )}
      />

      <Select
        items={{
          none: "No vendor",
          ...Object.fromEntries(vendors.map((v) => [v.id, v.name])),
        }}
        value={item.vendorId ?? "none"}
        onValueChange={(v) => onPatch({ vendorId: v === "none" ? null : v })}
      >
        <SelectTrigger className="h-8 w-32 shrink-0 text-xs" aria-label="Vendor">
          <SelectValue placeholder={vendorName ?? "No vendor"} />
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

      {/* Where the item came from. Least important column, so it's the one
          that goes when the panel is narrow. */}
      <span
        className="hidden w-14 shrink-0 text-right text-2xs capitalize text-muted-foreground sm:inline"
        title={`Source: ${item.source}`}
      >
        {item.source}
      </span>

      <Input
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        onBlur={commitCost}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setCost(costToInput(item.cost));
        }}
        inputMode="decimal"
        placeholder="—"
        aria-label="Cost"
        className="h-8 w-20 shrink-0 border-transparent bg-transparent text-right text-sm tabular-nums shadow-none hover:border-border focus-visible:border-input"
      />

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${item.description}`}
        className="grid size-8 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
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
  // Desktop-only focus when the add-row appears — see useAutoFocus.
  const descriptionRef = useAutoFocus<HTMLInputElement>();

  function submit() {
    const desc = description.trim();
    if (!desc) {
      toast.error("Description is required");
      return;
    }

    // Same rule as the inline editor: an unparseable cost is a typo, not an
    // instruction to store nothing (GEN-105).
    const parsedCost = parseCost(cost);
    if (parsedCost === undefined) {
      toast.error("That cost is not a number. Enter an amount like 125.50.");
      return;
    }

    setSaving(true);
    onAdd({
      description: desc,
      vendorId: vendorId === "none" ? null : vendorId,
      cost: parsedCost,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-muted/20 px-4 py-2.5">
      <Input
        ref={descriptionRef}
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
