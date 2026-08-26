"use client";

import { useCallback } from "react";
import { Car, FileText, ShieldCheck, Truck } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { vehicleService } from "@/lib/services/vehicle-service";
import { toast } from "@/lib/toast";
import { describeChanges, type FieldChange } from "@/lib/field-edit";
import {
  nonNegative,
  notFuture,
  required,
  validDate,
  validYear,
  withinRange,
} from "@/lib/field-edit";
import { EditableCard, type EditableField } from "./editable-card";
import { Pill } from "./primitives";
import { variantLabel } from "@/lib/vehicle-variant";

interface DetailsTabProps {
  vehicle: Vehicle;
  /** Re-pull the vehicle after a successful save so every tab sees the change. */
  onChanged?: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Builds select options from a string union, title-casing the labels. */
function opts(values: readonly string[]) {
  return values.map((v) => ({
    value: v,
    label: cap(v.replace(/_/g, " ")),
  }));
}

const BODY_TYPES = opts([
  "hatchback",
  "saloon",
  "suv",
  "mpv",
  "estate",
  "convertible",
  "coupe",
]);
const FUEL_TYPES = opts(["petrol", "diesel", "hybrid", "electric"]);
const TRANSMISSIONS = opts(["automatic", "manual"]);
const VEHICLE_TYPES = opts(["car", "van"]);
const PURCHASE_SOURCES = opts([
  "auction",
  "private",
  "trade_in",
  "dealer",
  "other",
]);
const SERVICE_HISTORY = opts(["full", "partial", "none", "unknown"]);

/**
 * Details tab — the full vehicle spec sheet. Four grouped cards (Identity /
 * Acquisition / Documentation / Registration & Compliance), each editable in
 * place (GEN-99). Compliance statuses render as tone-coded pills so MOT / Tax
 * read at a glance.
 *
 * Every card was render-only until GEN-99: a value mistyped at creation, or
 * imported wrong from a BCA form, could not be corrected anywhere in the app.
 */
export function DetailsTab({ vehicle, onChanged }: DetailsTabProps) {
  const { user } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const canEdit = isSuperUser || can("inventory:edit");

  const save = useCallback(
    async (patch: Partial<Vehicle>, changes: FieldChange[]) => {
      if (!user?.id) {
        toast.error("You must be signed in to edit this vehicle.");
        throw new Error("no actor");
      }
      try {
        await vehicleService.update(vehicle.id, patch, user.id, {
          description: `${vehicle.registration} — ${describeChanges(changes)}`,
          changes,
        });
        toast.success("Vehicle updated");
        onChanged?.();
      } catch (err) {
        // Surface the failure and rethrow so the card stays open with the
        // user's edits intact rather than silently reporting success.
        toast.error("Could not save changes. Please try again.");
        throw err;
      }
    },
    [onChanged, user, vehicle],
  );

  const identity: EditableField<Vehicle>[] = [
    {
      key: "make",
      label: "Make",
      kind: "text",
      validators: [required("Make") as never],
    },
    {
      key: "model",
      label: "Model",
      kind: "text",
      validators: [required("Model") as never],
    },
    {
      key: "variantName",
      label: "Variant",
      kind: "text",
      // GEN-91: show the human-readable variant, never the raw taxonomy code.
      render: (v) => variantLabel(v),
      hint: "Leave blank to fall back to the AutoTrader derivative.",
    },
    {
      key: "year",
      label: "Year",
      kind: "integer",
      plain: true,
      validators: [required("Year") as never, validYear() as never],
    },
    {
      key: "colour",
      label: "Colour",
      kind: "text",
      validators: [required("Colour") as never],
    },
    {
      key: "mileage",
      label: "Mileage",
      kind: "integer",
      suffix: "mi",
      validators: [required("Mileage") as never, nonNegative("Mileage") as never],
    },
    {
      key: "engineSizeCC",
      label: "Engine",
      kind: "integer",
      suffix: "cc",
      validators: [nonNegative("Engine size") as never],
    },
    { key: "vehicleType", label: "Type", kind: "select", options: VEHICLE_TYPES },
    { key: "bodyType", label: "Body", kind: "select", options: BODY_TYPES },
    { key: "fuelType", label: "Fuel", kind: "select", options: FUEL_TYPES },
    {
      key: "transmission",
      label: "Transmission",
      kind: "select",
      options: TRANSMISSIONS,
    },
  ];

  const acquisition: EditableField<Vehicle>[] = [
    { key: "stockId", label: "Stock ID", kind: "text" },
    {
      key: "receivedDate",
      label: "Received",
      kind: "date",
      render: (v) => formatDate(v.receivedDate),
      validators: [
        required("Received date") as never,
        validDate("Received date") as never,
        notFuture("Received date") as never,
      ],
    },
    { key: "sellerName", label: "Seller", kind: "text" },
    { key: "sellerPhone", label: "Seller Phone", kind: "text" },
    {
      key: "purchaseSource",
      label: "Purchase Source",
      kind: "select",
      options: PURCHASE_SOURCES,
    },
    { key: "auctionHouse", label: "Auction House", kind: "text" },
    {
      key: "serviceHistory",
      label: "Service History",
      kind: "select",
      options: SERVICE_HISTORY,
      render: (v) => cap(v.serviceHistory),
    },
  ];

  const docs: EditableField<Vehicle>[] = [
    { key: "v5Received", label: "V5 Received", kind: "boolean" },
    {
      key: "numKeys",
      label: "Keys",
      kind: "integer",
      validators: [withinRange("Keys", 0, 10) as never],
    },
    {
      key: "lockNut",
      label: "Lock Nut",
      kind: "boolean",
      render: (v) => (v.lockNut ? "Present" : "Missing"),
    },
    {
      key: "motExpiry",
      label: "MOT Expiry",
      kind: "date",
      render: (v) => formatDate(v.motExpiry),
      validators: [validDate("MOT expiry") as never],
    },
    { key: "vin", label: "VIN / Chassis", kind: "text" },
  ];

  const compliance: EditableField<Vehicle>[] = [
    {
      key: "registration",
      label: "Registration",
      kind: "text",
      validators: [required("Registration") as never],
      hint: "Changing this does not re-run the DVLA lookup automatically.",
    },
    {
      key: "motStatus",
      label: "MOT Status",
      kind: "text",
      render: (v) =>
        v.motStatus ? (
          <Pill tone={v.motStatus === "Valid" ? "good" : "bad"}>
            {v.motStatus}
          </Pill>
        ) : (
          "—"
        ),
    },
    {
      key: "taxStatus",
      label: "Tax Status",
      kind: "text",
      render: (v) =>
        v.taxStatus ? (
          <Pill tone={v.taxStatus === "Taxed" ? "good" : "warn"}>
            {v.taxStatus}
          </Pill>
        ) : (
          "—"
        ),
    },
    {
      key: "taxDueDate",
      label: "Tax Due",
      kind: "date",
      render: (v) => formatDate(v.taxDueDate),
      validators: [validDate("Tax due date") as never],
    },
    {
      key: "co2Emissions",
      label: "CO₂ Emissions",
      kind: "integer",
      suffix: "g/km",
      validators: [nonNegative("CO₂ emissions") as never],
    },
    { key: "euroStatus", label: "Euro Status", kind: "text" },
    { key: "wheelplan", label: "Wheelplan", kind: "text" },
    {
      key: "firstRegisteredDate",
      label: "First Registered",
      kind: "date",
      render: (v) => formatDate(v.firstRegisteredDate),
      validators: [
        validDate("First registered") as never,
        notFuture("First registered") as never,
      ],
    },
    {
      key: "dateOfLastV5CIssued",
      label: "Last V5C Issued",
      kind: "date",
      render: (v) => formatDate(v.dateOfLastV5CIssued),
      validators: [validDate("Last V5C issued") as never],
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <EditableCard
        title="Identity"
        icon={Car}
        record={vehicle}
        fields={identity}
        onSave={save}
        canEdit={canEdit}
      />
      <EditableCard
        title="Acquisition"
        icon={Truck}
        record={vehicle}
        fields={acquisition}
        onSave={save}
        canEdit={canEdit}
      />
      <EditableCard
        title="Documentation"
        icon={FileText}
        record={vehicle}
        fields={docs}
        onSave={save}
        canEdit={canEdit}
      />
      <EditableCard
        title="Registration & Compliance"
        icon={ShieldCheck}
        record={vehicle}
        fields={compliance}
        onSave={save}
        canEdit={canEdit}
      />
    </div>
  );
}
