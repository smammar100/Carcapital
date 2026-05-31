"use client";

import { useEffect, useState } from "react";
import { Plus, Wrench } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { MaintenanceStatusBadge } from "@/components/shared/status-badge";
import { RegPlate } from "@/components/shared/reg-plate";
import { formatCurrency, formatDate, formatTime12 } from "@/lib/utils";
import { toast } from "sonner";

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

export default function WorkshopPage() {
  const { user, company } = useAuth();
  const [jobs, setJobs] = useState<WorkshopJob[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
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
    },
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

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    await workshopService.create(
      {
        companyId: company.id,
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
      },
      user.id,
    );
    const fresh = await workshopService.getAll(company.id);
    setJobs(fresh);
    toast.success("Workshop job created");
    form.reset();
    setOpen(false);
  }

  async function handleStatus(id: string, status: MaintenanceStatus) {
    await workshopService.updateStatus(id, status);
    if (!company) return;
    setJobs(await workshopService.getAll(company.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workshop</h1>
          <p className="text-sm text-muted-foreground">
            External walk-in service jobs (separate from internal stock prep).
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Add Workshop Job
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Workshop Job</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div>
                <Label>Customer name</Label>
                <Input {...form.register("customerName")} />
              </div>
              <div>
                <Label>Customer phone</Label>
                <Input {...form.register("customerPhone")} />
              </div>
              <div>
                <Label>Vehicle reg</Label>
                <Input
                  {...form.register("vehicleReg")}
                  className="uppercase font-mono"
                  placeholder="AB12 CDE"
                />
              </div>
              <div>
                <Label>Vehicle description</Label>
                <Input
                  {...form.register("vehicleDescription")}
                  placeholder="Vauxhall Corsa 2014"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Job description</Label>
                <Input
                  {...form.register("description")}
                  placeholder="AC re-gas + cabin filter"
                />
              </div>
              <div>
                <Label>Assigned to</Label>
                <Select
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
              <div>
                <Label>Estimated cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("estimatedCost")}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" {...form.register("scheduledDate")} />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" {...form.register("scheduledTime")} />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea {...form.register("notes")} className="min-h-16" />
              </div>
              <DialogFooter className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  Save
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
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">
                    {j.customerName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {j.customerPhone}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <RegPlate registration={j.vehicleReg} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {j.vehicleDescription}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {j.description}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(j.scheduledDate)} · {formatTime12(j.scheduledTime)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(j.actualCost ?? j.estimatedCost)}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={j.status}
                      onValueChange={(v) =>
                        void handleStatus(j.id, v as MaintenanceStatus)
                      }
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <MaintenanceStatusBadge status={j.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
