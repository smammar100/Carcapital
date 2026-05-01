"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { vehicleService } from "@/lib/services/vehicle-service";
import { dvlaService } from "@/lib/services/dvla-service";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRegPlate } from "@/lib/utils";
import type { Vehicle } from "@/lib/types";

export function FindVehicleCard() {
  const router = useRouter();
  const [reg, setReg] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState<{
    reg: string;
    dvla: Partial<Vehicle> | null;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reg.trim()) return;
    const formatted = formatRegPlate(reg);
    setBusy(true);
    try {
      const v = await vehicleService.getByRegistration(formatted);
      if (v) {
        router.push(`/vehicles/${v.id}`);
        return;
      }
      const dvla = await dvlaService.lookup(formatted);
      setNotFound({ reg: formatted, dvla });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Find a Vehicle</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter a UK registration. We&rsquo;ll open the stock card if it&rsquo;s
          ours, or offer to add it.
        </p>
        <form onSubmit={onSubmit} className="mt-auto flex gap-2">
          <Input
            value={reg}
            onChange={(e) => setReg(e.target.value)}
            placeholder="ENTER REG"
            className="font-mono uppercase tracking-wider"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" disabled={busy || !reg.trim()}>
            {busy ? "Searching…" : "Find"}
          </Button>
        </form>
      </Card>

      <Dialog
        open={notFound !== null}
        onOpenChange={(open) => {
          if (!open) setNotFound(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not in stock</DialogTitle>
            <DialogDescription>
              {notFound?.reg} isn&rsquo;t one of yours yet.
              {notFound?.dvla
                ? ` DVLA found: ${notFound.dvla.year ?? ""} ${notFound.dvla.make ?? ""} ${notFound.dvla.model ?? ""} — ready to pre-fill the arrival form.`
                : " DVLA returned nothing — you can still fill the arrival form manually."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNotFound(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                router.push(
                  `/vehicles/new?reg=${encodeURIComponent(notFound?.reg ?? "")}`,
                );
              }}
            >
              Add to stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
