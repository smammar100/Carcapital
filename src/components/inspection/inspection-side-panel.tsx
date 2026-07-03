"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RegPlate } from "@/components/shared/reg-plate";
import { InspectionChecklist } from "@/components/vehicles/inspection-checklist";
import type { Vehicle } from "@/lib/types";

interface Props {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional hook fired after the inspection is completed. Sheet closes automatically. */
  onComplete?: () => void;
}

/**
 * v4.1 §11.5 / Gap 4 — inspection opens as a right-side `Sheet`, not a route.
 * Wraps the existing `InspectionChecklist` so its lifecycle stays the same.
 */
export function InspectionSidePanel({ vehicle, open, onOpenChange, onComplete }: Props) {
  const { user } = useAuth();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        {vehicle && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                20-point Inspection
                <Link
                  href={`/vehicles/${vehicle.id}`}
                  className="transition-opacity hover:opacity-80"
                  title="Open vehicle details"
                >
                  <RegPlate registration={vehicle.registration} size="sm" />
                </Link>
              </SheetTitle>
              <SheetDescription>
                {vehicle.make} {vehicle.model} · {vehicle.stockId} · Inspector:{" "}
                {user?.name ?? "—"}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 px-4 pb-6">
              <InspectionChecklist
                vehicle={vehicle}
                inspector={user?.name ?? "—"}
                onComplete={() => {
                  onOpenChange(false);
                  onComplete?.();
                }}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
