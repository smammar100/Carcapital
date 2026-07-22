/**
 * DVLA Vehicle Enquiry Service — server-only wrapper.
 *
 * Sister of `dvsa-service.ts`. Imported only from Next.js API routes; never
 * from a client component (DVLA_API_KEY would leak). Pulls the FULL DVLA
 * VES response (not just the six fields the old /api/dvla/lookup route
 * mapped) so the combined /api/vehicle/lookup can surface CO₂, Euro status,
 * tax, V5C and wheelplan on the new Compliance & Verification card.
 *
 * The existing `/api/dvla/lookup` route is untouched — it still returns the
 * narrower legacy shape for find-vehicle-card and any other consumer that
 * binds against it directly.
 */

import "server-only";

const DVLA_ENDPOINT =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

const DVLA_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// Raw DVLA VES response (every field the v1 spec documents)
// ---------------------------------------------------------------------------
interface DvlaRaw {
  registrationNumber?: string;
  make?: string;
  yearOfManufacture?: number;
  monthOfFirstRegistration?: string; // YYYY-MM
  colour?: string;
  fuelType?: string;
  engineCapacity?: number;
  co2Emissions?: number;
  euroStatus?: string | null;
  taxStatus?: string;
  taxDueDate?: string;
  motStatus?: string;
  motExpiryDate?: string;
  wheelplan?: string;
  typeApproval?: string;
  realDrivingEmissions?: string | null;
  markedForExport?: boolean;
  automatedVehicle?: boolean | null;
  dateOfLastV5CIssued?: string;
  artEndDate?: string | null;
}

// ---------------------------------------------------------------------------
// Public mapped shape — keys mirror the user-spec'd payload one-for-one.
// ---------------------------------------------------------------------------
export interface DvlaLookupResult {
  registration: string;
  make: string | null;
  model: string | null; // DVLA VES never returns this
  colour: string | null;
  fuelType: FuelTypeNormalised;
  engineCapacityCC: number | null;
  co2Emissions: number | null;
  euroStatus: string | null;
  registrationDate: string | null; // YYYY-MM-DD (derived from yearOf + monthOf)
  yearOfManufacture: number | null;
  vehicleType: "car" | "van" | null;
  wheelplan: string | null;
  automatedVehicle: boolean | null;
  taxStatus: string | null;
  taxDueDate: string | null;
  motStatus: string | null;
  motExpiryDate: string | null;
  dateOfLastV5CIssued: string | null;
}

export type FuelTypeNormalised = "petrol" | "diesel" | "hybrid" | "electric";

export class DvlaError extends Error {
  readonly code:
    | "missing_credentials"
    | "rate_limited"
    | "upstream_error"
    | "timeout"
    | "network"
    | "invalid_format";
  readonly status: number | null;
  constructor(
    code: DvlaError["code"],
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function normaliseReg(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
}

function titleCase(s: string | undefined | null): string | null {
  if (!s) return null;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapFuelType(dvla: string | undefined): FuelTypeNormalised {
  switch ((dvla ?? "").toUpperCase()) {
    case "PETROL":
      return "petrol";
    case "DIESEL":
      return "diesel";
    case "ELECTRICITY":
    case "ELECTRIC":
      return "electric";
    case "HYBRID ELECTRIC":
    case "PETROL HYBRID":
    case "PETROL/ELECTRIC":
    case "PETROL/ELECTRIC HYBRID":
      return "hybrid";
    default:
      return "petrol";
  }
}

/** Coarse vehicle-type derivation from DVLA's `wheelplan`. */
function deriveVehicleType(raw: DvlaRaw): "car" | "van" | null {
  const wp = (raw.wheelplan ?? "").toUpperCase();
  if (wp.includes("RIGID BODY") || wp.includes("MOTORHOME")) {
    // Most LCVs in the UK are "2 AXLE RIGID BODY" too — keep the existing
    // form's default behaviour (Ali corrects this manually) by returning
    // "car" unless we have clear evidence otherwise.
    return "car";
  }
  if (wp.includes("VAN")) return "van";
  return null;
}

/** Combine yearOfManufacture + monthOfFirstRegistration → ISO date or null. */
function deriveRegistrationDate(raw: DvlaRaw): string | null {
  if (raw.monthOfFirstRegistration) {
    // monthOfFirstRegistration is YYYY-MM. We use the 1st of the month as
    // a stable default; DVLA never returns the actual day.
    if (/^\d{4}-\d{2}$/.test(raw.monthOfFirstRegistration)) {
      return `${raw.monthOfFirstRegistration}-01`;
    }
  }
  // Fallback: just the year → 1 January.
  if (raw.yearOfManufacture) return `${raw.yearOfManufacture}-01-01`;
  return null;
}

function mapDvla(raw: DvlaRaw, reg: string): DvlaLookupResult {
  return {
    registration: raw.registrationNumber ?? reg,
    make: raw.make ?? null,
    model: null,
    colour: titleCase(raw.colour),
    fuelType: mapFuelType(raw.fuelType),
    engineCapacityCC: raw.engineCapacity ?? null,
    co2Emissions: raw.co2Emissions ?? null,
    euroStatus: raw.euroStatus ?? null,
    registrationDate: deriveRegistrationDate(raw),
    yearOfManufacture: raw.yearOfManufacture ?? null,
    vehicleType: deriveVehicleType(raw),
    wheelplan: raw.wheelplan ?? null,
    automatedVehicle: raw.automatedVehicle ?? null,
    taxStatus: raw.taxStatus ?? null,
    taxDueDate: raw.taxDueDate ?? null,
    motStatus: raw.motStatus ?? null,
    motExpiryDate: raw.motExpiryDate ?? null,
    dateOfLastV5CIssued: raw.dateOfLastV5CIssued ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public lookup
// ---------------------------------------------------------------------------
export async function lookupDvlaVehicle(
  reg: string,
): Promise<DvlaLookupResult | null> {
  const apiKey = process.env.DVLA_API_KEY;
  if (!apiKey) {
    throw new DvlaError("missing_credentials", "DVLA_API_KEY missing");
  }
  if (!/^[A-Z0-9]{1,8}$/.test(reg)) {
    throw new DvlaError("invalid_format", "Invalid registration format");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DVLA_TIMEOUT_MS);

  try {
    let res: Response;
    try {
      res = await fetch(DVLA_ENDPOINT, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registrationNumber: reg }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new DvlaError(
          "timeout",
          `DVLA lookup timed out after ${DVLA_TIMEOUT_MS}ms`,
        );
      }
      throw new DvlaError("network", `DVLA unreachable: ${String(e)}`);
    }

    if (res.status === 404) return null;
    if (res.status === 429) {
      throw new DvlaError(
        "rate_limited",
        "DVLA rate limit exceeded, try again shortly",
        429,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new DvlaError(
        "upstream_error",
        `DVLA upstream error ${res.status}: ${body.slice(0, 200)}`,
        res.status,
      );
    }

    const raw = (await res.json()) as DvlaRaw;
    return mapDvla(raw, reg);
  } finally {
    clearTimeout(timer);
  }
}
