"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  vehicle: Vehicle;
  inspector: string;
  /** When provided, called after the inspection completes instead of navigating. */
  onComplete?: () => void;
}

export function InspectionChecklist({ vehicle, inspector, onComplete }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [checks, setChecks] = useState<InspectionCheck[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState<InspectionNote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

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
    const existing = checks?.find((c) => c.checkNumber === num);
    await inspectionService.saveCheck({
      vehicleId: vehicle.id,
      checkNumber: num,
      status,
      actionRequired: existing?.actionRequired ?? null,
      carriedOutBy: user.id,
    });
    const fresh = await inspectionService.getForVehicle(vehicle.id);
    setChecks(fresh);
  }

  async function handleActionChange(num: number, action: string) {
    if (!user) return;
    const existing = checks?.find((c) => c.checkNumber === num);
    await inspectionService.saveCheck({
      vehicleId: vehicle.id,
      checkNumber: num,
      status: existing?.status ?? "",
      actionRequired: action || null,
      carriedOutBy: user.id,
    });
    const fresh = await inspectionService.getForVehicle(vehicle.id);
    setChecks(fresh);
  }

  async function handleComplete() {
    if (!user) return;
    setSubmitting(true);
    try {
      const result = await inspectionService.complete(vehicle.id, user.id);
      toast.success(
        result.flagged > 0
          ? `Inspection complete — ${result.flagged} item${result.flagged === 1 ? "" : "s"} added to Things to Do`
          : "Inspection complete — all items pass",
      );
      if (onComplete) {
        onComplete();
      } else {
        router.push(`/vehicles/${vehicle.id}`);
      }
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
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No inspection has been started for this vehicle yet.
        </p>
        <Button onClick={handleStart} className="mt-4">
          Start Inspection
        </Button>
      </Card>
    );
  }

  const completed = checks.filter((c) => c.status).length;
  const total = INSPECTION_ITEMS.length;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">
              Inspector: {inspector}
            </div>
            <div className="text-xs text-muted-foreground">
              {completed}/{total} items completed ({percent}%)
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleStart}
              disabled={submitting}
            >
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
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-emerald-500 transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="w-44">Status</TableHead>
              <TableHead>Action required</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INSPECTION_ITEMS.map((item) => {
              const check = checks.find((c) => c.checkNumber === item.number);
              const isNegative =
                check && NEGATIVE_INSPECTION_STATUSES.has(check.status);
              return (
                <TableRow
                  key={item.number}
                  className={cn(
                    isNegative && "bg-rose-50/60 dark:bg-rose-950/20",
                  )}
                >
                  <TableCell className="tabular-nums">{item.number}</TableCell>
                  <TableCell className="font-medium">{item.item}</TableCell>
                  <TableCell>
                    <Select
                      value={check?.status ?? ""}
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
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={check?.actionRequired ?? ""}
                      placeholder={
                        isNegative
                          ? "Describe what needs doing…"
                          : "(optional)"
                      }
                      onBlur={(e) =>
                        handleActionChange(item.number, e.target.value)
                      }
                      className={cn(
                        "h-8 text-xs",
                        isNegative && "border-rose-300 dark:border-rose-800",
                      )}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
