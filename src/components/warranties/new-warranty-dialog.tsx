"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, ExternalLink, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { warrantyService } from "@/lib/services/warranty-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle, WarrantyType } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  "Warranty First",
  "AA Warranty",
  "RAC Warranty",
  "MotorEasy",
  "Other",
] as const;

const DURATIONS = [
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "24", label: "24 months" },
  { value: "36", label: "36 months" },
  { value: "custom", label: "Custom" },
] as const;

const schema = z
  .object({
    type: z.enum(["in_house", "external"]),
    vehicleId: z.string().min(1, "Pick a vehicle"),
    customerName: z.string().min(1, "Required"),
    customerPhone: z.string().min(1, "Required"),
    customerEmail: z.string().email().or(z.literal("")),
    provider: z.string().optional(),
    providerReference: z.string().optional(),
    durationMonths: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    coverageDetails: z.string().min(1, "Describe the coverage"),
    costToCustomer: z.coerce.number().min(0),
    costToDealership: z.coerce.number().min(0).optional(),
  })
  .refine((v) => v.type === "in_house" || (v.provider && v.provider.length > 0), {
    message: "External warranties need a provider",
    path: ["provider"],
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface NewWarrantyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: WarrantyType;
  onCreated?: () => void;
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

export function NewWarrantyDialog({
  open,
  onOpenChange,
  initialType = "in_house",
  onCreated,
}: NewWarrantyDialogProps) {
  const { user, company } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initialType,
      vehicleId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      provider: "",
      providerReference: "",
      durationMonths: "3",
      startDate: todayIso,
      endDate: addMonths(todayIso, 3),
      coverageDetails: "3-month engine and gearbox cover",
      costToCustomer: 0,
      costToDealership: 0,
    },
  });

  useEffect(() => {
    if (open) form.reset({ ...form.getValues(), type: initialType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType]);

  useEffect(() => {
    if (!company || !open) return;
    void vehicleService.getAll(company.id).then((all) => {
      setVehicles(
        all.filter((v) => ["ready", "listed", "sold"].includes(v.status)),
      );
    });
  }, [company, open]);

  const type = form.watch("type");
  const duration = form.watch("durationMonths");
  const startDate = form.watch("startDate");
  const vehicleId = form.watch("vehicleId");

  // Auto-recalc end date when duration or start date changes (unless custom).
  useEffect(() => {
    if (duration === "custom" || !startDate) return;
    const months = parseInt(duration, 10);
    form.setValue("endDate", addMonths(startDate, months), { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, startDate]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId) ?? null,
    [vehicles, vehicleId],
  );

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    try {
      await warrantyService.create(
        {
          companyId: company.id,
          vehicleId: values.vehicleId,
          saleDealId: null,
          customerName: values.customerName,
          customerPhone: values.customerPhone,
          customerEmail: values.customerEmail || null,
          type: values.type,
          provider:
            values.type === "external" ? values.provider ?? null : null,
          coverageDetails: values.coverageDetails,
          startDate: values.startDate,
          endDate: values.endDate,
          costToDealership:
            values.type === "external" ? values.costToDealership ?? 0 : 0,
          costToCustomer: values.costToCustomer,
        },
        user.id,
      );
      toast.success(`Warranty for ${values.customerName} created`);
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create warranty");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New warranty</DialogTitle>
          <DialogDescription>
            Issue an in-house warranty or record a third-party warranty sold
            with the vehicle.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {/* 1. Type selector — two card-style options */}
          <div className="grid gap-2 sm:grid-cols-2">
            <TypeCard
              active={type === "in_house"}
              icon={Shield}
              title="In-house"
              description="Car Capital provides the cover directly."
              onClick={() => form.setValue("type", "in_house")}
            />
            <TypeCard
              active={type === "external"}
              icon={ExternalLink}
              title="External"
              description="Third-party warranty bought from a provider."
              onClick={() => form.setValue("type", "external")}
            />
          </div>

          {/* 2. Vehicle & customer */}
          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-sm font-semibold">Vehicle &amp; customer</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Vehicle</Label>
                <Popover
                  open={vehiclePickerOpen}
                  onOpenChange={setVehiclePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !selectedVehicle && "text-muted-foreground",
                      )}
                    >
                      {selectedVehicle
                        ? `${selectedVehicle.registration} — ${selectedVehicle.make} ${selectedVehicle.model}`
                        : "Pick a vehicle in stock"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search reg, make, model…" />
                      <CommandList>
                        <CommandEmpty>No vehicles match.</CommandEmpty>
                        <CommandGroup>
                          {vehicles.map((v) => (
                            <CommandItem
                              key={v.id}
                              value={`${v.registration} ${v.make} ${v.model} ${v.stockId}`}
                              onSelect={() => {
                                form.setValue("vehicleId", v.id, {
                                  shouldValidate: true,
                                });
                                setVehiclePickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  v.id === vehicleId ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="flex flex-1 flex-col">
                                <span className="text-sm">
                                  {v.registration} — {v.make} {v.model}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {v.stockId} · {v.status}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {form.formState.errors.vehicleId && (
                  <p className="mt-1 text-xs text-destructive">
                    {form.formState.errors.vehicleId.message}
                  </p>
                )}
                {selectedVehicle && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stock {selectedVehicle.stockId}
                  </p>
                )}
              </div>
              <Field label="Customer name" error={form.formState.errors.customerName?.message}>
                <Input {...form.register("customerName")} />
              </Field>
              <Field label="Phone" error={form.formState.errors.customerPhone?.message}>
                <Input {...form.register("customerPhone")} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email" error={form.formState.errors.customerEmail?.message}>
                  <Input type="email" {...form.register("customerEmail")} />
                </Field>
              </div>
            </div>
          </Card>

          {/* 3. Provider (external only) */}
          {type === "external" && (
            <Card className="flex flex-col gap-3 p-4">
              <h3 className="text-sm font-semibold">Provider</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Provider</Label>
                  <Select
                    value={form.watch("provider") ?? ""}
                    onValueChange={(v) =>
                      form.setValue("provider", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.provider && (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.provider.message}
                    </p>
                  )}
                </div>
                <Field label="Provider reference (optional)">
                  <Input
                    {...form.register("providerReference")}
                    placeholder="Policy or quote no."
                  />
                </Field>
              </div>
            </Card>
          )}

          {/* 4. Coverage */}
          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-sm font-semibold">Coverage</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Duration</Label>
                <Select
                  value={form.watch("durationMonths")}
                  onValueChange={(v) =>
                    form.setValue("durationMonths", v, { shouldDirty: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Start date">
                <Input type="date" {...form.register("startDate")} />
              </Field>
              <Field label="End date">
                <Input type="date" {...form.register("endDate")} />
              </Field>
              <div className="sm:col-span-3">
                <Field label="Coverage details" error={form.formState.errors.coverageDetails?.message}>
                  <Textarea
                    {...form.register("coverageDetails")}
                    className="min-h-20"
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* 5. Pricing */}
          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-sm font-semibold">Pricing</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cost to customer (£)">
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("costToCustomer")}
                />
              </Field>
              {type === "external" && (
                <Field label="Cost to dealership (£)">
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register("costToDealership")}
                  />
                </Field>
              )}
            </div>
          </Card>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating…" : "Create warranty"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TypeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            active ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
