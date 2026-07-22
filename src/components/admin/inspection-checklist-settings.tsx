"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { inspectionChecklistService } from "@/lib/services/inspection-checklist-service";
import type { InspectionChecklistItem } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

function parseStatusOptions(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Settings › Inspection Checklist (GEN-78).
 *
 * The 20-point inspection checklist used to be fixed in code. Add, rename,
 * reorder, edit the status options for, and remove points here — the live
 * Inspection Queue and per-vehicle inspection both read from this list, so
 * a change is visible on the next inspection started.
 *
 * Removing a point never touches inspections already recorded: each check
 * is a snapshot row with its own label and status, not a live join to this
 * table — it only stops that point appearing on inspections started
 * afterwards.
 */
export function InspectionChecklistSettings() {
  const { company, user } = useAuth();
  const [items, setItems] = useState<InspectionChecklistItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [newOptions, setNewOptions] = useState("");
  const [removing, setRemoving] = useState<InspectionChecklistItem | null>(
    null,
  );

  useEffect(() => {
    if (!company) return;
    void inspectionChecklistService.getAll(company.id).then(setItems);
  }, [company]);

  async function reload() {
    if (!company) return;
    setItems(await inspectionChecklistService.getAll(company.id));
  }

  async function run(work: () => Promise<void>, success?: string) {
    setBusy(true);
    try {
      await work();
      await reload();
      if (success) toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that change");
    } finally {
      setBusy(false);
    }
  }

  function handleRename(item: InspectionChecklistItem, label: string) {
    if (!user || label.trim() === item.item) return;
    void run(
      () =>
        inspectionChecklistService.update(item.id, { item: label }, user.id).then(),
      "Item renamed",
    );
  }

  function handleOptionsChange(item: InspectionChecklistItem, raw: string) {
    if (!user) return;
    const statusOptions = parseStatusOptions(raw);
    if (
      statusOptions.length === 0 ||
      statusOptions.join(",") === item.statusOptions.join(",")
    ) {
      return;
    }
    void run(
      () =>
        inspectionChecklistService
          .update(item.id, { statusOptions }, user.id)
          .then(),
      "Status options updated",
    );
  }

  function handleMove(index: number, delta: number) {
    if (!user || !company || !items) return;
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    // Optimistic: the checklist order is the whole point of this control.
    setItems(next);
    void run(
      () =>
        inspectionChecklistService.reorder(
          company.id,
          next.map((i) => i.id),
          user.id,
        ),
      "Order saved",
    );
  }

  function handleAdd() {
    if (!user || !company) return;
    const item = newItem.trim();
    if (!item) {
      toast.error("Item name is required");
      return;
    }
    const statusOptions = parseStatusOptions(newOptions);
    if (statusOptions.length === 0) {
      toast.error("Add at least one status option, comma-separated");
      return;
    }
    void run(async () => {
      await inspectionChecklistService.create(
        { companyId: company.id, item, statusOptions },
        user.id,
      );
      setNewItem("");
      setNewOptions("");
    }, "Item added");
  }

  function confirmRemoval() {
    if (!user || !removing) return;
    const item = removing;
    void run(async () => {
      await inspectionChecklistService.remove(item.id, user.id);
      setRemoving(null);
      toast.success(`"${item.item}" removed`);
    });
  }

  if (!items) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-0 p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Inspection checklist</h3>
          <p className="text-xs text-muted-foreground">
            These are the points on the vehicle inspection, in order. Renaming
            an item or its status options is safe at any time — inspections
            already recorded keep what was answered.
          </p>
        </div>

        <ul className="divide-y">
          {items.map((item, i) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 px-4 py-2.5"
            >
              <span className="flex shrink-0 flex-col">
                <button
                  type="button"
                  disabled={i === 0 || busy}
                  onClick={() => handleMove(i, -1)}
                  aria-label={`Move ${item.item} earlier`}
                  className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === items.length - 1 || busy}
                  onClick={() => handleMove(i, 1)}
                  aria-label={`Move ${item.item} later`}
                  className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </span>

              <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>

              <CommitInput
                value={item.item}
                disabled={busy}
                ariaLabel={`Rename ${item.item}`}
                className="min-w-[160px] flex-1"
                onCommit={(v) => handleRename(item, v)}
              />

              <CommitInput
                value={item.statusOptions.join(", ")}
                disabled={busy}
                ariaLabel={`Status options for ${item.item}`}
                className="min-w-[220px] flex-[2]"
                placeholder="Comma-separated status options"
                onCommit={(v) => handleOptionsChange(item, v)}
              />

              <button
                type="button"
                disabled={busy}
                onClick={() => setRemoving(item)}
                aria-label={`Remove ${item.item}`}
                className="grid size-8 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-end gap-2 border-t px-4 py-3">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="new-item">New item</Label>
            <Input
              id="new-item"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="e.g. Boot Seal Condition"
              className="h-9"
            />
          </div>
          <div className="min-w-[220px] flex-[2]">
            <Label htmlFor="new-options">Status options</Label>
            <Input
              id="new-options"
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="e.g. Good, Fair, Poor"
              className="h-9"
            />
          </div>
          <Button type="button" className="h-9" disabled={busy} onClick={handleAdd}>
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add item
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Comma-separated, in the order they should appear in the status
            dropdown on the inspection.
          </p>
        </div>
      </Card>

      <Dialog
        open={removing !== null}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove &ldquo;{removing?.item}&rdquo;?</DialogTitle>
            <DialogDescription>
              It will no longer appear on inspections started after this.
              Inspections already recorded keep whatever was answered for
              this point.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirmRemoval}>
              Remove item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Text field that commits on blur/Enter so it isn't a write per keystroke. */
function CommitInput({
  value,
  disabled,
  ariaLabel,
  placeholder,
  className,
  onCommit,
}: {
  value: string;
  disabled: boolean;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [stored, setStored] = useState(value);
  if (stored !== value) {
    setStored(value);
    setDraft(value);
  }

  return (
    <Input
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim();
        if (!next) {
          setDraft(value);
          return;
        }
        onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(value);
      }}
      aria-label={ariaLabel}
      className={`h-8 border-transparent bg-transparent shadow-none hover:border-border focus-visible:border-input ${className ?? ""}`}
    />
  );
}
