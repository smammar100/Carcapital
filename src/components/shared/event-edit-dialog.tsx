"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appointmentService } from "@/lib/services/appointment-service";
import { workshopService } from "@/lib/services/workshop-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import type {
  Appointment,
  MaintenanceJob,
  Vehicle,
  WorkshopJob,
} from "@/lib/types";

// ============================================================
// Schemas (one per kind)
// ============================================================

const apptSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle required"),
  customerName: z.string().min(1, "Customer name required"),
  customerPhone: z.string().min(1, "Phone required"),
  customerEmail: z.string().min(1, "Email required"),
  date: z.string().min(1),
  time: z.string().min(1),
  specialRequirements: z.string().optional(),
});
type ApptForm = z.input<typeof apptSchema>;
type ApptOut = z.output<typeof apptSchema>;

const workshopSchema = z.object({
  customerName: z.string().min(1, "Customer name required"),
  customerPhone: z.string().min(1, "Phone required"),
  vehicleReg: z.string().min(1, "Registration required"),
  vehicleDescription: z.string().min(1, "Vehicle description required"),
  description: z.string().min(1, "Job description required"),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  notes: z.string().optional(),
});
type WorkshopForm = z.input<typeof workshopSchema>;
type WorkshopOut = z.output<typeof workshopSchema>;

const maintSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle required"),
  description: z.string().min(1, "Description required"),
  dueDate: z.string().min(1, "Due date required"),
  estimatedDurationHours: z.string().optional(),
  notes: z.string().optional(),
});
type MaintForm = z.input<typeof maintSchema>;
type MaintOut = z.output<typeof maintSchema>;

// ============================================================
// Discriminated props
// ============================================================

type CommonProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  userId: string;
  /** Called after a successful save so the parent can refetch + refresh. */
  onSaved: () => void;
};

type Props =
  | (CommonProps & { kind: "appointment"; entity: Appointment })
  | (CommonProps & { kind: "workshop"; entity: WorkshopJob })
  | (CommonProps & { kind: "maintenance"; entity: MaintenanceJob });

// ============================================================
// Component
// ============================================================

