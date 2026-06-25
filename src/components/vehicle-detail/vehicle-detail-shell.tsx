"use client";

import { useEffect, useState } from "react";
import type { Vehicle } from "@/lib/types";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { todoService } from "@/lib/services/todo-service";
import { enquiryService } from "@/lib/services/enquiry-service";
import { OverviewTab } from "./overview-tab";
import { DetailsTab } from "./details-tab";
import { LocationTab } from "./location-tab";
import { FinancialsTab } from "./financials-tab";
import { TodoTab } from "./todo-tab";
import { InspectionTab } from "./inspection-tab";
import { PhotosTab } from "./photos-tab";
import { ListingTab } from "./listing-tab";
import { AppointmentsTab } from "./appointments-tab";
import { ActivityTab } from "./activity-tab";

interface VehicleDetailShellProps {
  vehicle: Vehicle;
  /** Controlled active tab (so the page header can jump to e.g. Inspection). */
  value?: string;
  onValueChange?: (v: string) => void;
  /** Merge fresh fields into the page's Vehicle state (Overview valuation refresh). */
  onVehiclePatch?: (patch: Partial<Vehicle>) => void;
  /** Re-pull the vehicle from the service after a tab mutates photos/inspection
   *  so the header, Photos badge and Overview reflect the change in-session. */
  onVehicleRefetch?: () => void;
  /** Job Card PDF export — surfaced on the Things to Do tab (the job sheet). */
  onExportPdf?: () => void;
  exporting?: boolean;
}

/**
 * v5 vehicle-detail shell — shadcn Tabs (pill style, identical to
 * Admin Invoicing + Sales Appointments) with per-tab panel components.
 * Counts on Things to Do / Photos / Appointments are fetched once on
 * mount so the user sees workload at a glance.
 */
export function VehicleDetailShell({
  vehicle,
  value,
  onValueChange,
  onVehiclePatch,
  onVehicleRefetch,
  onExportPdf,
  exporting,
}: VehicleDetailShellProps) {
  const [todoCount, setTodoCount] = useState<number | null>(null);
  const [enquiryCount, setEnquiryCount] = useState<number | null>(null);
  // Uncontrolled fallback when the page doesn't drive the active tab.
  const [internalTab, setInternalTab] = useState("overview");
  const activeTab = value ?? internalTab;
  const setActiveTab = onValueChange ?? setInternalTab;

  useEffect(() => {
    void todoService
      .getForVehicle(vehicle.id)
      .then((rows) =>
        setTodoCount(rows.filter((r) => r.status !== "completed").length),
      )
      .catch(() => setTodoCount(null));
    void enquiryService
      .getForVehicle(vehicle.id)
      .then((rows) => setEnquiryCount(rows.length))
      .catch(() => setEnquiryCount(null));
  }, [vehicle.id]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
      {/* Original grey-pill (`default` variant) but full-width: the
          shadcn TabsTrigger already has `flex-1`, so a `w-full` list
          spreads all 8 tabs to equal widths across the whole content
          area — no stranded pill, no bare gap after "Activity".
          overflow-x-auto keeps it scrollable on narrow viewports. */}
      <TabsList className="w-full overflow-x-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="location">Location</TabsTrigger>
        <TabsTrigger value="financials">Financials</TabsTrigger>
        <TabsTrigger value="todo">
          Things to Do
          <CountBadge value={todoCount} />
        </TabsTrigger>
        <TabsTrigger value="inspection">Inspection</TabsTrigger>
        <TabsTrigger value="photos">
          Photos
          <CountBadge value={vehicle.imagesCount} />
        </TabsTrigger>
        <TabsTrigger value="listing">Listing</TabsTrigger>
        <TabsTrigger value="appointments">
          Appointments
          <CountBadge value={enquiryCount} />
        </TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab
          vehicle={vehicle}
          onVehiclePatch={onVehiclePatch}
          onNavigate={setActiveTab}
        />
      </TabsContent>
      <TabsContent value="details">
        <DetailsTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="location">
        <LocationTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="financials">
        <FinancialsTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="todo">
        <TodoTab
          vehicleId={vehicle.id}
          onExportPdf={onExportPdf}
          exporting={exporting}
        />
      </TabsContent>
      <TabsContent value="inspection">
        <InspectionTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="photos">
        <PhotosTab vehicle={vehicle} onVehicleRefetch={onVehicleRefetch} />
      </TabsContent>
      <TabsContent value="listing">
        <ListingTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="appointments">
        <AppointmentsTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="activity">
        <ActivityTab vehicleId={vehicle.id} />
      </TabsContent>
    </Tabs>
  );
}

function CountBadge({ value }: { value: number | null }) {
  if (value == null || value <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-2xs font-medium tabular-nums text-muted-foreground">
      {value}
    </span>
  );
}
