"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AddVehicleModal } from "./add-vehicle-modal";

type AddVehicleButtonProps = React.ComponentProps<typeof Button> & {
  children: React.ReactNode;
  /** Extra query params carried through to the arrival form (e.g. a dealer-partner pre-pick). */
  extraParams?: Record<string, string>;
};

/**
 * Drop-in replacement for the old `<Button asChild><Link
 * href="/inventory/add-vehicle">…</Link></Button>` triggers. Clicking opens
 * the Add Vehicle pre-entry modal (reg + mileage) instead of navigating
 * straight to a blank form. Forwards size / variant / className through.
 */
export function AddVehicleButton({
  children,
  extraParams,
  ...props
}: AddVehicleButtonProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button {...props} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <AddVehicleModal
        open={open}
        onOpenChange={setOpen}
        extraParams={extraParams}
      />
    </>
  );
}