export function EventEditDialog(props: Props) {
  const { open, onOpenChange, kind } = props;
  const titleByKind: Record<Props["kind"], string> = {
    appointment: "Edit Appointment",
    workshop: "Edit Workshop Job",
    maintenance: "Edit Maintenance Job",
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titleByKind[kind]}</DialogTitle>
        </DialogHeader>
        {kind === "appointment" ? (
          <AppointmentEditForm {...props} />
        ) : kind === "workshop" ? (
          <WorkshopEditForm {...props} />
        ) : (
          <MaintenanceEditForm {...props} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Per-kind forms
// ============================================================

function AppointmentEditForm(
  props: Extract<Props, { kind: "appointment" }>,
) {
  const { entity, vehicles, userId, onSaved, onOpenChange } = props;
  const form = useForm<ApptForm, unknown, ApptOut>({
    resolver: zodResolver(apptSchema),
    defaultValues: {
      vehicleId: entity.vehicleId,
      customerName: entity.customerName,
      customerPhone: entity.customerPhone,
      customerEmail: entity.customerEmail,
      date: entity.date,
      time: entity.time,
      specialRequirements: entity.specialRequirements ?? "",
    },
  });
  useEffect(() => {
    form.reset({
      vehicleId: entity.vehicleId,
      customerName: entity.customerName,
      customerPhone: entity.customerPhone,
      customerEmail: entity.customerEmail,
      date: entity.date,
      time: entity.time,
      specialRequirements: entity.specialRequirements ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id]);

  async function onSubmit(values: ApptOut) {
    await appointmentService.update(
      entity.id,
      {
        vehicleId: values.vehicleId,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail,
        date: values.date,
        time: values.time,
        specialRequirements: values.specialRequirements || null,
      },
      userId,
    );
    toast.success("Appointment updated");
    onSaved();
    onOpenChange(false);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-3"
    >
      <div>
        <Label>Vehicle</Label>
        <Select
          value={form.watch("vehicleId")}
          onValueChange={(v) => form.setValue("vehicleId", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a vehicle" />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.registration} — {v.make} {v.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Customer name</Label>
          <Input {...form.register("customerName")} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input {...form.register("customerPhone")} />
        </div>
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" {...form.register("customerEmail")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Date</Label>
          <Input type="date" {...form.register("date")} />
        </div>
        <div>
          <Label>Time</Label>
          <Input type="time" {...form.register("time")} />
        </div>
      </div>
      <div>
        <Label>Special requirements</Label>
        <Input {...form.register("specialRequirements")} />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}

function WorkshopEditForm(props: Extract<Props, { kind: "workshop" }>) {
  const { entity, onSaved, onOpenChange } = props;
  const form = useForm<WorkshopForm, unknown, WorkshopOut>({
    resolver: zodResolver(workshopSchema),
    defaultValues: {
      customerName: entity.customerName,
      customerPhone: entity.customerPhone,
      vehicleReg: entity.vehicleReg,
      vehicleDescription: entity.vehicleDescription,
      description: entity.description,
      scheduledDate: entity.scheduledDate,
      scheduledTime: entity.scheduledTime,
      notes: entity.notes ?? "",
    },
  });
  useEffect(() => {
    form.reset({
      customerName: entity.customerName,
      customerPhone: entity.customerPhone,
      vehicleReg: entity.vehicleReg,
      vehicleDescription: entity.vehicleDescription,
      description: entity.description,
      scheduledDate: entity.scheduledDate,
      scheduledTime: entity.scheduledTime,
      notes: entity.notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id]);

  async function onSubmit(values: WorkshopOut) {
    await workshopService.update(entity.id, {
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      vehicleReg: values.vehicleReg,
      vehicleDescription: values.vehicleDescription,
      description: values.description,
      scheduledDate: values.scheduledDate,
      scheduledTime: values.scheduledTime,
      notes: values.notes || null,
    });
    toast.success("Workshop job updated");
    onSaved();
    onOpenChange(false);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Customer name</Label>
          <Input {...form.register("customerName")} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input {...form.register("customerPhone")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Reg</Label>
          <Input {...form.register("vehicleReg")} />
        </div>
        <div>
          <Label>Vehicle</Label>
          <Input {...form.register("vehicleDescription")} />
        </div>
      </div>
      <div>
        <Label>Job description</Label>
        <Input {...form.register("description")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Date</Label>
          <Input type="date" {...form.register("scheduledDate")} />
        </div>
        <div>
          <Label>Time</Label>
          <Input type="time" {...form.register("scheduledTime")} />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Input {...form.register("notes")} />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}

function MaintenanceEditForm(
  props: Extract<Props, { kind: "maintenance" }>,
) {
  const { entity, vehicles, userId, onSaved, onOpenChange } = props;
  const form = useForm<MaintForm, unknown, MaintOut>({
    resolver: zodResolver(maintSchema),
    defaultValues: {
      vehicleId: entity.vehicleId,
      description: entity.description,
      dueDate: entity.dueDate ?? "",
      estimatedDurationHours: entity.estimatedDurationHours
        ? String(entity.estimatedDurationHours)
        : "",
      notes: entity.notes ?? "",
    },
  });
  useEffect(() => {
    form.reset({
      vehicleId: entity.vehicleId,
      description: entity.description,
      dueDate: entity.dueDate ?? "",
      estimatedDurationHours: entity.estimatedDurationHours
        ? String(entity.estimatedDurationHours)
        : "",
      notes: entity.notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id]);

  async function onSubmit(values: MaintOut) {
    const hours = values.estimatedDurationHours
      ? Number(values.estimatedDurationHours)
      : null;
    await maintenanceService.update(
      entity.id,
      {
        vehicleId: values.vehicleId,
        description: values.description,
        dueDate: values.dueDate,
        estimatedDurationHours:
          hours !== null && Number.isFinite(hours) ? hours : null,
        notes: values.notes || null,
      },
      userId,
    );
    toast.success("Maintenance job updated");
    onSaved();
    onOpenChange(false);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-3"
    >
      <div>
        <Label>Vehicle</Label>
        <Select
          value={form.watch("vehicleId")}
          onValueChange={(v) => form.setValue("vehicleId", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a vehicle" />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.registration} — {v.make} {v.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Description</Label>
        <Input {...form.register("description")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Due date</Label>
          <Input type="date" {...form.register("dueDate")} />
        </div>
        <div>
          <Label>Estimated hours</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            {...form.register("estimatedDurationHours")}
          />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Input {...form.register("notes")} />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}
