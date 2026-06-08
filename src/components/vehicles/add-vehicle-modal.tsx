"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Input as NordInput } from "@nordhealth/components";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preserved through to the arrival form (e.g. a dealer-partner pre-pick). */
  extraParams?: Record<string, string>;
}

/**
 * Add Vehicle pre-entry modal (Nord <nord-modal>). Captures registration +
 * mileage up front so the arrival form can run the DVLA + AutoTrader lookup in
 * one shot. "Continue manually" skips the lookup and opens a blank form.
 */
export function AddVehicleModal({ open, onOpenChange, extraParams }: Props) {
  const router = useRouter();
  const regInputRef = useRef<NordInput>(null);
  const [reg, setReg] = useState("");
  const [mileage, setMileage] = useState("");
  const [navigating, setNavigating] = useState(false);

  const cleanedReg = reg.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const canLookup = cleanedReg.length >= 4 && cleanedReg.length <= 8;

  function go(withLookup: boolean) {
    if (withLookup && !canLookup) {
      regInputRef.current?.focus();
      return;
    }
    const params = new URLSearchParams(extraParams ?? {});
    if (withLookup) {
      params.set("reg", cleanedReg);
      const m = Number(mileage);
      if (Number.isFinite(m) && m > 0)
        params.set("mileage", String(Math.round(m)));
    }
    const qs = params.toString();
    setNavigating(true);
    router.push(`/inventory/add-vehicle${qs ? `?${qs}` : ""}`);
    // Close after kicking off navigation (also resets state for a clean re-open).
    onOpenChange(false);
  }

  function reset() {
    setReg("");
    setMileage("");
    setNavigating(false);
  }

  return (
    <nord-modal
      open={open}
      size="m"
      aria-label="Add a vehicle"
      // Fires on any close (backdrop / Esc / close button / programmatic) —
      // sync React state so the controlled `open` prop doesn't re-open it.
      onclose={() => {
        reset();
        onOpenChange(false);
      }}
    >
      <h2 slot="header">Add a vehicle</h2>

      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Enter the registration and mileage — we&apos;ll pull make, model,
          derivative, tax, MOT and an AutoTrader valuation automatically.
        </p>
        <nord-input
          ref={regInputRef}
          label="Registration"
          value={reg}
          onInput={(e) =>
            setReg((e.target as HTMLInputElement).value.toUpperCase())
          }
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" && canLookup) go(true);
          }}
          placeholder="EK18 FUT"
          autocomplete="off"
          spellCheck={false}
          className="font-mono uppercase"
          suppressHydrationWarning
        />
        <nord-input
          label="Mileage"
          type="number"
          inputmode="numeric"
          hint="Needed for an accurate AutoTrader valuation."
          value={mileage}
          onInput={(e) => setMileage((e.target as HTMLInputElement).value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" && canLookup) go(true);
          }}
          placeholder="e.g. 45000"
          suppressHydrationWarning
        />
      </div>

      <nord-button
        slot="footer"
        variant="plain"
        onClick={() => go(false)}
        disabled={navigating}
      >
        Continue manually
      </nord-button>
      <nord-button
        slot="footer"
        variant="primary"
        onClick={() => go(true)}
        loading={navigating}
      >
        <nord-icon slot="start" name="navigation-search" />
        Look up &amp; continue
      </nord-button>
    </nord-modal>
  );
}
