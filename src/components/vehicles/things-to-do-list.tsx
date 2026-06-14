"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { TodoItem, Vendor } from "@/lib/types";
import { todoService } from "@/lib/services/todo-service";
import { vendorService } from "@/lib/services/vendor-service";
import { useAuth } from "@/contexts/auth-context";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface Props {
  vehicleId: string;
  /** When true, hides the controls — used in read-only contexts. */
  readonly?: boolean;
}

export function ThingsToDoList({ vehicleId, readonly }: Props) {
  const { user, company } = useAuth();
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    description: "",
    vendorId: "",
    cost: "",
  });

  useEffect(() => {
    if (!company) return;
    void todoService.getForVehicle(vehicleId).then(setTodos);
    void vendorService.getAll(company.id).then(setVendors);
  }, [vehicleId, company]);

  async function handleAdd() {
    if (!user) return;
    if (!draft.description.trim()) {
      toast.error("Description required");
      return;
    }
    setAdding(true);
    try {
      await todoService.add({
        vehicleId,
        description: draft.description.trim(),
        vendorId: draft.vendorId || null,
        cost: draft.cost ? Number(draft.cost) : null,
        source: "manual",
        createdBy: user.id,
      });
      setDraft({ description: "", vendorId: "", cost: "" });
      const fresh = await todoService.getForVehicle(vehicleId);
      setTodos(fresh);
      toast.success("Added");
    } finally {
      setAdding(false);
    }
  }

  async function handleStatusChange(id: string, status: TodoItem["status"]) {
    if (!user) return;
    await todoService.update(id, { status }, user.id);
    const fresh = await todoService.getForVehicle(vehicleId);
    setTodos(fresh);
  }

  async function handleRemove(id: string) {
    await todoService.remove(id);
    const fresh = await todoService.getForVehicle(vehicleId);
    setTodos(fresh);
    toast.success("Removed");
  }

  const grandTotal = todos?.reduce((s, t) => s + (t.cost ?? 0), 0) ?? 0;
  const completedCount = todos?.filter((t) => t.status === "completed").length ?? 0;
  const total = todos?.length ?? 0;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {completedCount} of {total} completed ({percent}%)
        </span>
        <span className="tabular-nums">
          Grand total: {formatCurrency(grandTotal)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-emerald-500 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      {todos === null ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-44">Vendor</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-28 text-right">Cost</TableHead>
                <TableHead className="w-12">Src</TableHead>
                {!readonly && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {todos.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={readonly ? 6 : 7}
                    className="text-center text-xs text-muted-foreground"
                  >
                    No items yet — add one below.
                  </TableCell>
                </TableRow>
              )}
              {todos.map((t) => (
                <TableRow
                  key={t.id}
                  className={cn(
                    t.status === "completed" && "opacity-60",
                  )}
                >
                  <TableCell className="tabular-nums">
                    {t.serialNumber}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-md whitespace-normal",
                      t.status === "completed" && "line-through",
                    )}
                  >
                    {t.description}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {vendors.find((v) => v.id === t.vendorId)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {readonly ? (
                      <Badge
                        variant="outline"
                        className="capitalize"
                      >
                        {t.status.replace("_", " ")}
                      </Badge>
                    ) : (
                      <Select
                        value={t.status}
                        onValueChange={(v) =>
                          handleStatusChange(t.id, v as TodoItem["status"])
                        }
                      >
                        <SelectTrigger className="h-7 w-[7.5rem] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(t.cost)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {t.source}
                    </Badge>
                  </TableCell>
                  {!readonly && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleRemove(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!readonly && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2">
          <Input
            value={draft.description}
            placeholder="New item — e.g. front brakes squeaking"
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
            className="min-w-60 flex-1"
          />
          <Select
            value={draft.vendorId}
            onValueChange={(v) =>
              setDraft((d) => ({ ...d, vendorId: v === "none" ? "" : v }))
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Vendor" />
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
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="£ cost"
            value={draft.cost}
            onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
            className="w-28"
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={adding || !draft.description.trim()}
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
