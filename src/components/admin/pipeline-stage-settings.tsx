"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { pipelineStageService } from "@/lib/services/pipeline-stage-service";
import type { PipelineStage, StageBehaviour } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const BEHAVIOUR_LABEL: Record<StageBehaviour, string> = {
  open: "No side effects",
  reserved: "Reserves the car",
  won: "Completes the sale",
  lost: "Releases the car",
};

const BEHAVIOUR_HINT: Record<StageBehaviour, string> = {
  open: "Deals sit here without changing the car.",
  reserved: "The car comes off the forecourt and its advert shows as reserved.",
  won: "The car is stamped sold, the advert closes and the sale is recorded.",
  lost: "A reserved car goes back on the forecourt.",
};

const BEHAVIOUR_TONE: Record<StageBehaviour, string> = {
  open: "text-muted-foreground",
  reserved: "text-amber-600 dark:text-amber-400",
  won: "text-emerald-600 dark:text-emerald-400",
  lost: "text-rose-600 dark:text-rose-400",
};

/**
 * Settings › Sales Pipeline (GEN-65).
 *
 * Rename, reorder, add and remove the columns on the sales board. Two rules
 * keep a pipeline from being configured into a dead end: removing a stage
 * always moves its deals somewhere valid first, and the stages the sale
 * lifecycle depends on can be renamed and hidden but never deleted outright.
 */
