import type { Listing, Vehicle } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hasReadableVariant, variantLabel } from "@/lib/vehicle-variant";

/**
 * Advert-readiness checklist shared by the Overview "Advert Completeness" card
 * and the Advert tool's completeness rail, so the two never drift. Accepts a
 * light `listing`-shaped object so the editor can feed live form state (not yet
 * a saved Listing) through the same checks.
 */

export type AdvertCheckState = "done" | "warn" | "miss";

export interface AdvertCheck {
  /** Stable id — also the Advert tool section anchor for deep-linked "Edit". */
  key: string;
  name: string;
  meta: string;
  state: AdvertCheckState;
}

type ListingLike = Pick<Listing, "description" | "price" | "channels">;

export function computeAdvertChecks(
  vehicle: Vehicle,
  listing: ListingLike | null,
  photoCount: number,
): AdvertCheck[] {
  const hasDescription =
    !!listing?.description && listing.description.trim().length > 30;
  // Resolve the price exactly like the Overview Web Price KPI does
  // (listing price, falling back to the vehicle's listing price) — checking
  // only listing.price made this card say "Price not set" beside a KPI tile
  // showing a price for the same vehicle (GEN-48).
  const price = listing?.price ?? vehicle.listingPrice;

  return [
    {
      key: "taxonomy",
      name: "Make / Model / Derivative",
      // GEN-91: the stored variant code is an opaque AutoTrader GUID. Showing
      // it here read as a derivative when it is nothing of the sort, and — via
      // the precedence of `??` over `?:` below — also marked the check "done"
      // on a car that has no readable derivative at all.
      meta: `${vehicle.make} ${vehicle.model} · ${variantLabel(
        vehicle,
        "no derivative",
      )}`,
      state: hasReadableVariant(vehicle) ? "done" : "warn",
    },
    {
      key: "photos",
      name: "Photos",
      meta:
        photoCount > 0
          ? `${photoCount} image${photoCount === 1 ? "" : "s"}`
          : "No photos uploaded",
      state: photoCount >= 8 ? "done" : photoCount > 0 ? "warn" : "miss",
    },
    {
      key: "description",
      name: "Vehicle Description",
      meta: hasDescription
        ? `${listing!.description.length.toLocaleString()} chars`
        : "Empty, generate with AI",
      state: hasDescription ? "done" : "warn",
    },
    {
      key: "pricing",
      name: "Pricing & Floor",
      meta:
        price && vehicle.minimumSalePrice
          ? `${formatCurrency(price)} · Floor ${formatCurrency(
              vehicle.minimumSalePrice,
            )}`
          : price
            ? `${formatCurrency(price)} · no floor set`
            : "Price not set",
      // A price with no floor is workable but risky (nothing stops selling
      // below cost) — warn rather than pass silently.
      state: price ? (vehicle.minimumSalePrice ? "done" : "warn") : "miss",
    },
    {
      key: "mot",
      name: "MOT Status",
      meta: vehicle.motExpiry
        ? `Valid until ${formatDate(vehicle.motExpiry)}`
        : "No expiry on file",
      state: vehicle.motExpiry ? "done" : "warn",
    },
    {
      key: "service",
      name: "Service History",
      meta: vehicle.serviceHistory.replace(/_/g, " "),
      state: vehicle.serviceHistory !== "none" ? "done" : "warn",
    },
    {
      key: "channels",
      name: "Channels",
      meta: listing
        ? Object.entries(listing.channels)
            .filter(([, on]) => on)
            .map(([k]) => k)
            .join(", ") || "None enabled"
        : "Listing not created",
      state: listing
        ? Object.values(listing.channels).some(Boolean)
          ? "done"
          : "warn"
        : "miss",
    },
  ];
}

export function advertCompleteness(checks: AdvertCheck[]): {
  done: number;
  total: number;
  pct: number;
} {
  const done = checks.filter((c) => c.state === "done").length;
  return {
    done,
    total: checks.length,
    pct: Math.round((done / checks.length) * 100),
  };
}
