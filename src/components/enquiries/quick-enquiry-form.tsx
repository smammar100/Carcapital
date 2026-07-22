"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { enquiryService } from "@/lib/services/enquiry-service";
import type { Customer, EnquiryType, UUID } from "@/lib/types";
import { notify } from "@/lib/toast";
import { isValidUkMobile } from "@/lib/formatters";
import { SourceDropdown } from "./source-dropdown";
import { SalespersonDropdown } from "./salesperson-dropdown";
import { EnquiryTypeDropdown } from "./enquiry-type-dropdown";
import type { EnquirySourceValue } from "@/lib/enquiry-constants";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    mobilePhone: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .or(z.literal(""))
      .optional(),
    source: z.string().min(1, "Source is required"),
    salespersonId: z.string().uuid("Pick a salesperson"),
    type: z.string().min(1, "Type is required"),
    notes: z.string().optional(),
  })
  .refine(
    (v) => (v.mobilePhone && v.mobilePhone.length > 0) || (v.email && v.email.length > 0),
    {
      message: "At least one of mobile or email is required",
      path: ["mobilePhone"],
    },
  )
  .refine((v) => !v.mobilePhone || isValidUkMobile(v.mobilePhone), {
    message: "Enter a valid UK mobile (e.g. 07712 345678)",
    path: ["mobilePhone"],
  });

type FormValues = z.infer<typeof schema>;

interface QuickEnquiryFormProps {
  selectedCustomer: Customer | null;
  vehicleId: UUID | null;
  vehicleLabel: string | null;
  onComplete: () => void;
  onBack: () => void;
}

/**
 * The ~30-second fast path. 7 fields, no wizard. When an existing
 * customer is pre-selected, name + mobile + email pre-fill but remain
 * editable (no read-only lock — sometimes details have changed since
 * the customer was last entered).
 */
export function QuickEnquiryForm({
  selectedCustomer,
  vehicleId,
  vehicleLabel,
  onComplete,
  onBack,
}: QuickEnquiryFormProps) {
  const { user, company } = useAuth();

  const defaults: FormValues = useMemo(
    () => ({
      firstName: selectedCustomer?.firstName ?? "",
      lastName: selectedCustomer?.lastName ?? "",
      mobilePhone: selectedCustomer?.mobilePhone ?? "",
      email: selectedCustomer?.email ?? "",
      source: "",
      salespersonId: user?.id ?? "",
      type: "",
      notes: "",
    }),
    [selectedCustomer, user?.id],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const errors = form.formState.errors;

  async function onSubmit(values: FormValues) {
    if (!user || !company) return;
    try {
      const result = await enquiryService.createEnquiryWithCustomer({
        companyId: company.id,
        customer: selectedCustomer
          ? { existingId: selectedCustomer.id }
          : {
              newData: {
                firstName: values.firstName,
                lastName: values.lastName,
                mobilePhone: values.mobilePhone || null,
                email: values.email || null,
              },
            },
        enquiry: {
          vehicleId,
          source: values.source,
          type: values.type as EnquiryType,
          salespersonId: values.salespersonId,
          notes: values.notes || null,
        },
        actorId: user.id,
      });
      const verb = result.wasNewCustomer ? "Created new customer + enquiry" : "Added enquiry";
      notify.success(`${verb} for ${result.customer.firstName} ${result.customer.lastName}`);
      onComplete();
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Failed to save enquiry, try again",
      );
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        {selectedCustomer && (
          <div className="flex items-center justify-between rounded-md bg-primary/5 px-3 py-2 text-sm">
            <span>
              <span className="text-muted-foreground">Customer: </span>
              <span className="font-medium">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </span>
            </span>
            <Badge variant="outline" className="text-xs">
              Existing
            </Badge>
          </div>
        )}

        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-sm font-semibold">Customer</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>First name</Label>
              <Input
                {...form.register("firstName")}
                aria-invalid={!!errors.firstName}
                className={cn(errors.firstName && "border-destructive")}
              />
              {errors.firstName?.message && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                {...form.register("lastName")}
                aria-invalid={!!errors.lastName}
                className={cn(errors.lastName && "border-destructive")}
              />
              {errors.lastName?.message && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
            <div>
              <Label>Mobile</Label>
              <Input
                inputMode="tel"
                placeholder="07…"
                {...form.register("mobilePhone")}
                aria-invalid={!!errors.mobilePhone}
                className={cn(errors.mobilePhone && "border-destructive")}
              />
              {errors.mobilePhone?.message && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.mobilePhone.message}
                </p>
              )}
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                {...form.register("email")}
                aria-invalid={!!errors.email}
                className={cn(errors.email && "border-destructive")}
              />
              {errors.email?.message && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-sm font-semibold">Enquiry</h3>
          {vehicleLabel && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Vehicle: </span>
              <span className="font-medium">{vehicleLabel}</span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Source</Label>
              <SourceDropdown
                value={(form.watch("source") as EnquirySourceValue) ?? ""}
                onChange={(v) =>
                  form.setValue("source", v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                invalid={!!errors.source}
              />
              {errors.source?.message && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.source.message}
                </p>
              )}
            </div>
            <div>
              <Label>Salesperson</Label>
              <SalespersonDropdown
                value={form.watch("salespersonId") ?? ""}
                onChange={(v) =>
                  form.setValue("salespersonId", v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                invalid={!!errors.salespersonId}
              />
              {errors.salespersonId?.message && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.salespersonId.message}
                </p>
              )}
            </div>
            <div>
              <Label>Type</Label>
              <EnquiryTypeDropdown
                value={(form.watch("type") as EnquiryType) ?? ""}
                onChange={(v) =>
                  form.setValue("type", v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                invalid={!!errors.type}
              />
              {errors.type?.message && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.type.message}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label>Notes (optional)</Label>
              <Textarea
                {...form.register("notes")}
                placeholder="Anything we should remember next time we speak…"
                className="min-h-20"
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {form.formState.isSubmitting ? "Saving…" : "Save enquiry"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
