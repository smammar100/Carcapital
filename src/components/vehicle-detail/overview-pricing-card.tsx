"use client";

import { useCallback } from "react";
import { PoundSterling } from "lucide-react";
import type { Listing, Vehicle } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { vehicleService } from "@/lib/services/vehicle-service";
import { listingService } from "@/lib/services/listing-service";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/utils";
import {
  describeChanges,
  nonNegative,
  type FieldChange,
} from "@/lib/field-edit";
import { derivedCostPatch } from "@/lib/vehicle-costs";
import { EditableCard, type EditableField } from "./editable-card";

interface OverviewPricingCardProps {
  vehicle: Vehicle;
  listing: Listing | null;
  onChanged?: () => void;
}

const FIELDS: EditableField<Vehicle>[] = [
  {
    key: "listingPrice",
    label: "Web Price",
    kind: "currency",
    validators: [nonNegative("Web price") as never],
    render: (v) => formatCurrency(v.listingPrice),
  },
  {
    key: "minimumSalePrice",
    label: "Floor Price",
    kind: "currency",
    validators: [nonNegative("Floor price") as never],
    render: (v) => formatCurrency(v.minimumSalePrice),
    hint: "The lowest you will accept. Never shown to customers.",
  },
  {
    key: "sellingPrice",
    label: "Sold For",
    kind: "currency",
    validators: [nonNegative("Selling price") as never],
    render: (v) => formatCurrency(v.sellingPrice),
  },
];

/**
 * Pricing, editable from the Overview (GEN-100).
 *
 * These are the only figures on this tab the Overview genuinely owns — the
 * other KPIs are derived (Days in Stock, Net Profit) or come from AutoTrader
 * (Retail Avg), so the ticket's guidance was to link rather than duplicate an
 * editor for them.
 */
export function OverviewPricingCard({
  vehicle,
  listing,
  onChanged,
}: OverviewPricingCardProps) {
  const { user } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const canEdit = isSuperUser || can("inventory:edit_costs");

  const save = useCallback(
    async (patch: Partial<Vehicle>, changes: FieldChange[]) => {
      if (!user?.id) {
        toast.error("You must be signed in to edit pricing.");
        throw new Error("no actor");
      }

      const next = { ...vehicle, ...patch };
      // Price changes move profit, which is a stored column (GEN-88).
      const withDerived: Partial<Vehicle> = {
        ...patch,
        ...derivedCostPatch({
          buyingPrice: next.buyingPrice,
          buyersFee: next.buyersFee,
          inspectionCharge: next.inspectionCharge,
          collectionFee: next.collectionFee,
          deliveryFee: next.deliveryFee,
          lateStorageFee: next.lateStorageFee,
          loadingFee: next.loadingFee,
          unloadingFee: next.unloadingFee,
          stockingCharges: next.stockingCharges,
          valueAddition: next.valueAddition,
          warrantyCost: next.warrantyCost,
          otherCharges: next.otherCharges,
          sellingPrice: next.sellingPrice,
          listingPrice: next.listingPrice,
        }),
      };

      try {
        await vehicleService.update(vehicle.id, withDerived, user.id, {
          description: `${vehicle.registration} — ${describeChanges(changes)}`,
          changes,
        });

        /**
         * The Overview reads `listing.price` in preference to the vehicle's
         * own `listingPrice`, so writing only the vehicle would look like the
         * edit did nothing. Keep the live listing in step.
         */
        if (listing && patch.listingPrice !== undefined) {
          await listingService.update(listing.id, {
            price: patch.listingPrice ?? 0,
          });
        }

        toast.success("Pricing updated");
        onChanged?.();
      } catch (err) {
        toast.error("Could not save pricing. Please try again.");
        throw err;
      }
    },
    [listing, onChanged, user, vehicle],
  );

  return (
    <EditableCard
      title="Pricing"
      icon={PoundSterling}
      record={vehicle}
      fields={FIELDS}
      onSave={save}
      canEdit={canEdit}
    />
  );
}
