"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ClipboardCheck,
  Download,
  Calendar,
  Megaphone,
  Loader2,
} from "lucide-react";
import { vehicleService } from "@/lib/services/vehicle-service";
import { todoService } from "@/lib/services/todo-service";
import { downloadBlob, pdfService } from "@/lib/services/pdf-service";
import { useAuth } from "@/contexts/auth-context";
import type { Vehicle, VehicleStatus } from "@/lib/types";
import { VEHICLE_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RegPlate } from "@/components/shared/reg-plate";
import { VehicleStatusBadge } from "@/components/shared/status-badge";
import { DaysInStockChip } from "@/components/shared/days-in-stock-chip";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { VehicleDetailTabs } from "@/components/vehicles/vehicle-detail-tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, company } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void vehicleService.getById(id).then(setVehicle);
  }, [id]);

  async function handleStatusChange(s: VehicleStatus) {
    if (!user || !vehicle) return;
    const updated = await vehicleService.changeStatus(vehicle.id, s, user.id);
    setVehicle(updated);
    toast.success(`Status: ${s.replace("_", " ")}`);
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

      <VehicleImage vehicle={vehicle} variant="hero" />

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <RegPlate registration={vehicle.registration} size="lg" />
            <div>
              <h1 className="text-xl font-semibold">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              <p className="text-xs text-muted-foreground">
                {vehicle.variantCode ?? "—"} · {vehicle.stockId}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="appearance-none rounded outline-none focus-visible:ring"
                >
                  <VehicleStatusBadge status={vehicle.status} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Change status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {VEHICLE_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onSelect={() => void handleStatusChange(s.value)}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DaysInStockChip days={vehicle.daysInStock} />
            <span className="text-muted-foreground">
              Received {vehicle.receivedDate}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/vehicles/${vehicle.id}/inspection`}>
              <ClipboardCheck className="mr-1.5 h-4 w-4" />
              Inspection
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/listings`}>
              <Megaphone className="mr-1.5 h-4 w-4" />
              Listing
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/appointments`}>
              <Calendar className="mr-1.5 h-4 w-4" />
              Book Appt.
            </Link>
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={exporting}
            onClick={handleExportPdf}
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Job Card PDF
          </Button>
        </div>
      </div>

      <VehicleDetailTabs vehicle={vehicle} />
    </div>
  );
}
