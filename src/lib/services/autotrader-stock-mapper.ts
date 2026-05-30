/**
 * Map a Carcap Vehicle + Listing to an AutoTrader Connect POST /stock body.
 *
 * Shape derived from the olsgreen/autotrader-api SDK builders + the captured
 * sandbox vehicle response (docs/autotrader-sandbox-shapes.md). The create
 * body nests three blocks:
 *   - `vehicle`     — identity (registration + derivativeId + mileage).
 *   - `adverts.retailAdverts` — price + copy + advertising-location flags.
 *   - `metadata`    — lifecycle state.
 *
 * V1 deliberately creates every advertising location as NOT_PUBLISHED — the
 * advert exists on AutoTrader but isn't live until a separate go-live action.
 *
 * Images are OUT OF SCOPE for V1: Carcap photos are still mocked (no real
 * Supabase Storage URLs), so the advert is created image-less. Documented as
 * a follow-up; not a blocker for advert creation.
 */

import type { Vehicle, Listing } from "@/lib/types";

const ADVERT_LOCATIONS = [
  "autotraderAdvert",
  "advertiserAdvert",
  "locatorAdvert",
  "exportAdvert",
  "profileAdvert",
] as const;

// --- Enum → AutoTrader vocabulary maps (validated against the sandbox) ---
function titleCase(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function atVehicleType(v: string): string {
  return v === "van" ? "Van" : "Car";
}

function atFuelType(v: string): string {
  switch (v) {
    case "petrol":
      return "Petrol";
    case "diesel":
      return "Diesel";
    case "electric":
      return "Electric";
    case "hybrid":
      // AutoTrader distinguishes Petrol/Diesel hybrids; default to the most
      // common (Petrol Hybrid). Edge case documented as a follow-up.
      return "Petrol Hybrid";
    default:
      return "Petrol";
  }
}

const BODY_TYPE_MAP: Record<string, string> = {
  hatchback: "Hatchback",
  saloon: "Saloon",
  suv: "SUV",
  mpv: "MPV",
  estate: "Estate",
  convertible: "Convertible",
  coupe: "Coupe",
};

export interface StockMapInput {
  vehicle: Vehicle;
  listing: Listing;
}

export interface StockMapResult {
  body: Record<string, unknown>;
  /** Non-fatal issues the caller should surface (e.g. missing derivativeId). */
  warnings: string[];
}

export function buildStockCreateBody({
  vehicle,
  listing,
}: StockMapInput): StockMapResult {
  const warnings: string[] = [];

  if (!vehicle.atDerivativeId) {
    warnings.push(
      "No AutoTrader derivativeId on this vehicle — re-run the DVLA/AutoTrader lookup so the advert maps to the correct taxonomy.",
    );
  }
  if (vehicle.imagesCount === 0 || !vehicle.heroImageUrl) {
    warnings.push(
      "Advert will be created without images (photo storage pending). Add images in AutoTrader or once Carcap photo upload ships.",
    );
  }

  // All advertising locations start NOT_PUBLISHED (deliberate — go-live is a
  // separate action).
  const advertLocations: Record<string, { status: string }> = {};
  for (const loc of ADVERT_LOCATIONS) {
    advertLocations[loc] = { status: "NOT_PUBLISHED" };
  }

  // AutoTrader requires the full taxonomy even when a derivativeId is given
  // (validated against the sandbox — it rejects null make/model). Map our
  // stored values into AutoTrader's casing/vocabulary.
  const body: Record<string, unknown> = {
    vehicle: {
      vehicleType: atVehicleType(vehicle.vehicleType),
      registration: vehicle.registration.replace(/\s+/g, ""),
      make: titleCase(vehicle.make),
      model: titleCase(vehicle.model) ?? vehicle.derivative ?? "Unknown",
      ...(vehicle.generation ? { generation: vehicle.generation } : {}),
      ...(vehicle.derivative ? { derivative: vehicle.derivative } : {}),
      ...(vehicle.atDerivativeId ? { derivativeId: vehicle.atDerivativeId } : {}),
      fuelType: atFuelType(vehicle.fuelType),
      bodyType: BODY_TYPE_MAP[vehicle.bodyType] ?? titleCase(vehicle.bodyType),
      transmissionType: titleCase(vehicle.transmission),
      odometerReadingMiles: vehicle.mileage,
    },
    adverts: {
      retailAdverts: {
        suppliedPrice: { amountGBP: Math.round(listing.price) },
        attentionGrabber:
          (listing.specialFeatures || "").slice(0, 30) || undefined,
        description: listing.description,
        ...advertLocations,
      },
    },
    metadata: {
      lifecycleState: "FORECOURT",
      // Echo our internal stock ID so AutoTrader records cross-reference back.
      externalStockReference: vehicle.stockId,
    },
  };

  return { body, warnings };
}
