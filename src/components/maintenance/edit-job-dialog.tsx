"use client";

import { useEffect, useState } from "react";
import {
  CircleDot,
  User as UserIcon,
  Wrench,
  CalendarClock,
  PoundSterling,
} from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RegPlate } from "@/components/shared/reg-plate";
import { useAuth } from "@/contexts/auth-context";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { MAINTENANCE_STATUSES } from "@/lib/constants";
import type {
  MaintenanceJob,
  MaintenanceStatus,
  User,
  Vehicle,
  Vendor,
} from "@/lib/types";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface EditJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: MaintenanceJob | null;
  vehicle: Vehicle | null;
  vendors: Vendor[];
  users: User[];
  onSaved: () => void;
}

const STATUS_TONE: Record<MaintenanceStatus, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  in_progress:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  stalled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

function statusLabel(value: MaintenanceStatus): string {
  return MAINTENANCE_STATUSES.find((s) => s.value === value)?.label ?? value;
}

/** Inline £-prefixed currency input used in the cost rows. */
function CostInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex h-9 items-center rounded-md border bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
      <span className="text-sm text-muted-foreground">£</span>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ml-1.5 w-full bg-transparent text-sm tabular-nums outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3 py-2.5">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EditJobDialog({
  open,
  onOpenChange,
  job,
  vehicle,
  vendors,
  users,
  onSaved,
}: EditJobDialogProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<MaintenanceStatus>("pending");
  const [assignedTo, setAssignedTo] = useState("none");
  const [vendorId, setVendorId] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed the form whenever a job opens.
  useEffect(() => {
    if (!open || !job) return;
    setStatus(job.status);
    setAssignedTo(job.assignedTo ?? "none");
    setVendorId(job.vendorId ?? "none");
    setDueDate(job.dueDate ?? "");
    setEstimatedCost(job.estimatedCost != null ? String(job.estimatedCost) : "");
    setActualCost(job.actualCost != null ? String(job.actualCost) : "");
    setDescription(job.description ?? "");
  }, [open, job]);

  // Value→label maps so the Select triggers show names, not raw ids.
  const statusItems = Object.fromEntries(
    MAINTENANCE_STATUSES.map((s) => [s.value, s.label]),
  );
  const ownerItems: Record<string, string> = {
    none: "Unassigned",
    ...Object.fromEntries(users.map((u) => [u.id, u.name])),
  };
  const vendorItems: Record<string, string> = {
    none: "No vendor",
    ...Object.fromEntries(vendors.map((vd) => [vd.id, vd.name])),
  };

  if (!job) return null;

  async function handleSave() {
    if (!user || !job) return;
    if (!description.trim()) {
      toast.error("Add a work description");
      return;
    }
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    setSaving(true);
    try {
      if (status !== job.status) {
        await maintenanceService.updateStatus(job.id, status, user.id);
      }
      await maintenanceService.update(
        job.id,
        {
          description: description.trim(),
          assignedTo: assignedTo === "none" ? null : assignedTo,
          vendorId: vendorId === "none" ? null : vendorId,
          dueDate: dueDate || null,
          estimatedCost: num(estimatedCost),
          actualCost: num(actualCost),
        },
        user.id,
      );
      toast.success("Job updated");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save job");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-2xl" showCloseButton={false}>
        {/* Header: yellow plate + work + live status */}
        <div className="flex items-start justify-between gap-3 border-b p-5">
          <div className="flex min-w-0 items-center gap-3">
            {vehicle ? (
              <RegPlate registration={vehicle.registration} size="lg" />
            ) : null}
            <div className="min-w-0">
              <DialogTitle className="truncate text-lg">
                {description || "Maintenance job"}
              </DialogTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Job #{job.id.slice(0, 6).toUpperCase()}
                {vehicle ? ` · ${vehicle.make} ${vehicle.model}` : ""}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              STATUS_TONE[status],
            )}
          >
            <CircleDot className="size-3" />
            {statusLabel(status)}
          </span>
        </div>

        {/* Editable property grid */}
        <div className="flex flex-col divide-y divide-border/60 px-5 py-2">
          <Row icon={CircleDot} label="Status">
            <Select
              items={statusItems}
              value={status}
              onValueChange={(v) => setStatus(v as MaintenanceStatus)}
            >
              <SelectTrigger className="h-9 w-full">
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
          </Row>

          <Row icon={UserIcon} label="Owner">
            <Select items={ownerItems} value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({getInitials(u.name)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>

          <Row icon={Wrench} label="Vendor">
            <Select items={vendorItems} value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="No vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No vendor</SelectItem>
                {vendors.map((vd) => (
                  <SelectItem key={vd.id} value={vd.id}>
                    {vd.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>

          <Row icon={CalendarClock} label="Due date">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9"
            />
          </Row>

          <Row icon={PoundSterling} label="Estimated cost">
            <CostInput
              value={estimatedCost}
              onChange={setEstimatedCost}
              placeholder="0.00"
            />
          </Row>

          <Row icon={PoundSterling} label="Actual cost">
            <CostInput
              value={actualCost}
              onChange={setActualCost}
              placeholder="0.00"
            />
          </Row>
        </div>

        {/* Description */}
        <div className="px-5 pb-4">
          <label className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the work…"
            className="mt-1.5 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
