"use client";

import { useEffect, useState } from "react";
import type { Vehicle } from "@/lib/types";
import { todoService } from "@/lib/services/todo-service";
import { enquiryService } from "@/lib/services/enquiry-service";
import { PillTabs, type PillTab } from "./pill-tabs";
import { OverviewTab } from "./overview-tab";
import { FinancialsTab } from "./financials-tab";
import { TodoTab } from "./todo-tab";
import { InspectionTab } from "./inspection-tab";
import { PhotosTab } from "./photos-tab";
import { ListingTab } from "./listing-tab";
import { AppointmentsTab } from "./appointments-tab";
import { ActivityTab } from "./activity-tab";

type TabValue =
  | "overview"
  | "financials"
  | "todo"
  | "inspection"
  | "photos"
  | "listing"
  | "appointments"
  | "activity";

interface VehicleDetailShellProps {
  vehicle: Vehicle;
  onOpenInspection?: () => void;
}

/**
 * v5 vehicle-detail shell — pill tabs + per-tab panel, lazy-rendered.
 * Counts in the tab labels (Things to Do, Photos, Appointments) are
 * fetched once on mount so the user can see workload at a glance.
 */
export function VehicleDetailShell({
  vehicle,
  onOpenInspection,
}: VehicleDetailShellProps) {
  const [active, setActive] = useState<TabValue>("overview");
  const [todoCount, setTodoCount] = useState<number | null>(null);
  const [enquiryCount, setEnquiryCount] = useState<number | null>(null);

  useEffect(() => {
    void todoService
      .getForVehicle(vehicle.id)
      .then((rows) => setTodoCount(rows.filter((r) => r.status !== "completed").length));
    void enquiryService
      .getForVehicle(vehicle.id)
      .then((rows) => setEnquiryCount(rows.length));
  }, [vehicle.id]);

  const tabs: PillTab<TabValue>[] = [
    { value: "overview", label: "Overview" },
    { value: "financials", label: "Financials" },
    { value: "todo", label: "Things to Do", count: todoCount },
    { value: "inspection", label: "Inspection" },
    { value: "photos", label: "Photos", count: vehicle.imagesCount },
    { value: "listing", label: "Listing" },
    { value: "appointments", label: "Appointments", count: enquiryCount },
    { value: "activity", label: "Activity" },
  ];

  return (
    <div>
      <PillTabs tabs={tabs} active={active} onChange={setActive} />

      {active === "overview" && <OverviewTab vehicle={vehicle} />}
      {active === "financials" && <FinancialsTab vehicle={vehicle} />}
      {active === "todo" && <TodoTab vehicleId={vehicle.id} />}
      {active === "inspection" && (
        <InspectionTab vehicle={vehicle} onOpenInspection={onOpenInspection} />
      )}
      {active === "photos" && <PhotosTab vehicle={vehicle} />}
      {active === "listing" && <ListingTab vehicle={vehicle} />}
      {active === "appointments" && <AppointmentsTab vehicle={vehicle} />}
      {active === "activity" && <ActivityTab vehicleId={vehicle.id} />}
    </div>
  );
}
