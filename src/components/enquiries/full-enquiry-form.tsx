"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { enquiryService } from "@/lib/services/enquiry-service";
import type { Customer, EnquiryType, UUID } from "@/lib/types";
import { notify } from "@/lib/toast";
import { isValidPostcode, isValidUkMobile } from "@/lib/formatters";
import { CustomerProfileFields } from "./customer-profile-fields";
import { EnquiryDetailsFields } from "./enquiry-details-fields";
import { cn } from "@/lib/utils";

const fullSchema = z
  .object({
    // Customer
    title: z.string().optional().nullable(),
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    companyName: z.string().trim().optional(),
    postcode: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || isValidPostcode(v), {
        message: "Enter a valid UK postcode",
      }),
    addressLines: z.array(z.string()),
    homePhone: z.string().trim().optional(),
    mobilePhone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || isValidUkMobile(v), {
        message: "Enter a valid UK mobile (e.g. 07712 345678)",
      }),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .or(z.literal(""))
      .optional(),
    marketingConsent: z.boolean(),
    // Enquiry
    source: z.string().min(1, "Source is required"),
    salespersonId: z.string().uuid("Pick a salesperson"),
    type: z.string().min(1, "Type is required"),
    financeInterest: z.boolean(),
    nextActionDueAt: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (v) => (v.mobilePhone && v.mobilePhone.length > 0) || (v.email && v.email.length > 0),
    {
      message: "At least one of mobile or email is required",
      path: ["mobilePhone"],
    },
  );

type FormValues = z.infer<typeof fullSchema>;

interface FullEnquiryFormProps {
  selectedCustomer: Customer | null;
  vehicleId: UUID | null;
  vehicleLabel: string | null;
  /** Defaults: source unset, type unset. Lets callers seed common values later. */
  onComplete: () => void;
  onBack: () => void;
}

/**
 * The ~2-minute thorough path. Two-step wizard:
 *   Step 1 — customer profile (skipped if an existing customer is pre-selected)
 *   Step 2 — enquiry details
 *
 * If an existing customer is selected, the form fast-forwards to Step 2
 * and the underlying form values for the customer half are pre-filled
 * with the existing record (but won't be sent — `createEnquiryWithCustomer`
 * gets `{ existingId }` instead).
 */
export function FullEnquiryForm({
  selectedCustomer,
  vehicleId,
  vehicleLabel,
  onComplete,
  onBack,
}: FullEnquiryFormProps) {
  const { user, company } = useAuth();
  const initialStep: 1 | 2 = selectedCustomer ? 2 : 1;
  const [step, setStep] = useState<1 | 2>(initialStep);

  const defaults: FormValues = useMemo(
    () => ({
      title: selectedCustomer?.title ?? "",
      firstName: selectedCustomer?.firstName ?? "",
      lastName: selectedCustomer?.lastName ?? "",
      companyName: selectedCustomer?.companyName ?? "",
      postcode: selectedCustomer?.postcode ?? "",
      addressLines: selectedCustomer?.addressLines ?? [],
      homePhone: selectedCustomer?.homePhone ?? "",
      mobilePhone: selectedCustomer?.mobilePhone ?? "",
      email: selectedCustomer?.email ?? "",
      marketingConsent: selectedCustomer?.marketingConsent ?? true,
      source: "",
      salespersonId: user?.id ?? "",
      type: "",
      financeInterest: false,
      nextActionDueAt: "",
      notes: "",
    }),
    [selectedCustomer, user?.id],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });

  async function handleNext() {
    // Validate only the customer half before advancing to step 2.
    const ok = await form.trigger([
      "firstName",
      "lastName",
      "postcode",
      "mobilePhone",
      "email",
    ]);
    if (!ok) {
      notify.warning("Fix the highlighted fields before continuing");
      return;
    }
    setStep(2);
  }

  async function onSubmit(values: FormValues) {
    if (!user || !company) return;
    try {
      const result = await enquiryService.createEnquiryWithCustomer({
        companyId: company.id,
        customer: selectedCustomer
          ? { existingId: selectedCustomer.id }
          : {
              newData: {
                title: values.title || null,
                firstName: values.firstName,
                lastName: values.lastName,
                companyName: values.companyName || null,
                email: values.email || null,
                homePhone: values.homePhone || null,
                mobilePhone: values.mobilePhone || null,
                postcode: values.postcode || null,
                addressLines: values.addressLines.filter((l) => l.trim().length > 0),
                marketingConsent: values.marketingConsent,
              },
            },
        enquiry: {
          vehicleId,
          source: values.source,
          type: values.type as EnquiryType,
          salespersonId: values.salespersonId,
          financeInterest: values.financeInterest,
          nextActionDueAt: values.nextActionDueAt
            ? new Date(values.nextActionDueAt).toISOString()
            : null,
          notes: values.notes || null,
        },
        actorId: user.id,
      });
      const verb = result.wasNewCustomer
        ? "Created new customer + enquiry"
        : "Added enquiry";
      notify.success(
        `${verb} for ${result.customer.firstName} ${result.customer.lastName}`,
      );
      onComplete();
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Failed to save enquiry — try again",
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

        {/* Step indicator (only shows if 2 steps are in play) */}
        {!selectedCustomer && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <StepPill active={step === 1} done={step > 1} label="1. Customer" />
            <div className="h-px flex-1 bg-border" />
            <StepPill active={step === 2} done={false} label="2. Enquiry" />
          </div>
        )}

        {step === 1 && !selectedCustomer && (
          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-sm font-semibold">Customer profile</h3>
            <CustomerProfileFields />
          </Card>
        )}

        {step === 2 && (
          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-sm font-semibold">Enquiry details</h3>
            <EnquiryDetailsFields vehicleLabel={vehicleLabel} />
          </Card>
        )}

        <div className="flex items-center justify-between gap-2">
          {step === 1 ? (
            <Button type="button" variant="ghost" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => (selectedCustomer ? onBack() : setStep(1))}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              {selectedCustomer ? "Back" : "Previous"}
            </Button>
          )}

          {step === 1 ? (
            <Button type="button" onClick={handleNext}>
              Next
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {form.formState.isSubmitting ? "Saving…" : "Save enquiry"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

function StepPill({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5",
        active && "border-primary bg-primary/10 text-foreground",
        done && "border-emerald-300 bg-emerald-50 text-emerald-700",
      )}
    >
      {label}
    </span>
  );
}
