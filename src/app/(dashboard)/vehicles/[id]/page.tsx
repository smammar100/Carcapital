"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { vehicleService } from "@/lib/services/vehicle-service";
import { todoService } from "@/lib/services/todo-service";
import { vendorService } from "@/lib/services/vendor-service";
import { downloadBlob, pdfService } from "@/lib/services/pdf-service";
import { useAuth } from "@/contexts/auth-context";
import type { Vehicle, VehicleStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleHeaderCard } from "@/components/vehicle-detail/vehicle-header-card";
import { VehicleDetailShell } from "@/components/vehicle-detail/vehicle-detail-shell";
import { titleFromPath } from "@/components/layout/sidebar-config";
import { toast } from "@/lib/toast";

/**
 * Custom labels for routes whose sidebar label would otherwise be ambiguous
 * or absent (e.g. both Sales and Maintenance have a page labelled "Pipeline").
 * Every other route a vehicle can be opened from stamps its own path as
 * `?from=` (see `vehicleDetailHref` in `@/lib/vehicle-nav`) and falls back
 * to `titleFromPath` — the same sidebar-route registry the header title
 * uses — so Back returns to the exact page the user came from instead of
 * always Inventory (GEN-88), even from global search or the command palette.
 */
const BACK_TARGETS: Record<string, string> = {
  "/vehicles": "All Vehicles",
  "/sales/pipeline": "Sales Pipeline",
  "/maintenance": "Maintenance Pipeline",
  "/admin/activity": "Activity Log",
  "/advert/photo-processing": "Photo Processing",
  "/inventory/add-vehicle": "Add Vehicle",
};

/** Resolve the Back link target from the `from` query param. Known routes use
 *  a disambiguated label; any other in-app route falls back to its sidebar
 *  title; anything unrecognised falls back to Inventory. */
function resolveBack(from: string | null): { href: string; label: string } {
  if (from) {
    const path = from.split("?")[0];
    const label = BACK_TARGETS[path] ?? titleFromPath(path);
    if (label && label !== "Car Capital UK") return { href: from, label };
  }
  return { href: "/vehicles", label: "Inventory" };
}

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
  const searchParams = useSearchParams();
  const back = resolveBack(searchParams.get("from"));
  const { confirm, confirmDialog } = useConfirm();
  const { user, company } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  // Active detail tab — lifted so the header "Open Inspection" can jump to it.
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    void vehicleService.getById(id).then(setVehicle);
  }, [id]);

  /** Merge fresh fields into the displayed vehicle without a re-fetch — used
   *  by the Overview AutoTrader valuation refresh (the server already
   *  persisted the new values). */
  function patchVehicle(patch: Partial<Vehicle>) {
    setVehicle((v) => (v ? { ...v, ...patch } : v));
  }

  /** Re-pull the vehicle from the service so derived/computed fields the page
   *  doesn't own (imagesCount, heroImageUrl, status, etc.) stay fresh after a
   *  child tab mutates photos / inspection / etc. */
  async function refetchVehicle() {
    const fresh = await vehicleService.getById(id);
    if (fresh) setVehicle(fresh);
  }

  async function handleStatusChange(s: VehicleStatus) {
    if (!user || !vehicle) return;
    try {
      const updated = await vehicleService.changeStatus(vehicle.id, s, user.id);
      setVehicle(updated);
      toast.success(`Status: ${s.replace("_", " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change status");
    }
  }

  async function handleRemoveFromWebsite() {
    if (!user || !vehicle) return;
    const ok = await confirm({
      title: `Remove ${vehicle.registration} from website?`,
      description:
        "The vehicle disappears from the Work List but stays on the Master Sheet for historical reference.",
      confirmText: "Remove from website",
      destructive: true,
    });
    if (!ok) return;
    try {
      const updated = await vehicleService.removeFromWebsite(vehicle.id, user.id);
      setVehicle(updated);
      toast.success(`${vehicle.registration} removed from website`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove from website");
    }
  }

  async function handleExportPdf() {
    if (!vehicle || !company) return;
    setExporting(true);
    try {
      const [todos, vendors] = await Promise.all([
        todoService.getForVehicle(vehicle.id),
        vendorService.getAll(company.id),
      ]);
      const vendorNames = Object.fromEntries(
        vendors.map((v) => [v.id, v.name]),
      );
      const blob = await pdfService.generateJobCard({
        vehicle,
        todos,
        preparedBy: user?.name ?? "—",
        companyName: company.name,
        vendorNames,
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
            <Link href={back.href}>Back to {back.label}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href={back.href}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to {back.label}
        </Link>
      </Button>

      <VehicleHeaderCard
        vehicle={vehicle}
        onStatusChange={(s) => void handleStatusChange(s)}
        onRemoveFromWebsite={() => void handleRemoveFromWebsite()}
        onNavigate={setTab}
      />

      <VehicleDetailShell
        vehicle={vehicle}
        value={tab}
        onValueChange={setTab}
        onVehiclePatch={patchVehicle}
        onVehicleRefetch={() => void refetchVehicle()}
        exporting={exporting}
        onExportPdf={() => void handleExportPdf()}
      />

      {confirmDialog}
    </div>
  );
}
