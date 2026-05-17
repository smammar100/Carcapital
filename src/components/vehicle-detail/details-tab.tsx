"use client";

import { useEffect, useState } from "react";
import type { CustomFieldDefinition, Vehicle } from "@/lib/types";
import { customFieldService } from "@/lib/services/custom-field-service";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Field, FieldGrid, SectionDivider } from "./primitives";

interface DetailsTabProps {
  vehicle: Vehicle;
}

function displayCustom(value: unknown, def: CustomFieldDefinition): string {
  if (value === null || value === undefined || value === "") return "—";
  if (def.fieldType === "boolean") return value ? "Yes" : "No";
  if (def.fieldType === "multi_select")
    return Array.isArray(value) ? value.join(", ") : String(value);
  if (def.fieldType === "currency") {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : formatCurrency(n);
  }
  if (def.fieldType === "date") return formatDate(String(value));
  return String(value);
}

/**
 * Details tab — the full vehicle spec sheet. Moved out of the Overview
 * tab so Overview stays the at-a-glance KPI / advert / valuation
 * surface and this dense 16-field grid gets its own home. Now also
 * surfaces company custom-field values, incl. an archived sub-section
 * (SPEC Point 1, T1.5 / T1.6).
 */
export function DetailsTab({ vehicle }: DetailsTabProps) {
  const [defs, setDefs] = useState<CustomFieldDefinition[]>([]);

  useEffect(() => {
    void customFieldService.getAll(vehicle.companyId).then(setDefs);
  }, [vehicle.companyId]);

  const values = vehicle.customFields ?? {};
  const activeDefs = defs.filter((d) => d.archivedAt === null);
  const archivedWithValue = defs.filter(
    (d) =>
      d.archivedAt !== null &&
      values[d.fieldKey] !== undefined &&
      values[d.fieldKey] !== null &&
      values[d.fieldKey] !== "",
  );

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
            <Field label="Source">
              <span className="capitalize">
                {vehicle.sourceType.replace("_", " ")}
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

      {activeDefs.length > 0 && (
        <>
          <SectionDivider label="Custom Fields" />
          <Card size="sm">
            <CardContent>
              <FieldGrid cols={2}>
                {activeDefs.map((d) => (
                  <Field key={d.id} label={d.label}>
                    {displayCustom(values[d.fieldKey], d)}
                  </Field>
                ))}
              </FieldGrid>
            </CardContent>
          </Card>
        </>
      )}

      {archivedWithValue.length > 0 && (
        <>
          <SectionDivider label="Archived Fields" />
          <Card size="sm">
            <CardContent>
              <FieldGrid cols={2}>
                {archivedWithValue.map((d) => (
                  <Field key={d.id} label={`${d.label} (archived)`}>
                    {displayCustom(values[d.fieldKey], d)}
                  </Field>
                ))}
              </FieldGrid>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
