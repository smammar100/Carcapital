"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { maintenanceNoteService } from "@/lib/services/maintenance-note-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { authService } from "@/lib/services/auth-service";
import type {
  JobNoteType,
  MaintenanceJob,
  MaintenanceJobNote,
  MaintenanceStatus,
  User,
  Vehicle,
} from "@/lib/types";
import { MAINTENANCE_STATUSES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegPlate } from "@/components/shared/reg-plate";
import { formatRelativeTime, formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";

const NOTE_TYPES: { value: JobNoteType; label: string; tone: string }[] = [
  { value: "note", label: "Note", tone: "secondary" },
  { value: "call_log", label: "Call Log", tone: "outline" },
  { value: "status_update", label: "Status Update", tone: "default" },
  { value: "vendor_update", label: "Vendor Update", tone: "outline" },
];

export default function MaintenanceJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, company } = useAuth();
  const [job, setJob] = useState<MaintenanceJob | null | undefined>(undefined);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [notes, setNotes] = useState<MaintenanceJobNote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<JobNoteType>("note");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!company) return;
    const j = await maintenanceService.getById(id);
    setJob(j);
    if (j) {
      const [v, n, u] = await Promise.all([
        vehicleService.getById(j.vehicleId),
        maintenanceNoteService.getForJob(j.id),
        authService.getUsersForCompany(company.id),
      ]);
      setVehicle(v);
      setNotes(n);
      setUsers(u);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, company]);

  async function handleAddNote() {
    if (!user || !job || !newNote.trim()) return;
    setSaving(true);
    try {
      await maintenanceNoteService.add({
        jobId: job.id,
        userId: user.id,
        noteType,
        content: newNote.trim(),
      });
      setNewNote("");
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: MaintenanceStatus) {
    if (!user || !job) return;
    await maintenanceService.updateStatus(job.id, newStatus, user.id);
    toast.success(`Status: ${newStatus.replace("_", " ")}`);
    void load();
  }

  async function handleAssign(assignedTo: string) {
    if (!user || !job) return;
    await maintenanceService.update(
      job.id,
      { assignedTo: assignedTo === "none" ? null : assignedTo },
      user.id,
    );
    toast.success("Owner updated");
    void load();
  }

  if (job === undefined) return <Skeleton className="h-96" />;
  if (job === null) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Job not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/maintenance">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to maintenance
        </Link>
      </Button>

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Maintenance Job
            </h1>
            <p className="text-sm text-muted-foreground">{job.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {vehicle && <RegPlate registration={vehicle.registration} />}
            <Select
              items={{
                none: "Unassigned",
                ...Object.fromEntries(users.map((u) => [u.id, u.name])),
              }}
              value={job.assignedTo ?? "none"}
              onValueChange={(v) => void handleAssign(v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={job.status} onValueChange={(v) => void handleStatusChange(v as MaintenanceStatus)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <KV label="Estimated cost" value={formatCurrency(job.estimatedCost)} />
          <KV label="Actual cost" value={formatCurrency(job.actualCost)} />
          <KV label="Due date" value={job.dueDate ?? "—"} />
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">Notes &amp; Activity</h2>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Select value={noteType} onValueChange={(v) => setNoteType(v as JobNoteType)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map((nt) => (
                  <SelectItem key={nt.value} value={nt.value}>
                    {nt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note…"
            className="min-h-20"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAddNote} disabled={saving || !newNote.trim()}>
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              Add Note
            </Button>
          </div>
        </div>
        {notes.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            {notes.map((n) => {
              const author = users.find((u) => u.id === n.userId);
              const nt = NOTE_TYPES.find((t) => t.value === n.noteType);
              return (
                <div key={n.id} className="rounded border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs uppercase">
                        {nt?.label ?? n.noteType}
                      </Badge>
                      <span className="text-xs font-medium">
                        {author?.name ?? "System"}
                      </span>
                    </div>
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

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
