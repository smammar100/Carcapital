"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isValidUkPhone } from "@/lib/formatters";
import { toast } from "@/lib/toast";
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
  Combobox,
  ComboboxInput,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";

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
    customerPhone: z
      .string()
      .min(1, "Required")
      .refine(isValidUkPhone, { message: "Enter a valid UK phone number (e.g. 07712 345678 or 020 7946 0958)" }),
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
          <DialogTitle>
            New {type === "external" ? "external" : "in-house"} warranty
          </DialogTitle>
          <DialogDescription>
            {type === "external"
              ? "Record a third-party warranty bought from a provider and sold with the vehicle."
              : "Issue a warranty Car Capital provides to the buyer directly."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 px-6"
        >
          {/* Vehicle & customer */}
          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-sm font-semibold">Vehicle &amp; customer</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Vehicle</Label>
                <Combobox
                  items={vehicles}
                  value={selectedVehicle}
                  onValueChange={(v: Vehicle | null) =>
                    form.setValue("vehicleId", v?.id ?? "", {
                      shouldValidate: true,
                    })
                  }
                  itemToStringLabel={(v: Vehicle) =>
                    `${v.registration} — ${v.make} ${v.model}`
                  }
                >
                  <ComboboxInput
                    placeholder="Pick a vehicle in stock"
                    startAddon={<Search />}
                    className="w-full"
                  />
                  <ComboboxPopup>
                    <ComboboxEmpty>No vehicles match.</ComboboxEmpty>
                    <ComboboxList>
                      {(v: Vehicle) => (
                        <ComboboxItem key={v.id} value={v}>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {v.registration} — {v.make} {v.model}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {v.stockId} · {v.status}
                            </span>
                          </div>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxPopup>
                </Combobox>
                {form.formState.errors.vehicleId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.vehicleId.message}
                  </p>
                )}
                {selectedVehicle && (
                  <p className="text-xs text-muted-foreground">
                    Stock {selectedVehicle.stockId}
                  </p>
                )}
              </div>
              <Field label="Email" error={form.formState.errors.customerEmail?.message}>
                <Input type="email" {...form.register("customerEmail")} />
              </Field>
              <Field label="Customer name" error={form.formState.errors.customerName?.message}>
                <Input {...form.register("customerName")} />
              </Field>
              <Field label="Phone" error={form.formState.errors.customerPhone?.message}>
                <Input {...form.register("customerPhone")} />
              </Field>
            </div>
          </Card>

          {/* 3. Provider (external only) */}
          {type === "external" && (
            <Card className="flex flex-col gap-3 p-4">
              <h3 className="text-sm font-semibold">Provider</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
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
                    <p className="text-xs text-destructive">
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
              <div className="flex flex-col gap-1.5">
                <Label>Duration</Label>
                <Select
                  items={Object.fromEntries(
                    DURATIONS.map((d) => [d.value, d.label]),
                  )}
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
            </div>
            {/* Kept outside the grid: a field-sizing textarea inside a grid
                track gets sized at its min-height, then its content overflows
                the card. As a plain flex child it sizes correctly. */}
            <Field label="Coverage details" error={form.formState.errors.coverageDetails?.message}>
              <Textarea
                {...form.register("coverageDetails")}
                className="min-h-20"
              />
            </Field>
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

          {/* -mx-6 cancels the form's px-6 so the footer spans full width and
              its own px-6 lines up flush with the dialog edges, matching the
              header. mt-2 keeps a little breathing room above the divider. */}
          <DialogFooter className="-mx-6 mt-2">
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
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
