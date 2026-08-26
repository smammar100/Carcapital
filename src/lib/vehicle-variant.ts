/**
 * Single source of truth for how a vehicle's variant is displayed (GEN-91).
 *
 * The old inline chain was `derivative ?? variantName ?? variantCode ?? "—"`,
 * which meant that whenever both name fields were empty the UI fell through to
 * the raw taxonomy code and showed the user "TG68". A code is not a variant
 * name — it is meaningless to a salesperson and reads as a data-entry bug.
 *
 * The code is still held on the record and stays searchable; it is simply
 * never the thing we render.
 */

export interface VariantSource {
  variantName?: string | null;
  derivative?: string | null;
  variantCode?: string | null;
}

const EM_DASH = "—";

/**
 * The human-readable variant, or an em dash when we genuinely have no name.
 *
 * `derivative` wins over `variantName` deliberately. In practice the DVLA/
 * AutoTrader lookup fills `variantName` with a bare engine size ("2.0", "1.6")
 * and `derivative` with the full description ("2.0 318d Sport Saloon 4dr
 * Diesel Auto Euro 6 (s/s) (150 ps)") — so preferring the name would show the
 * least useful of the two. This is the order the original inline chain used;
 * the bug was only ever the `?? variantCode` on the end of it.
 */
export function variantLabel(v: VariantSource, fallback: string = EM_DASH): string {
  return firstNonEmpty(v.derivative, v.variantName) ?? fallback;
}

/**
 * Every string a variant should match on when searching or filtering. Includes
 * the code so "TG68" still finds the car even though it is never displayed.
 */
export function variantSearchTerms(v: VariantSource): string[] {
  return [v.derivative, v.variantName, v.variantCode].filter(
    (s): s is string => typeof s === "string" && s.trim() !== "",
  );
}

/**
 * True when a human-readable variant exists. Use this for "is this field
 * filled in?" checks — holding an opaque code is not the same as knowing the
 * derivative, and treating it as such marks incomplete adverts complete.
 */
export function hasReadableVariant(v: VariantSource): boolean {
  return firstNonEmpty(v.derivative, v.variantName) !== null;
}

/** True when we hold a code but no name — the state that produced the bug. */
export function hasCodeButNoName(v: VariantSource): boolean {
  return (
    firstNonEmpty(v.derivative, v.variantName) === null &&
    firstNonEmpty(v.variantCode) !== null
  );
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}
