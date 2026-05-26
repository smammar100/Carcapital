"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Megaphone,
  History,
  ClipboardCheck,
  Coins,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ThingsToDoList } from "./things-to-do-list";
import { EmptyState } from "@/components/shared/empty-state";
import { VehicleImage } from "@/components/shared/vehicle-image";
import type { CarAngle } from "@/lib/services/photo-service";
import { CostSummaryPanel } from "./cost-summary-panel";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
} from "@/lib/utils";
import type {
  ActivityLogEntry,
  Appointment,
  InspectionCheck,
  Listing,
  Vehicle,
} from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import { appointmentService } from "@/lib/services/appointment-service";
import { activityService } from "@/lib/services/activity-service";
import { inspectionService } from "@/lib/services/inspection-service";
import { enquiryService } from "@/lib/services/enquiry-service";
import { AddEnquiryDialog } from "@/components/enquiries/add-enquiry-dialog";
import type { Enquiry } from "@/lib/types";

interface Props {
  vehicle: Vehicle;
  /** v4.1 §11.5 — opens the inspection side-panel from the parent page. */
  onOpenInspection?: () => void;
}

export function VehicleDetailTabs({ vehicle, onOpenInspection }: Props) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="w-full overflow-x-auto justify-start">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="financials">Financials</TabsTrigger>
        <TabsTrigger value="todos">Things to Do</TabsTrigger>
        <TabsTrigger value="inspection">Inspection</TabsTrigger>
        <TabsTrigger value="photos">Photos</TabsTrigger>
        <TabsTrigger value="listing">Listing</TabsTrigger>
        <TabsTrigger value="appointments">Appointments</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <OverviewTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="financials" className="mt-4">
        <FinancialsTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="todos" className="mt-4">
        <Card className="p-5">
          <ThingsToDoList vehicleId={vehicle.id} />
        </Card>
      </TabsContent>
      <TabsContent value="inspection" className="mt-4">
        <InspectionTab vehicle={vehicle} onOpenInspection={onOpenInspection} />
      </TabsContent>
      <TabsContent value="photos" className="mt-4">
        <PhotosTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="listing" className="mt-4">
        <ListingTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="appointments" className="mt-4">
        <AppointmentsTab vehicle={vehicle} />
      </TabsContent>
      <TabsContent value="activity" className="mt-4">
        <ActivityTab vehicle={vehicle} />
      </TabsContent>
    </Tabs>
  );
}

function OverviewTab({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Card className="p-5">
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <Field label="Make / Model">
          {vehicle.make} {vehicle.model}
        </Field>
        <Field label="Variant">{vehicle.variantCode ?? "—"}</Field>
        <Field label="Year">{vehicle.year}</Field>
        <Field label="Colour">{vehicle.colour}</Field>
        <Field label="Mileage">{vehicle.mileage.toLocaleString()} mi</Field>
        <Field label="Engine">{vehicle.engineSizeCC ?? "—"} cc</Field>
        <Field label="Body / Fuel" className="capitalize">
          {vehicle.bodyType} · {vehicle.fuelType} · {vehicle.transmission}
        </Field>
        <Field label="Stock ID">{vehicle.stockId}</Field>
        <Field label="Received">{formatDate(vehicle.receivedDate)}</Field>
        <Field label="MOT expiry">{formatDate(vehicle.motExpiry)}</Field>
        <Field label="Seller" className="col-span-full sm:col-span-1">
          {vehicle.sellerName} · {vehicle.sellerPhone}
        </Field>
        <Field label="Purchase Source" className="capitalize">
          {vehicle.purchaseSource.replace("_", " ")}
          {vehicle.auctionHouse ? ` (${vehicle.auctionHouse})` : ""}
        </Field>
        <Field label="V5 received">{vehicle.v5Received ? "Yes" : "No"}</Field>
        <Field label="Service history" className="capitalize">
          {vehicle.serviceHistory}
        </Field>
        <Field label="Keys">{vehicle.numKeys}</Field>
        <Field label="Lock nut">{vehicle.lockNut ? "Present" : "Missing"}</Field>
      </div>
    </Card>
  );
}

