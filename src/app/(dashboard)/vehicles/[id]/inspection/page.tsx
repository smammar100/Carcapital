"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RegPlate } from "@/components/shared/reg-plate";
import { InspectionChecklist } from "@/components/vehicles/inspection-checklist";

export default function InspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);

  useEffect(() => {
    void vehicleService.getById(id).then(setVehicle);
  }, [id]);

  if (vehicle === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }
  if (vehicle === null) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Vehicle not found.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2">
            <Link href={`/vehicles/${id}`}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to vehicle
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              20-point Inspection
            </h1>
            <RegPlate registration={vehicle.registration} />
          </div>
          <p className="text-sm text-muted-foreground">
            {vehicle.make} {vehicle.model} — {vehicle.stockId}
          </p>
        </div>
      </div>

      <InspectionChecklist
        vehicle={vehicle}
        inspector={user?.name ?? "—"}
      />
    </div>
  );
}
