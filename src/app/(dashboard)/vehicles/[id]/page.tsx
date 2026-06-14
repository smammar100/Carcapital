"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { vehicleService } from "@/lib/services/vehicle-service";
import { todoService } from "@/lib/services/todo-service";
import { downloadBlob, pdfService } from "@/lib/services/pdf-service";
import { useAuth } from "@/contexts/auth-context";
import type { Vehicle, VehicleStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleHeaderCard } from "@/components/vehicle-detail/vehicle-header-card";
import { VehicleDetailShell } from "@/components/vehicle-detail/vehicle-detail-shell";
import { InspectionSidePanel } from "@/components/inspection/inspection-side-panel";
import { toast } from "@/lib/toast";

/**
 * Vehicle detail — the v5 surface for a single piece of stock. The page
 * owns auth/data hydration and the inspection side-panel; everything
 * visual is handled by `VehicleHeaderCard` (the hero) and
 * `VehicleDetailShell` (pill tabs + per-tab panels).
 */
export default function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, company } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);

  useEffect(() => {
    void vehicleService.getById(id).then(setVehicle);
  }, [id]);

  async function refreshVehicle() {
    const v = await vehicleService.getById(id);
    setVehicle(v);
  }

  /** Merge fresh fields into the displayed vehicle without a re-fetch — used
   *  by the Overview AutoTrader valuation refresh (the server already
   *  persisted the new values). */
  function patchVehicle(patch: Partial<Vehicle>) {
    setVehicle((v) => (v ? { ...v, ...patch } : v));
  }

  async function handleStatusChange(s: VehicleStatus) {
    if (!user || !vehicle) return;
    const updated = await vehicleService.changeStatus(vehicle.id, s, user.id);
    setVehicle(updated);
    toast.success(`Status: ${s.replace("_", " ")}`);
  }

  async function handleRemoveFromWebsite() {
    if (!user || !vehicle) return;
    const ok = window.confirm(
      `Remove ${vehicle.registration} from website?\n\nVehicle will disappear from Work List but stays on the Master Sheet for historical reference.`,
    );
    if (!ok) return;
    const updated = await vehicleService.removeFromWebsite(vehicle.id, user.id);
    setVehicle(updated);
    toast.success(`${vehicle.registration} removed from website`);
  }

  async function handleExportPdf() {
    if (!vehicle || !company) return;
    setExporting(true);
    try {
      const todos = await todoService.getForVehicle(vehicle.id);
      const blob = await pdfService.generateJobCard({
        vehicle,
        todos,
        preparedBy: user?.name ?? "—",
        companyName: company.name,
      });
      downloadBlob(blob, `job-card-${vehicle.stockId}.pdf`);
      toast.success("Job card downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setExporting(false);
    }
  }

  if (vehicle === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }
  if (vehicle === null) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Vehicle not found.
        <div className="mt-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/vehicles">Back to inventory</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/vehicles">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to inventory
        </Link>
      </Button>

      <VehicleHeaderCard
        vehicle={vehicle}
        exporting={exporting}
        onOpenInspection={() => setInspectionOpen(true)}
        onStatusChange={(s) => void handleStatusChange(s)}
        onRemoveFromWebsite={() => void handleRemoveFromWebsite()}
        onExportPdf={() => void handleExportPdf()}
      />

      <VehicleDetailShell
        vehicle={vehicle}
        onOpenInspection={() => setInspectionOpen(true)}
        onVehiclePatch={patchVehicle}
      />

      <InspectionSidePanel
        vehicle={vehicle}
        open={inspectionOpen}
        onOpenChange={setInspectionOpen}
        onComplete={() => void refreshVehicle()}
      />
    </div>
  );
}
