"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Wrench,
  Phone,
  CalendarClock,
  Car,
  User as UserIcon,
  CircleDot,
  PoundSterling,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { workshopService } from "@/lib/services/workshop-service";
import { authService } from "@/lib/services/auth-service";
import type {
  MaintenanceStatus,
  User,
  WorkshopJob,
} from "@/lib/types";
import { MAINTENANCE_STATUSES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { MaintenanceStatusBadge } from "@/components/shared/status-badge";
import { RegPlate } from "@/components/shared/reg-plate";
import { cn, formatCurrency, formatDate, formatTime12, getInitials } from "@/lib/utils";
import { toast } from "@/lib/toast";

const schema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  vehicleReg: z.string().min(2),
  vehicleDescription: z.string().min(1),
  description: z.string().min(1),
  assignedTo: z.string(),
  estimatedCost: z.coerce.number().optional(),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  notes: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const STATUS_DOT: Record<MaintenanceStatus, string> = {
  pending: "bg-amber-500",
  in_progress: "bg-blue-500",
  completed: "bg-emerald-500",
  stalled: "bg-rose-500",
};

export default function WorkshopPage() {
  const { user, company } = useAuth();
  const [jobs, setJobs] = useState<WorkshopJob[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const emptyDefaults = (): FormInput => ({
    customerName: "",
    customerPhone: "",
    vehicleReg: "",
    vehicleDescription: "",
    description: "",
    assignedTo: "none",
    estimatedCost: undefined,
    scheduledDate: new Date().toISOString().slice(0, 10),
    scheduledTime: "10:00",
    notes: "",
  });

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults(),
  });

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      workshopService.getAll(company.id),
      authService.getUsersForCompany(company.id),
    ]).then(([j, u]) => {
      setJobs(j);
      setUsers(u);
    });
  }, [company]);

  function openAdd() {
    setEditingId(null);
    form.reset(emptyDefaults());
    setOpen(true);
  }

  function openEdit(j: WorkshopJob) {
    setEditingId(j.id);
    form.reset({
      customerName: j.customerName,
      customerPhone: j.customerPhone,
      vehicleReg: j.vehicleReg,
      vehicleDescription: j.vehicleDescription,
      description: j.description,
      assignedTo: j.assignedTo ?? "none",
      estimatedCost: j.estimatedCost ?? undefined,
      scheduledDate: j.scheduledDate,
      scheduledTime: j.scheduledTime,
      notes: j.notes ?? "",
    });
    setOpen(true);
  }

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    const payload = {
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      vehicleReg: values.vehicleReg,
      vehicleDescription: values.vehicleDescription,
      description: values.description,
      assignedTo: values.assignedTo === "none" ? null : values.assignedTo,
      estimatedCost: values.estimatedCost ?? null,
      scheduledDate: values.scheduledDate,
      scheduledTime: values.scheduledTime,
      notes: values.notes || null,
    };
    if (editingId) {
      await workshopService.update(editingId, payload);
    } else {
      await workshopService.create({ companyId: company.id, ...payload }, user.id);
    }
    setJobs(await workshopService.getAll(company.id));
    toast.success(editingId ? "Workshop job updated" : "Workshop job created");
    form.reset(emptyDefaults());
    setEditingId(null);
    setOpen(false);
  }

  async function handleStatus(id: string, status: MaintenanceStatus) {
    await workshopService.updateStatus(id, status);
    if (!company) return;
    setJobs(await workshopService.getAll(company.id));
  }

  async function handleDelete(j: WorkshopJob) {
    if (!company) return;
    if (
      !window.confirm(
        `Delete the workshop job for ${j.customerName} (${j.vehicleReg})? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await workshopService.remove(j.id);
      if (selectedId === j.id) setSelectedId(null);
      setJobs(await workshopService.getAll(company.id));
      toast.success("Workshop job deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete job");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workshop</h1>
          <p className="text-sm text-muted-foreground">
            External, walk-in customer service jobs, kept separate from internal
            stock preparation.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setEditingId(null);
              form.reset(emptyDefaults());
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Workshop Job
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Workshop Job" : "Add Workshop Job"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 px-6 pb-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Customer name</Label>
                  <Input {...form.register("customerName")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Customer phone</Label>
                  <Input {...form.register("customerPhone")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Vehicle reg</Label>
                  <Input
                    {...form.register("vehicleReg")}
                    className="uppercase font-mono"
                    placeholder="AB12 CDE"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Vehicle description</Label>
                  <Input
                    {...form.register("vehicleDescription")}
                    placeholder="Vauxhall Corsa 2014"
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Job description</Label>
                  <Input
                    {...form.register("description")}
                    placeholder="AC re-gas + cabin filter"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Assigned to</Label>
                  <Select
                    items={{
                      none: "Unassigned",
                      ...Object.fromEntries(users.map((u) => [u.id, u.name])),
                    }}
                    value={form.watch("assignedTo")}
                    onValueChange={(v) => form.setValue("assignedTo", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Estimated cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register("estimatedCost")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Date</Label>
                  <Input type="date" {...form.register("scheduledDate")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Time</Label>
                  <Input type="time" {...form.register("scheduledTime")} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea {...form.register("notes")} className="min-h-16" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {editingId ? "Save changes" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!jobs ? (
        <Skeleton className="h-64" />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No workshop jobs"
          description="Track customer walk-in service appointments here."
        />
      ) : (
        (() => {
          const selected =
            jobs.find((j) => j.id === selectedId) ?? jobs[0] ?? null;
          return (
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              {/* Job list */}
              <div className="flex flex-col gap-1.5">
                {jobs.map((j) => {
                  const isSel = selected?.id === j.id;
                  return (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => setSelectedId(j.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                        isSel
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40",
                      )}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-2xs font-semibold text-primary">
                        {getInitials(j.customerName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {j.customerName}
                          </span>
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              STATUS_DOT[j.status],
                            )}
                          />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {j.vehicleReg} · {formatTime12(j.scheduledTime)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Booking detail */}
              {selected && (
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {selected.customerName}
                      </h2>
                      {selected.customerPhone ? (
                        <a
                          href={`tel:${selected.customerPhone}`}
                          className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
                        >
                          <Phone className="size-3.5" />
                          {selected.customerPhone}
                        </a>
                      ) : (
                        <span className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="size-3.5" />
                          Walk-in
                        </span>
                      )}
                    </div>
                    <Select
                      value={selected.status}
                      onValueChange={(v) =>
                        void handleStatus(selected.id, v as MaintenanceStatus)
                      }
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <MaintenanceStatusBadge status={selected.status} />
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field icon={Car} label="Vehicle">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <RegPlate registration={selected.vehicleReg} size="sm" />
                        <span className="text-muted-foreground">
                          {selected.vehicleDescription}
                        </span>
                      </span>
                    </Field>
                    <Field icon={CalendarClock} label="Scheduled">
                      {formatDate(selected.scheduledDate)} ·{" "}
                      {formatTime12(selected.scheduledTime)}
                    </Field>
                    <Field icon={UserIcon} label="Assigned to">
                      {users.find((u) => u.id === selected.assignedTo)?.name ??
                        "Unassigned"}
                    </Field>
                    <Field icon={PoundSterling} label="Cost">
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(
                          selected.actualCost ?? selected.estimatedCost,
                        )}
                      </span>
                    </Field>
                    <div className="sm:col-span-2">
                      <Field icon={CircleDot} label="Job">
                        {selected.description}
                      </Field>
                    </div>
                    {selected.notes ? (
                      <div className="sm:col-span-2">
                        <Field icon={Wrench} label="Notes">
                          <span className="whitespace-pre-wrap">
                            {selected.notes}
                          </span>
                        </Field>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
                    <Button
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void handleDelete(selected)}
                    >
                      Delete
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => openEdit(selected)}>
                        Edit
                      </Button>
                      <Button
                        onClick={() =>
                          void handleStatus(selected.id, "completed")
                        }
                        disabled={selected.status === "completed"}
                      >
                        Mark complete
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}

/** One labelled detail cell in the booking panel. */
function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
