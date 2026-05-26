"use client";

import type { Vehicle } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Field, FieldGrid, SectionDivider } from "./primitives";

interface DetailsTabProps {
  vehicle: Vehicle;
}

/**
 * Details tab — the full vehicle spec sheet. Moved out of the Overview
 * tab so Overview stays the at-a-glance KPI / advert / valuation
 * surface and this dense 16-field grid gets its own home.
 */
export function DetailsTab({ vehicle }: DetailsTabProps) {
  return (
    <div>
      <SectionDivider label="Vehicle Details" />
      <Card size="sm">
        <CardContent>
          <FieldGrid cols={2}>
            <Field label="Make / Model">
              {vehicle.make} {vehicle.model}
            </Field>
            <Field label="Variant">{vehicle.variantCode ?? "—"}</Field>
            <Field label="Year" numeric>
              {vehicle.year}
            </Field>
            <Field label="Colour">{vehicle.colour}</Field>
            <Field label="Mileage" numeric>
              {vehicle.mileage.toLocaleString()} mi
            </Field>
            <Field label="Engine" numeric>
              {vehicle.engineSizeCC
                ? `${vehicle.engineSizeCC.toLocaleString()} cc`
                : "—"}
            </Field>
            <Field label="Body / Fuel">
              <span className="capitalize">
                {vehicle.bodyType} · {vehicle.fuelType} ·{" "}
                {vehicle.transmission}
              </span>
            </Field>
            <Field label="Stock ID" numeric>
              {vehicle.stockId}
            </Field>
            <Field label="Received" numeric>
              {formatDate(vehicle.receivedDate)}
            </Field>
            <Field label="MOT Expiry" numeric>
              {vehicle.motExpiry ? formatDate(vehicle.motExpiry) : "—"}
            </Field>
            <Field label="Seller">
              {vehicle.sellerName} · {vehicle.sellerPhone}
            </Field>
            <Field label="Purchase Source">
              <span className="capitalize">
                {vehicle.purchaseSource.replace("_", " ")}
              </span>
              {vehicle.auctionHouse ? ` (${vehicle.auctionHouse})` : ""}
            </Field>
            <Field label="V5 Received">
              {vehicle.v5Received ? "Yes" : "No"}
            </Field>
            <Field label="Service History">
              <span className="capitalize">{vehicle.serviceHistory}</span>
            </Field>
            <Field label="Keys" numeric>
              {vehicle.numKeys}
            </Field>
            <Field label="Lock Nut">
              {vehicle.lockNut ? "Present" : "Missing"}
            </Field>
          </FieldGrid>
        </CardContent>
      </Card>
    </div>
  );
}
