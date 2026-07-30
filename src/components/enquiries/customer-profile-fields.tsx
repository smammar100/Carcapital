"use client";

import { useId } from "react";
import { useFormContext, type FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PostcodeLookupField } from "./postcode-lookup-field";
import { cn } from "@/lib/utils";

/**
 * Reusable customer-profile fieldset. Embedded inside:
 *   - `FullEnquiryForm` Step 1 (always)
 *   - the "Edit customer" affordance from the Quick form (future)
 *
 * Field names match the `Customer` shape so the parent form's submit
 * handler can pass `getValues()` straight to `findOrCreateCustomer`.
 *
 * Uses `useFormContext` so it stays decoupled from the parent form's
 * full schema — the parent just has to wrap its form in shadcn's
 * `<Form>` (which is `FormProvider`).
 */
interface CustomerProfileFieldsProps {
  /** Set when an existing customer is selected — switches inputs to a "read with edit" feel. */
  readonly?: boolean;
}

const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Mx", "Dr"] as const;

export function CustomerProfileFields({ readonly }: CustomerProfileFieldsProps) {
  const form = useFormContext<FieldValues>();
  const errors = form.formState.errors;
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const firstNameId = `${baseId}-first-name`;
  const lastNameId = `${baseId}-last-name`;
  const companyNameId = `${baseId}-company-name`;
  const mobileId = `${baseId}-mobile`;
  const homePhoneId = `${baseId}-home-phone`;
  const emailId = `${baseId}-email`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <Label htmlFor={titleId}>Title</Label>
          <Select
            value={(form.watch("title") as string) ?? ""}
            onValueChange={(v) =>
              form.setValue("title", v, { shouldDirty: true })
            }
            disabled={readonly}
          >
            <SelectTrigger id={titleId}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {TITLES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={firstNameId}>First name</Label>
          <Input
            id={firstNameId}
            {...form.register("firstName")}
            readOnly={readonly}
            aria-invalid={!!errors.firstName}
            className={cn(errors.firstName && "border-destructive")}
          />
          {errors.firstName?.message && (
            <p className="mt-1 text-xs text-destructive">
              {String(errors.firstName.message)}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={lastNameId}>Last name</Label>
          <Input
            id={lastNameId}
            {...form.register("lastName")}
            readOnly={readonly}
            aria-invalid={!!errors.lastName}
            className={cn(errors.lastName && "border-destructive")}
          />
          {errors.lastName?.message && (
            <p className="mt-1 text-xs text-destructive">
              {String(errors.lastName.message)}
            </p>
          )}
        </div>
        <div className="sm:col-span-6">
          <Label htmlFor={companyNameId}>Company name (optional, B2B / trade)</Label>
          <Input id={companyNameId} {...form.register("companyName")} readOnly={readonly} />
        </div>
      </div>

      {/* Postcode + address */}
      <PostcodeLookupField
        postcode={(form.watch("postcode") as string) ?? ""}
        onPostcodeChange={(v) =>
          form.setValue("postcode", v, { shouldDirty: true, shouldValidate: true })
        }
        addressLines={(form.watch("addressLines") as string[]) ?? []}
        onAddressLinesChange={(lines) =>
          form.setValue("addressLines", lines, { shouldDirty: true })
        }
        postcodeError={
          typeof errors.postcode?.message === "string"
            ? errors.postcode.message
            : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={mobileId}>Mobile</Label>
          <Input
            id={mobileId}
            {...form.register("mobilePhone")}
            placeholder="07…"
            inputMode="tel"
            aria-invalid={!!errors.mobilePhone}
            className={cn(errors.mobilePhone && "border-destructive")}
          />
          {errors.mobilePhone?.message && (
            <p className="mt-1 text-xs text-destructive">
              {String(errors.mobilePhone.message)}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor={homePhoneId}>Home phone (optional)</Label>
          <Input id={homePhoneId} {...form.register("homePhone")} inputMode="tel" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={emailId}>Email</Label>
          <Input
            id={emailId}
            type="email"
            {...form.register("email")}
            aria-invalid={!!errors.email}
            className={cn(errors.email && "border-destructive")}
          />
          {errors.email?.message && (
            <p className="mt-1 text-xs text-destructive">
              {String(errors.email.message)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
        <div>
          <Label htmlFor="marketingConsent" className="cursor-pointer">
            Marketing consent
          </Label>
          <p className="text-xs text-muted-foreground">
            Customer has agreed to receive marketing emails &amp; SMS.
          </p>
        </div>
        <Switch
          id="marketingConsent"
          checked={!!form.watch("marketingConsent")}
          onCheckedChange={(v) =>
            form.setValue("marketingConsent", v, { shouldDirty: true })
          }
        />
      </div>
    </div>
  );
}
