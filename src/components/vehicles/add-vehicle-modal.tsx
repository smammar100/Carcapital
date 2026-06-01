"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preserved through to the arrival form (e.g. a dealer-partner pre-pick). */
  extraParams?: Record<string, string>;
}

/**
 * Add Vehicle pre-entry modal. Captures registration + mileage up front so the
 * arrival form can run the DVLA + AutoTrader lookup in one shot (mileage is
 * required for AutoTrader valuations). "Continue manually" skips the lookup
 * and opens a blank form.
 */
export function AddVehicleModal({ open, onOpenChange, extraParams }: Props) {
  const router = useRouter();
  const regInputRef = useRef<HTMLInputElement>(null);
  const [reg, setReg] = useState("");
  const [mileage, setMileage] = useState("");
  const [navigating, setNavigating] = useState(false);

  const cleanedReg = reg.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const canLookup = cleanedReg.length >= 4 && cleanedReg.length <= 8;

  function go(withLookup: boolean) {
    // The primary CTA stays solid (primary-black) even before a valid reg is
    // entered — clicking it without one just nudges focus to the field rather
    // than navigating to a lookup that would fail.
    if (withLookup && !canLookup) {
      regInputRef.current?.focus();
      return;
    }
    const params = new URLSearchParams(extraParams ?? {});
    if (withLookup) {
      params.set("reg", cleanedReg);
      const m = Number(mileage);
      if (Number.isFinite(m) && m > 0) params.set("mileage", String(Math.round(m)));
    }
    const qs = params.toString();
    setNavigating(true);
    router.push(`/inventory/add-vehicle${qs ? `?${qs}` : ""}`);
    // Close the modal after kicking off navigation. Critical when the user is
    // ALREADY on /inventory/add-vehicle: router.push() to the same path only
    // swaps query params (no remount/navigation event), so the modal's
    // `navigating` spinner would otherwise hang open forever. Closing here also
    // resets state via onOpenChange→reset so a re-open starts clean.
    onOpenChange(false);
  }

  function reset() {
    setReg("");
    setMileage("");
    setNavigating(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Car className="size-4.5" />
            </span>
            Add a vehicle
          </DialogTitle>
          <DialogDescription>
            Enter the registration and mileage — we&apos;ll pull make, model,
            derivative, tax, MOT and an AutoTrader valuation automatically.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="add-vehicle-reg">Registration</Label>
            <Input
              id="add-vehicle-reg"
              ref={regInputRef}
              value={reg}
              onChange={(e) => setReg(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canLookup) go(true);
              }}
              placeholder="EK18 FUT"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase tracking-wider"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="add-vehicle-mileage">Mileage</Label>
            <Input
              id="add-vehicle-mileage"
              type="number"
              inputMode="numeric"
              min={0}
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canLookup) go(true);
              }}
              placeholder="e.g. 45000"
            />
            <p className="text-xs text-muted-foreground">
              Needed for an accurate AutoTrader valuation.
            </p>
          </div>
        </DialogPanel>

        <DialogFooter className="sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => go(false)}
            disabled={navigating}
          >
            Continue manually
          </Button>
          <Button
            type="button"
            onClick={() => go(true)}
            disabled={navigating}
          >
            {navigating ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 size-4" />
            )}
            Look up &amp; continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
