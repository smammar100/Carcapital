/**
 * Postcode → address suggestions.
 *
 * The UI is a list you pick from. What can populate that list depends entirely
 * on the provider:
 *
 * - **postcodes.io** (current, free) is a GEOGRAPHIC service. It resolves a
 *   postcode to its ward, district and region and holds no street names,
 *   house numbers or flats. It can therefore only ever return ONE suggestion —
 *   the locality — with the house number left for the user.
 * - **A PAF provider** (getAddress.io, Ideal Postcodes, Loqate) returns every
 *   delivery point for the postcode, which is the multi-address list people
 *   expect from a shop checkout.
 *
 * Verified 2026-07-21 that no free source closes this gap: postcodes.io
 * returns 46 fields, none address-related; Nominatim returns the postcode
 * centroid only; OSM/Overpass has no address nodes for the test postcodes.
 *
 * Swapping provider means implementing `AddressProvider` and changing
 * `activeProvider` — nothing above this file changes.
 */

/** One selectable address. */
export interface AddressSuggestion {
  /** Stable key for the list. */
  id: string;
  /** House number + street. Empty when the provider has no premise data. */
  line1: string;
  town: string;
  county: string;
  postcode: string;
  /** What the dropdown row reads. */
  label: string;
  /**
   * False when the provider couldn't supply a house number and street, so the
   * UI can say "add your house number" rather than implying a full address.
   */
  isComplete: boolean;
}

export interface AddressProvider {
  readonly name: string;
  /** True when this provider can return per-premise addresses. */
  readonly hasPremiseData: boolean;
  search(postcode: string): Promise<AddressSuggestion[]>;
}

/** Normalise for the API path: "tw3 4bz" → "TW34BZ". */
const compact = (postcode: string): string =>
  postcode.toUpperCase().replace(/\s+/g, "");

/** Pretty UK form: "TW34BZ" → "TW3 4BZ". */
function formatPostcode(postcode: string): string {
  const c = compact(postcode);
  if (c.length < 5) return c;
  return `${c.slice(0, -3)} ${c.slice(-3)}`;
}

interface PostcodesIoResult {
  postcode?: string;
  admin_ward?: string | null;
  admin_district?: string | null;
  admin_county?: string | null;
  region?: string | null;
}

/**
 * Free geographic provider. Returns at most one suggestion, because it has no
 * premise-level data — see the file header.
 */
const postcodesIoProvider: AddressProvider = {
  name: "postcodes.io",
  hasPremiseData: false,

  async search(postcode: string): Promise<AddressSuggestion[]> {
    const key = compact(postcode);
    if (!key) return [];

    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(key)}`,
    );
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Postcode lookup failed (${res.status})`);

    const json = (await res.json()) as { result?: PostcodesIoResult };
    const r = json.result;
    if (!r) return [];

    const town = r.admin_district ?? "";
    const county = r.admin_county || r.region || "";
    const ward = r.admin_ward ?? "";
    const pretty = r.postcode ?? formatPostcode(postcode);

    return [
      {
        id: key,
        line1: "",
        town,
        county,
        postcode: pretty,
        label: [ward, town, county].filter(Boolean).join(", "),
        isComplete: false,
      },
    ];
  },
};

/** The provider in use. Swap here when a PAF key is available. */
const activeProvider: AddressProvider = postcodesIoProvider;

export const addressLookupService = {
  /** Suggestions for a postcode, newest provider semantics. */
  search(postcode: string): Promise<AddressSuggestion[]> {
    return activeProvider.search(postcode);
  },
  /** Whether the UI can promise a full address on selection. */
  get hasPremiseData(): boolean {
    return activeProvider.hasPremiseData;
  },
  get providerName(): string {
    return activeProvider.name;
  },
  /** Full one-line address for an accepted suggestion. */
  toAddressLine(s: AddressSuggestion): string {
    return [s.line1, s.label].filter(Boolean).join(", ").toUpperCase();
  },
};
