"use client";

import { useId } from "react";
import { useFormContext, type FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SourceDropdown } from "./source-dropdown";
import { SalespersonDropdown } from "./salesperson-dropdown";
import { EnquiryTypeDropdown } from "./enquiry-type-dropdown";
import type { EnquirySourceValue } from "@/lib/enquiry-constants";
import type { EnquiryType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EnquiryDetailsFieldsProps {
  /** Read-only display of the vehicle this enquiry attaches to. */
  vehicleLabel?: string | null;
}

/**
 * Reusable enquiry-details fieldset. Embedded inside:
 *   - `FullEnquiryForm` Step 2
 *   - `QuickEnquiryForm` (subset of these fields)
 *
 * Field names: source, salespersonId, type, financeInterest,
 * nextActionDueAt, notes. The parent form is expected to seed
 * `salespersonId` from `useAuth().user.id`.
 */
export function EnquiryDetailsFields({ vehicleLabel }: EnquiryDetailsFieldsProps) {
  const form = useFormContext<FieldValues>();
  const errors = form.formState.errors;
  const baseId = useId();
  const sourceId = `${baseId}-source`;
  const salespersonId = `${baseId}-salesperson`;
  const typeId = `${baseId}-type`;
  const nextActionDueId = `${baseId}-next-action-due`;
  const notesId = `${baseId}-notes`;

  return (
    <div className="flex flex-col gap-4">
      {vehicleLabel && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Vehicle of interest: </span>
          <span className="font-medium">{vehicleLabel}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={sourceId}>Source</Label>
          <SourceDropdown
            id={sourceId}
            value={(form.watch("source") as EnquirySourceValue) ?? ""}
            onChange={(v) =>
              form.setValue("source", v, { shouldValidate: true, shouldDirty: true })
            }
            invalid={!!errors.source}
          />
          {errors.source?.message && (
            <p className="mt-1 text-xs text-destructive">
              {String(errors.source.message)}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor={salespersonId}>Salesperson</Label>
          <SalespersonDropdown
            id={salespersonId}
            value={(form.watch("salespersonId") as string) ?? ""}
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
              {String(errors.salespersonId.message)}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor={typeId}>Type</Label>
          <EnquiryTypeDropdown
            id={typeId}
            value={(form.watch("type") as EnquiryType) ?? ""}
            onChange={(v) =>
              form.setValue("type", v, { shouldValidate: true, shouldDirty: true })
            }
            invalid={!!errors.type}
          />
          {errors.type?.message && (
            <p className="mt-1 text-xs text-destructive">
              {String(errors.type.message)}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor={nextActionDueId}>Next action due (optional)</Label>
          <Input
            id={nextActionDueId}
            type="datetime-local"
            {...form.register("nextActionDueAt")}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
        <div>
          <Label htmlFor="financeInterest" className="cursor-pointer">
            Interested in finance
          </Label>
          <p className="text-xs text-muted-foreground">
            Flag this enquiry for the finance team's follow-up queue.
          </p>
        </div>
        <Switch
          id="financeInterest"
          checked={!!form.watch("financeInterest")}
          onCheckedChange={(v) =>
            form.setValue("financeInterest", v, { shouldDirty: true })
          }
        />
      </div>

      <div>
        <Label htmlFor={notesId}>Notes (optional)</Label>
        <Textarea
          id={notesId}
          {...form.register("notes")}
          placeholder="Anything we should remember next time we speak…"
          className={cn("min-h-20", errors.notes && "border-destructive")}
        />
      </div>
    </div>
  );
}
