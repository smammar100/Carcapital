"use client";

import type { Vehicle } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Field, FieldGrid, Pill, SectionDivider } from "./primitives";

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
            <Field label="Variant">
              {vehicle.derivative ??
                vehicle.variantName ??
                vehicle.variantCode ??
                "—"}
            </Field>
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

      {/* DVLA + AutoTrader data captured at intake — see the same fields on
          the Add Vehicle compliance card. */}
      <SectionDivider label="Registration & Compliance" />
      <Card size="sm">
        <CardContent>
          <FieldGrid cols={2}>
            <Field label="MOT Status">
              {vehicle.motStatus ? (
                <Pill tone={vehicle.motStatus === "Valid" ? "good" : "bad"}>
                  {vehicle.motStatus}
                </Pill>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Tax Status">
              {vehicle.taxStatus ? (
                <Pill tone={vehicle.taxStatus === "Taxed" ? "good" : "warn"}>
                  {vehicle.taxStatus}
                </Pill>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Tax Due" numeric>
              {vehicle.taxDueDate ? formatDate(vehicle.taxDueDate) : "—"}
            </Field>
            <Field label="CO₂ Emissions" numeric>
              {vehicle.co2Emissions != null
                ? `${vehicle.co2Emissions} g/km`
                : "—"}
            </Field>
            <Field label="Euro Status">{vehicle.euroStatus ?? "—"}</Field>
            <Field label="Wheelplan">{vehicle.wheelplan ?? "—"}</Field>
            <Field label="First Registered" numeric>
              {vehicle.firstRegisteredDate
                ? formatDate(vehicle.firstRegisteredDate)
                : "—"}
            </Field>
            <Field label="Last V5C Issued" numeric>
              {vehicle.dateOfLastV5CIssued
                ? formatDate(vehicle.dateOfLastV5CIssued)
                : "—"}
            </Field>
          </FieldGrid>
        </CardContent>
      </Card>
    </div>
  );
}
