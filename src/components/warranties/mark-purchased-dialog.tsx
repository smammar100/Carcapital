"use client";

import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";
import { warrantyService } from "@/lib/services/warranty-service";
import { teamService } from "@/lib/services/team-service";
import type { User, Warranty } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

const schema = z.object({
  purchaseDate: z.string().min(1),
  purchasedBy: z.string().min(1, "Required"),
  providerReference: z.string().optional(),
  amountPaid: z.coerce.number().min(0),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface MarkPurchasedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warranty: Warranty | null;
  onMarked?: () => void;
}

export function MarkPurchasedDialog({
  open,
  onOpenChange,
  warranty,
  onMarked,
}: MarkPurchasedDialogProps) {
  const { user, company } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const baseId = useId();
  const purchaseDateId = `${baseId}-purchase-date`;
  const purchasedById = `${baseId}-purchased-by`;
  const providerReferenceId = `${baseId}-provider-reference`;
  const amountPaidId = `${baseId}-amount-paid`;
  const notesId = `${baseId}-notes`;

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      purchaseDate: new Date().toISOString().slice(0, 10),
      purchasedBy: "",
      providerReference: "",
      amountPaid: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open || !warranty || !user) return;
    form.reset({
      purchaseDate: new Date().toISOString().slice(0, 10),
      purchasedBy: user.id,
      providerReference: warranty.providerReference ?? "",
      amountPaid: warranty.costToDealership,
      notes: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, warranty?.id]);

  useEffect(() => {
    if (!company || !open) return;
    void teamService.getAll(company.id).then(setUsers);
  }, [company, open]);

  async function onSubmit(values: FormOutput) {
    if (!warranty) return;
    try {
      await warrantyService.markPurchased(warranty.id, {
        purchaseDate: values.purchaseDate,
        purchasedBy: values.purchasedBy,
        providerReference: values.providerReference || null,
        amountPaid: values.amountPaid,
        notes: values.notes,
      });
      toast.success("Warranty marked as purchased");
      onOpenChange(false);
      onMarked?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark purchased");
    }
  }

  if (!warranty) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark warranty as purchased</DialogTitle>
          <DialogDescription>
            {warranty.provider ?? "External"} cover for {warranty.customerName}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 px-6"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={purchaseDateId}>Purchase date</Label>
            <Input
              id={purchaseDateId}
              type="date"
              {...form.register("purchaseDate")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={purchasedById}>Paid by</Label>
            <Select
              items={Object.fromEntries(users.map((u) => [u.id, u.name]))}
              value={form.watch("purchasedBy")}
              onValueChange={(v) =>
                form.setValue("purchasedBy", v, { shouldValidate: true })
              }
            >
              <SelectTrigger id={purchasedById}>
                <SelectValue placeholder="Pick a team member" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.purchasedBy && (
              <p className="text-xs text-destructive">
                {form.formState.errors.purchasedBy.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={providerReferenceId}>Provider reference (optional)</Label>
            <Input
              id={providerReferenceId}
              {...form.register("providerReference")}
              placeholder="Policy / quote no."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={amountPaidId}>Amount paid (£)</Label>
            <Input
              id={amountPaidId}
              type="number"
              step="0.01"
              {...form.register("amountPaid")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={notesId}>Notes (optional)</Label>
            <Textarea
              id={notesId}
              {...form.register("notes")}
              className="min-h-16"
            />
          </div>

          <DialogFooter className="-mx-6 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Mark purchased"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