export function PipelineStageSettings() {
  const { company, user } = useAuth();
  const [stages, setStages] = useState<PipelineStage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newBehaviour, setNewBehaviour] = useState<StageBehaviour>("open");
  const [removing, setRemoving] = useState<PipelineStage | null>(null);
  const [removalCount, setRemovalCount] = useState<number | null>(null);
  const [moveTo, setMoveTo] = useState("");

  useEffect(() => {
    if (!company) return;
    void pipelineStageService.getAll(company.id).then(setStages);
  }, [company]);

  async function reload() {
    if (!company) return;
    setStages(await pipelineStageService.getAll(company.id));
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

  function handleRename(stage: PipelineStage, label: string) {
    if (!user || label.trim() === stage.label) return;
    void run(
      () => pipelineStageService.update(stage.id, { label }, user.id).then(),
      "Stage renamed",
    );
  }

  function handleMove(index: number, delta: number) {
    if (!user || !company || !stages) return;
    const next = [...stages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    // Optimistic: the board order is the whole point of this control, so it
    // should move the instant it's clicked.
    setStages(next);
    void run(
      () =>
        pipelineStageService.reorder(
          company.id,
          next.map((s) => s.id),
          user.id,
        ),
      "Order saved",
    );
  }

  function handleToggle(stage: PipelineStage) {
    if (!user) return;
    void run(
      () =>
        pipelineStageService
          .update(stage.id, { enabled: !stage.enabled }, user.id)
          .then(),
      stage.enabled ? "Stage hidden from the board" : "Stage shown on the board",
    );
  }

  function handleAdd() {
    if (!user || !company) return;
    const label = newLabel.trim();
    if (!label) {
      toast.error("Stage name is required");
      return;
    }
    void run(async () => {
      await pipelineStageService.create(
        { companyId: company.id, label, behaviour: newBehaviour },
        user.id,
      );
      setNewLabel("");
      setNewBehaviour("open");
    }, "Stage added");
  }

  async function openRemoval(stage: PipelineStage) {
    if (!company || !stages) return;
    setRemoving(stage);
    setRemovalCount(null);
    setMoveTo(stages.find((s) => s.id !== stage.id)?.slug ?? "");
    setRemovalCount(
      await pipelineStageService.countDeals(company.id, stage.slug),
    );
  }

  function confirmRemoval() {
    if (!user || !removing || !moveTo) return;
    const stage = removing;
    void run(async () => {
      const { movedDeals } = await pipelineStageService.remove(
        stage.id,
        moveTo,
        user.id,
      );
      setRemoving(null);
      toast.success(
        movedDeals > 0
          ? `"${stage.label}" removed, ${movedDeals} deal${movedDeals === 1 ? "" : "s"} moved`
          : `"${stage.label}" removed`,
      );
    });
  }

  if (!stages) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-0 p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Pipeline stages</h3>
          <p className="text-xs text-muted-foreground">
            These are the columns on the sales board, in order. Renaming a
            stage is safe at any time; deals keep their place.
          </p>
        </div>

        <ul className="divide-y">
          {stages.map((stage, i) => (
            <li
              key={stage.id}
              className={cn(
                "flex flex-wrap items-center gap-2 px-4 py-2.5",
                !stage.enabled && "bg-muted/30",
              )}
            >
              <span className="flex shrink-0 flex-col">
                <button
                  type="button"
                  disabled={i === 0 || busy}
                  onClick={() => handleMove(i, -1)}
                  aria-label={`Move ${stage.label} earlier`}
                  className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === stages.length - 1 || busy}
                  onClick={() => handleMove(i, 1)}
                  aria-label={`Move ${stage.label} later`}
                  className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </span>

              <StageLabelInput
                stage={stage}
                disabled={busy}
                onRename={(label) => handleRename(stage, label)}
              />

              <span
                className={cn(
                  "w-44 shrink-0 text-xs",
                  BEHAVIOUR_TONE[stage.behaviour],
                )}
                title={BEHAVIOUR_HINT[stage.behaviour]}
              >
                {BEHAVIOUR_LABEL[stage.behaviour]}
              </span>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                disabled={busy}
                onClick={() => handleToggle(stage)}
              >
                {stage.enabled ? "Hide" : "Show"}
              </Button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void openRemoval(stage)}
                aria-label={`Remove ${stage.label}`}
                className="grid size-8 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-end gap-2 border-t px-4 py-3">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="new-stage">New stage</Label>
            <Input
              id="new-stage"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="e.g. Awaiting Finance"
              className="h-9"
            />
          </div>
          <div className="w-56">
            <Label htmlFor="new-behaviour">What it does</Label>
            <Select
              items={BEHAVIOUR_LABEL}
              value={newBehaviour}
              onValueChange={(v) => setNewBehaviour(v as StageBehaviour)}
            >
              <SelectTrigger id="new-behaviour" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BEHAVIOUR_LABEL) as StageBehaviour[]).map((b) => (
                  <SelectItem key={b} value={b}>
                    {BEHAVIOUR_LABEL[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" className="h-9" disabled={busy} onClick={handleAdd}>
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add stage
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            {BEHAVIOUR_HINT[newBehaviour]}
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
            <DialogTitle>Remove &ldquo;{removing?.label}&rdquo;?</DialogTitle>
            <DialogDescription>
              {removalCount === null
                ? "Checking what's in this stage…"
                : removalCount === 0
                  ? "Nothing is sitting in this stage."
                  : `${removalCount} deal${removalCount === 1 ? " is" : "s are"} in this stage. ${removalCount === 1 ? "It" : "They"} will be moved, not deleted.`}
              {removing?.isSystem
                ? " This is a built-in stage, so it will be hidden from the board rather than deleted: the sale lifecycle still refers to it."
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6">
            <Label htmlFor="move-to">Move any deals to</Label>
            <Select
              items={Object.fromEntries(
                (stages ?? [])
                  .filter((s) => s.id !== removing?.id)
                  .map((s) => [s.slug, s.label]),
              )}
              value={moveTo}
              onValueChange={setMoveTo}
            >
              <SelectTrigger id="move-to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(stages ?? [])
                  .filter((s) => s.id !== removing?.id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.slug}>
                      {s.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !moveTo || removalCount === null}
              onClick={confirmRemoval}
            >
              Remove stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Rename field — commits on blur/Enter so it isn't a write per keystroke. */
function StageLabelInput({
  stage,
  disabled,
  onRename,
}: {
  stage: PipelineStage;
  disabled: boolean;
  onRename: (label: string) => void;
}) {
  const [value, setValue] = useState(stage.label);
  const [stored, setStored] = useState(stage.label);
  if (stored !== stage.label) {
    setStored(stage.label);
    setValue(stage.label);
  }

  return (
    <Input
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const next = value.trim();
        if (!next) {
          setValue(stage.label);
          return;
        }
        onRename(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setValue(stage.label);
      }}
      aria-label={`Rename ${stage.label}`}
      className="h-8 min-w-[160px] flex-1 border-transparent bg-transparent shadow-none hover:border-border focus-visible:border-input"
    />
  );
}
