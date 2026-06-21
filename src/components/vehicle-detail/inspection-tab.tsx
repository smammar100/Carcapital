"use client";

import type { Vehicle } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { InspectionChecklist } from "@/components/vehicles/inspection-checklist";

interface InspectionTabProps {
  vehicle: Vehicle;
}

/**
 * Inspection tab — the 20-point inspection runs INLINE here (no side drawer).
 * `InspectionChecklist` owns the full lifecycle: empty → Start → per-field
 * autosave → Complete (flags issues into Things to Do) → Reset. Re-opening the
 * tab re-loads the saved checks pre-filled and editable, so updating later is
 * just changing a field (it autosaves).
 */
export function InspectionTab({ vehicle }: InspectionTabProps) {
  const { user } = useAuth();
  return (
    <InspectionChecklist vehicle={vehicle} inspector={user?.name ?? "—"} />
  );
}