function FinancialsTab({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="p-5">
        <h3 className="text-sm font-semibold">Purchase Cost Breakdown</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Buying price">{formatCurrency(vehicle.buyingPrice)}</Field>
          <Field label="Buyer's fee">{formatCurrency(vehicle.buyersFee)}</Field>
          <Field label="Inspection charge">
            {formatCurrency(vehicle.inspectionCharge)}
          </Field>
          <Field label="Collection fee">
            {formatCurrency(vehicle.collectionFee)}
          </Field>
          <Field label="Delivery fee">
            {formatCurrency(vehicle.deliveryFee)}
          </Field>
          <Field label="Total buying">
            {formatCurrency(vehicle.totalBuyingPrice)}
          </Field>
        </div>

        <h3 className="mt-6 text-sm font-semibold">Stocking</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Provider" className="capitalize">
            {vehicle.financeProvider.replace("_", " ")}
          </Field>
          <Field label="Days × daily rate">
            {vehicle.daysInStock} × {formatCurrency(vehicle.dailyChargeRate)} ={" "}
            {formatCurrency(
              (vehicle.dailyChargeRate ?? 0) * vehicle.daysInStock,
            )}
          </Field>
          <Field label="Loading fee">
            {formatCurrency(vehicle.loadingFee)}
          </Field>
          <Field label="Unloading fee">
            {formatCurrency(vehicle.unloadingFee)}
          </Field>
          <Field label="Stocking accumulated">
            {formatCurrency(vehicle.stockingCharges)}
          </Field>
        </div>

        <h3 className="mt-6 text-sm font-semibold">Preparation & Pricing</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Value addition">
            {formatCurrency(vehicle.valueAddition)}
          </Field>
          <Field label="Warranty cost">
            {formatCurrency(vehicle.warrantyCost)}
          </Field>
          <Field label="Landed cost">
            {formatCurrency(vehicle.landedCost)}
          </Field>
          <Field label="Base cost">{formatCurrency(vehicle.baseCost)}</Field>
          <Field label="Min sale price">
            {formatCurrency(vehicle.minimumSalePrice)}
          </Field>
          <Field label="Listing price">
            {formatCurrency(vehicle.listingPrice)}
          </Field>
          {vehicle.sellingPrice !== null && (
            <>
              <Field label="Sold for">
                {formatCurrency(vehicle.sellingPrice)}
              </Field>
              <Field label="Gross earning">
                {formatCurrency(vehicle.grossEarning)}
              </Field>
            </>
          )}
        </div>
      </Card>
      <CostSummaryPanel
        buyingPrice={vehicle.buyingPrice}
        feesAndCharges={vehicle.totalBuyingPrice - vehicle.buyingPrice}
        stockingCharges={vehicle.stockingCharges}
        prepCosts={vehicle.valueAddition}
        warranty={vehicle.warrantyCost ?? 0}
        listingPrice={vehicle.listingPrice}
      />
    </div>
  );
}

