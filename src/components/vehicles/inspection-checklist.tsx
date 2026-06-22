"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardCheck, Loader2, Plus, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { inspectionService } from "@/lib/services/inspection-service";
import { inspectionNoteService } from "@/lib/services/inspection-note-service";
import { authService } from "@/lib/services/auth-service";
import { INSPECTION_ITEMS, NEGATIVE_INSPECTION_STATUSES } from "@/lib/constants";
import type { InspectionCheck, InspectionNote, User, Vehicle } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/lib/utils";
// onComplete callback lets a side-panel host close the panel instead of
// navigating away from the underlying page (Phase 5 — v4.1 spec §11.5).
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface Props {
  vehicle: Vehicle;
  inspector: string;
  /** When provided, called after the inspection completes instead of navigating. */
  onComplete?: () => void;
}

/** Compact circular progress indicator for the summary header. */
function ProgressRing({ percent }: { percent: number }) {
  const size = 44;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (percent / 100) * c}
          className="stroke-emerald-500 transition-[stroke-dashoffset]"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-2xs font-semibold tabular-nums">
        {percent}%
      </span>
    </div>
  );
}

export function InspectionChecklist({ vehicle, inspector, onComplete }: Props) {
  const { user } = useAuth();
  const [checks, setChecks] = useState<InspectionCheck[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState<InspectionNote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  // Per-field autosave indicator + a post-complete banner so the "saved"
  // and "completed" states are visible (the form has no manual Save).
  const [saving, setSaving] = useState(false);
  const [lastCompleted, setLastCompleted] = useState<{ flagged: number } | null>(
    null,
  );

  useEffect(() => {
    void inspectionService.getForVehicle(vehicle.id).then(setChecks);
    void inspectionNoteService.getForVehicle(vehicle.id).then(setNotes);
    void authService.getAllUsers().then(setUsers);
  }, [vehicle.id]);

  async function handleAddNote() {
    if (!user || !newNote.trim()) return;
    setSavingNote(true);
    try {
      await inspectionNoteService.add({
        vehicleId: vehicle.id,
        userId: user.id,
        content: newNote.trim(),
      });
      setNotes(await inspectionNoteService.getForVehicle(vehicle.id));
      setNewNote("");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleStart() {
    if (!user) return;
    const fresh = await inspectionService.start(vehicle.id, user.id);
    setChecks(fresh);
    toast.success("Inspection started");
  }

  async function handleStatusChange(num: number, status: string) {
    if (!user) return;
    setSaving(true);
    try {
      const existing = checks?.find((c) => c.checkNumber === num);
      await inspectionService.saveCheck({
        vehicleId: vehicle.id,
        checkNumber: num,
        status,
        actionRequired: existing?.actionRequired ?? null,
        carriedOutBy: user.id,
      });
      setChecks(await inspectionService.getForVehicle(vehicle.id));
    } finally {
      setSaving(false);
    }
  }

  async function handleActionChange(num: number, action: string) {
    if (!user) return;
    setSaving(true);
    try {
      const existing = checks?.find((c) => c.checkNumber === num);
      await inspectionService.saveCheck({
        vehicleId: vehicle.id,
        checkNumber: num,
        status: existing?.status ?? "",
        actionRequired: action || null,
        carriedOutBy: user.id,
      });
      setChecks(await inspectionService.getForVehicle(vehicle.id));
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!user) return;
    setSubmitting(true);
    try {
      const result = await inspectionService.complete(vehicle.id, user.id);
      setLastCompleted({ flagged: result.flagged });
      toast.success(
        result.flagged > 0
          ? `Inspection complete — ${result.flagged} item${result.flagged === 1 ? "" : "s"} added to Things to Do`
          : "Inspection complete — all items pass",
      );
      onComplete?.();
    } finally {
      setSubmitting(false);
    }
  }

  if (checks === null) {
    return (
      <Card className="p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-72 w-full" />
      </Card>
    );
  }

  if (checks.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <ClipboardCheck className="size-5" />
        </span>
        <div className="text-base font-semibold">No inspection yet</div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Run a 20-point inspection to surface issues and auto-generate Things
          to Do. Your answers save automatically as you go.
        </p>
        <Button onClick={handleStart} className="mt-2">
          Start Inspection
        </Button>
      </Card>
    );
  }

  const completed = checks.filter((c) => c.status).length;
  const total = INSPECTION_ITEMS.length;
  const percent = Math.round((completed / total) * 100);
  const flagged = checks.filter(
    (c) => c.status && NEGATIVE_INSPECTION_STATUSES.has(c.status),
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex-row flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <ProgressRing percent={percent} />
          <div className="text-sm">
            <div className="flex flex-wrap items-center gap-2 font-medium">
              <span>{completed}/{total} completed</span>
              {flagged > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                  <AlertTriangle className="size-3" />
                  {flagged} flagged
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Inspector: {inspector}</span>
              <span aria-hidden>·</span>
              {saving ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> Saving…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3" /> All changes saved
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleStart} disabled={submitting}>
            Reset
          </Button>
          <Button
            onClick={handleComplete}
            disabled={submitting || completed === 0}
          >
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Complete Inspection
          </Button>
        </div>
      </Card>

      {lastCompleted ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <Check className="size-4 shrink-0 text-emerald-600" />
          <span>
            Inspection completed
            {lastCompleted.flagged > 0
              ? ` — ${lastCompleted.flagged} item${lastCompleted.flagged === 1 ? "" : "s"} sent to Things to Do.`
              : " — all items pass."}{" "}
            You can still update any answer below; changes save automatically.
          </span>
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="divide-y">
          {INSPECTION_ITEMS.map((item) => {
            const check = checks.find((c) => c.checkNumber === item.number);
            const status = check?.status ?? "";
            const isNegative = !!status && NEGATIVE_INSPECTION_STATUSES.has(status);
            const dot = !status
              ? "bg-muted-foreground/30"
              : isNegative
                ? "bg-rose-500"
                : "bg-emerald-500";
            return (
              <div
                key={item.number}
                className={cn(
                  "flex items-center gap-3 px-4 py-2",
                  isNegative && "bg-rose-50/60 dark:bg-rose-950/20",
                )}
              >
                <span
                  className={cn("size-2.5 shrink-0 rounded-full", dot)}
                  title={status || "Not checked"}
                />
                <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {item.number}
                </span>
                <span className="w-40 shrink-0 truncate text-sm font-medium">
                  {item.item}
                </span>
                <div className="w-36 shrink-0">
                  <Select
                    value={status}
                    onValueChange={(v) => handleStatusChange(item.number, v)}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {item.statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    defaultValue={check?.actionRequired ?? ""}
                    placeholder={
                      isNegative ? "Describe what needs doing…" : "(optional)"
                    }
                    onBlur={(e) =>
                      handleActionChange(item.number, e.target.value)
                    }
                    className={cn(
                      "h-8 text-xs",
                      isNegative && "border-rose-300 dark:border-rose-800",
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Inspection Notes — v4.1 §11.5 / Gap 4: append-only sub-entity */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Inspection Notes</h3>
          <span className="text-xs text-muted-foreground">
            {notes.length} note{notes.length === 1 ? "" : "s"} · append-only
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note…"
            className="min-h-20"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={savingNote || !newNote.trim()}
            >
              {savingNote ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Plus className="mr-1 h-3 w-3" />
              )}
              Add Note
            </Button>
          </div>
        </div>
        {notes.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            {notes.map((n) => {
              const author = users.find((u) => u.id === n.userId);
              return (
                <div key={n.id} className="rounded border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">
                      {author?.name ?? "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{n.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
