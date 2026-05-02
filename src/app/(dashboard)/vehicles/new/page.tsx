"use client";

import { ArrivalForm } from "@/components/vehicles/arrival-form";

export default function NewVehiclePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Add Vehicle</h1>
        <p className="text-sm text-muted-foreground">
          Capture arrival details. DVLA lookup auto-populates make/model/year on
          registration blur.
        </p>
      </div>
      <ArrivalForm />
    </div>
  );
}
