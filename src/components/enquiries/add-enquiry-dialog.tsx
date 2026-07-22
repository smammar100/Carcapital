"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Customer, UUID, Vehicle } from "@/lib/types";
import { CustomerSearchStep } from "./customer-search-step";
import { StepActions } from "./step-actions";
import { QuickEnquiryForm } from "./quick-enquiry-form";
import { FullEnquiryForm } from "./full-enquiry-form";

type Step = "search" | "actions" | "quick" | "full";

interface AddEnquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The vehicle this enquiry will attach to. Null = no vehicle context (e.g. page-level mount). */
  vehicleId: UUID | null;
  /** Called after a successful save so the parent can refetch/refresh. */
  onCreated?: () => void;
}

/**
 * 4-step Add Enquiry modal.
 *
 *   search   → dedup search step (always first)
 *   actions  → Quick vs. Full chooser, after a customer (or "new") is picked
 *   quick    → the fast path form
 *   full     → the two-page wizard
 *
 * State lives here (not in the children) so navigating back doesn't
 * lose the previously-selected customer. Reset on close.
 */
export function AddEnquiryDialog({
  open,
  onOpenChange,
  vehicleId,
  onCreated,
}: AddEnquiryDialogProps) {
  const [step, setStep] = useState<Step>("search");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  // Reset state every time the dialog closes — next open starts clean.
  useEffect(() => {
    if (!open) {
      setStep("search");
      setSelectedId(null);
      setSelectedCustomer(null);
    }
  }, [open]);

  // Fetch the vehicle once on open so we can show "Vehicle: ABC 123 — Audi A4".
  useEffect(() => {
    if (!open || !vehicleId) {
      setVehicle(null);
      return;
    }
    void vehicleService.getById(vehicleId).then((v) => setVehicle(v ?? null));
  }, [open, vehicleId]);

  const vehicleLabel = vehicle
    ? `${vehicle.registration} · ${vehicle.make} ${vehicle.model} (${vehicle.stockId})`
    : null;

  function handleSelect(customer: Customer | null, id: string) {
    setSelectedCustomer(customer);
    setSelectedId(id);
  }

  function handleComplete() {
    onOpenChange(false);
    onCreated?.();
  }

  const titleBySte: Record<Step, string> = {
    search: "Find or create customer",
    actions: "How much do you want to capture?",
    quick: "Quick enquiry",
    full: "New enquiry",
  };

  const descriptionByStep: Record<Step, string> = {
    search: "We'll dedup against your existing customers before we create anything.",
    actions: "Quick is for hot leads. Full captures the whole profile.",
    quick: "Just the essentials; you can always come back and complete the profile later.",
    full: "Full customer profile plus the enquiry details.",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleBySte[step]}</DialogTitle>
          <DialogDescription>{descriptionByStep[step]}</DialogDescription>
        </DialogHeader>

        {step === "search" && (
          <CustomerSearchStep
            selectedId={selectedId}
            onSelect={handleSelect}
            onContinue={() => setStep("actions")}
            onCancel={() => onOpenChange(false)}
          />
        )}

        {step === "actions" && (
          <StepActions
            selectedCustomer={selectedCustomer}
            onPickQuick={() => setStep("quick")}
            onPickFull={() => setStep("full")}
            onBack={() => setStep("search")}
          />
        )}

        {step === "quick" && (
          <QuickEnquiryForm
            selectedCustomer={selectedCustomer}
            vehicleId={vehicleId}
            vehicleLabel={vehicleLabel}
            onComplete={handleComplete}
            onBack={() => setStep("actions")}
          />
        )}

        {step === "full" && (
          <FullEnquiryForm
            selectedCustomer={selectedCustomer}
            vehicleId={vehicleId}
            vehicleLabel={vehicleLabel}
            onComplete={handleComplete}
            onBack={() => setStep("actions")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