function InspectionTab({
  vehicle,
  onOpenInspection,
}: {
  vehicle: Vehicle;
  onOpenInspection?: () => void;
}) {
  const [checks, setChecks] = useState<InspectionCheck[] | null>(null);
  useEffect(() => {
    void inspectionService.getForVehicle(vehicle.id).then(setChecks);
  }, [vehicle.id]);

  if (checks === null) {
    return (
      <Card className="p-5">
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }
  if (checks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No inspection yet"
        description="Run a 20-point inspection to surface issues and auto-generate Things to Do."
        action={
          onOpenInspection ? (
            <Button onClick={onOpenInspection}>Start Inspection</Button>
          ) : null
        }
      />
    );
  }
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Latest inspection</h3>
        {onOpenInspection && (
          <Button size="sm" variant="outline" onClick={onOpenInspection}>
            Continue
          </Button>
        )}
      </div>
      <div className="mt-4 divide-y rounded-md border">
        {checks.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <span className="font-medium">
              {c.checkNumber}. {c.checkItem}
            </span>
            <Badge variant="outline" className="capitalize">
              {c.status || "—"}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PhotosTab({ vehicle }: { vehicle: Vehicle }) {
  return <PhotosGrid vehicle={vehicle} />;
}

const PHOTO_TILES: { angle: CarAngle; label: string }[] = [
  { angle: "hero", label: "Hero" },
  { angle: "front", label: "Front" },
  { angle: "rear", label: "Rear" },
  { angle: "side", label: "Side" },
];

function PhotosGrid({ vehicle }: { vehicle: Vehicle }) {
  const [forced, setForced] = useState<Record<CarAngle, number>>({
    hero: 0,
    front: 0,
    rear: 0,
    side: 0,
    interior: 0,
    processed: 0,
    composed: 0,
  });
  function regenerate(angle: CarAngle) {
    setForced((f) => ({ ...f, [angle]: f[angle] + 1 }));
  }
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Gallery</h3>
          <p className="text-xs text-muted-foreground">
            AI-generated for now. Each tile is one OpenAI call when first viewed.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PHOTO_TILES.map((tile) => {
          const force = forced[tile.angle];
          return (
            <div key={tile.angle} className="flex flex-col gap-2">
              <VehicleImage
                key={`${tile.angle}-${force}`}
                vehicle={vehicle}
                angle={tile.angle}
                variant="card"
                forceRegenerate={force > 0}
                alt={`${vehicle.make} ${vehicle.model} ${tile.label}`}
              />
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">
                  {tile.label}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => regenerate(tile.angle)}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Regenerate
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ListingTab({ vehicle }: { vehicle: Vehicle }) {
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  useEffect(() => {
    void listingService.getForVehicle(vehicle.id).then(setListing);
  }, [vehicle.id]);
  if (listing === undefined) {
    return (
      <Card className="p-5">
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }
  if (listing === null) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Not listed yet"
        description="Vehicles in 'ready' status can be listed for sale."
        action={
          vehicle.status === "ready" ? (
            <Button asChild size="sm">
              <Link href="/advert/work-list">Go to Work List</Link>
            </Button>
          ) : null
        }
      />
    );
  }
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">{listing.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{listing.description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Price">{formatCurrency(listing.price)}</Field>
        <Field label="AT indicator" className="capitalize">
          {listing.atPriceIndicator.replace("_", " ")}
        </Field>
        <Field label="Status" className="capitalize">
          {listing.status}
        </Field>
        <Field label="Enquiries">{listing.enquiriesCount}</Field>
        <Field label="Channels" className="col-span-full">
          <div className="flex gap-1.5">
            {Object.entries(listing.channels).map(([k, on]) => (
              <Badge
                key={k}
                variant={on ? "default" : "secondary"}
                className="capitalize"
              >
                {k}
              </Badge>
            ))}
          </div>
        </Field>
      </div>
    </Card>
  );
}

function AppointmentsTab({ vehicle }: { vehicle: Vehicle }) {
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [enquiryDialogOpen, setEnquiryDialogOpen] = useState(false);

  const refetch = () => {
    void appointmentService.getForVehicle(vehicle.id).then(setAppts);
    void enquiryService.getForVehicle(vehicle.id).then(setEnquiries);
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  const loading = appts === null || enquiries === null;
  const isEmpty =
    !loading && (appts?.length ?? 0) === 0 && (enquiries?.length ?? 0) === 0;

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEnquiryDialogOpen(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Enquiry
        </Button>
      </div>

      {loading ? (
        <Card className="p-5">
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : isEmpty ? (
        <EmptyState
          icon={Calendar}
          title="No appointments or enquiries yet"
          description="Capture a fresh enquiry with the button above, or book an appointment from the Appointments page."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {(enquiries?.length ?? 0) > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Recent enquiries</h3>
              <div className="mt-4 divide-y rounded-md border">
                {enquiries!.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-3 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium capitalize">
                        {e.source.replace(/_/g, " ")} ·{" "}
                        <span className="text-muted-foreground">
                          {e.type.replace(/_/g, " ")}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(e.createdAt)}
                      </span>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {e.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(appts?.length ?? 0) > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold">
                Appointments for this vehicle
              </h3>
              <div className="mt-4 divide-y rounded-md border">
                {appts!.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{a.customerName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(a.date)} · {a.time}
                      </span>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {a.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <AddEnquiryDialog
        open={enquiryDialogOpen}
        onOpenChange={setEnquiryDialogOpen}
        vehicleId={vehicle.id}
        onCreated={refetch}
      />
    </>
  );
}

function ActivityTab({ vehicle }: { vehicle: Vehicle }) {
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);
  useEffect(() => {
    void activityService.getForVehicle(vehicle.id).then(setEntries);
  }, [vehicle.id]);
  if (entries === null) {
    return (
      <Card className="p-5">
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Every action on this vehicle will appear here."
      />
    );
  }
  return (
    <Card className="p-5">
      <ol className="relative ms-3 space-y-4 border-l pl-4">
        {entries.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1 grid h-3 w-3 place-items-center rounded-full bg-background ring-2 ring-border">
              <Coins className="h-2 w-2" />
            </span>
            <div className="text-sm">
              <span className="font-medium">{e.description}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {formatRelativeTime(e.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
