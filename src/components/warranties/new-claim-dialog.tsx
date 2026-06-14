"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";
import { claimService } from "@/lib/services/claim-service";
import { warrantyService } from "@/lib/services/warranty-service";
import type { Warranty } from "@/lib/types";
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
import { Switch } from "@/components/ui/switch";
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

const schema = z.object({
  warrantyId: z.string().min(1, "Pick a warranty"),
  issueDescription: z.string().min(5, "Describe the issue"),
  estimatedCost: z.coerce.number().min(0).optional(),
  isComplaint: z.boolean(),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface NewClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the warranty selector is hidden and locked to this id. */
  warrantyId?: string;
  onCreated?: () => void;
}

export function NewClaimDialog({
  open,
  onOpenChange,
  warrantyId,
  onCreated,
}: NewClaimDialogProps) {
  const { user, company } = useAuth();
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      warrantyId: warrantyId ?? "",
      issueDescription: "",
      estimatedCost: 0,
      isComplaint: false,
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        warrantyId: warrantyId ?? "",
        issueDescription: "",
        estimatedCost: 0,
        isComplaint: false,
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, warrantyId]);

  useEffect(() => {
    if (!company || !open) return;
    void warrantyService
      .getByStatus(company.id, ["active"])
      .then(setWarranties);
  }, [company, open]);

  const selectedId = form.watch("warrantyId");
  const isComplaint = form.watch("isComplaint");
  const selected = useMemo(
    () => warranties.find((w) => w.id === selectedId) ?? null,
    [warranties, selectedId],
  );

  async function onSubmit(values: FormOutput) {
    if (!user) return;
    const w = warranties.find((x) => x.id === values.warrantyId);
    if (!w) {
      toast.error("Warranty not found");
      return;
    }
    try {
      await claimService.create(
        {
          warrantyId: values.warrantyId,
          vehicleId: w.vehicleId,
          companyId: w.companyId,
          customerName: w.customerName,
          issueDescription: values.issueDescription,
          isComplaint: values.isComplaint,
          estimatedCost: values.estimatedCost ?? null,
        },
        user.id,
      );
      toast.success("Claim filed");
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to file claim");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>File a claim</DialogTitle>
          <DialogDescription>
            Open a warranty claim against an active warranty.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {!warrantyId && (
            <div>
              <Label>Warranty</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      !selected && "text-muted-foreground",
                    )}
                  >
                    {selected
                      ? `${selected.customerName} · ${selected.type === "external" ? selected.provider : "In-house"}`
                      : "Pick an active warranty"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search customer or provider…" />
                    <CommandList>
                      <CommandEmpty>No active warranties.</CommandEmpty>
                      <CommandGroup>
                        {warranties.map((w) => (
                          <CommandItem
                            key={w.id}
                            value={`${w.customerName} ${w.provider ?? ""} ${w.id}`}
                            onSelect={() => {
                              form.setValue("warrantyId", w.id, {
                                shouldValidate: true,
                              });
                              setPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                w.id === selectedId ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-1 flex-col">
                              <span className="text-sm">{w.customerName}</span>
                              <span className="text-xs text-muted-foreground">
                                {w.type === "external"
                                  ? w.provider
                                  : "In-house"}{" "}
                                · {w.startDate} → {w.endDate}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {form.formState.errors.warrantyId && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.warrantyId.message}
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Issue description</Label>
            <Textarea
              {...form.register("issueDescription")}
              placeholder="What's the customer reporting?"
              className="min-h-24"
            />
            {form.formState.errors.issueDescription && (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.issueDescription.message}
              </p>
            )}
          </div>

          <div>
            <Label>Estimated cost (£)</Label>
            <Input
              type="number"
              step="0.01"
              {...form.register("estimatedCost")}
            />
          </div>

          <Card
            className={cn(
              "flex flex-col gap-2 p-3 transition-colors",
              isComplaint && "border-destructive/50 bg-destructive/5",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-4 w-4",
                    isComplaint ? "text-destructive" : "text-muted-foreground",
                  )}
                />
                <div>
                  <Label className="text-sm font-medium">
                    Flag as customer complaint
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Escalates SLA and flags the claim row red in the claims
                    list.
                  </p>
                </div>
              </div>
              <Switch
                checked={isComplaint}
                onCheckedChange={(v) =>
                  form.setValue("isComplaint", v, { shouldDirty: true })
                }
              />
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
              {form.formState.isSubmitting ? "Filing…" : "File claim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
