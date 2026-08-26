/**
 * Advert copy limits, shared by the Advert editor and the Listing tab's
 * inline editor (GEN-103).
 *
 * These are AutoTrader's field limits, not ours — copy over them is rejected
 * or silently truncated by the channel, so an advert that looks fine in the
 * app can go out mangled. They lived inline in `advert-editor.tsx`; a second
 * editor with its own numbers would be worse than one inconvenient editor,
 * which is exactly what the ticket warned about.
 */

export const ADVERT_LIMITS = {
  /** AutoTrader "Attention Grabber". */
  attentionGrabber: 30,
  /** AutoTrader "Key Selling Point". */
  keySellingPoint: 35,
  description: 3000,
  /** Dealer strapline shown beneath the description. */
  strapline: 999,
  /** Website vehicle subtitle. */
  subtitle: 500,
  /** Per website highlight bullet. */
  highlight: 40,
} as const;

export type AdvertLimitKey = keyof typeof ADVERT_LIMITS;

/** Website highlights shown on the listing card. */
export const MAX_HIGHLIGHTS = 5;

/** Human labels for the over-limit message. */
const LABELS: Record<AdvertLimitKey, string> = {
  attentionGrabber: "Attention Grabber",
  keySellingPoint: "Key Selling Point",
  description: "Description",
  strapline: "Strapline",
  subtitle: "Subtitle",
  highlight: "Highlight",
};

export function limitFor(key: AdvertLimitKey): number {
  return ADVERT_LIMITS[key];
}

export function isOverLimit(key: AdvertLimitKey, value: string): boolean {
  return value.length > ADVERT_LIMITS[key];
}

/** Error message for a single field, or null when it fits. */
export function limitError(key: AdvertLimitKey, value: string): string | null {
  if (!isOverLimit(key, value)) return null;
  return `${LABELS[key]} is ${value.length} characters — the limit is ${ADVERT_LIMITS[key]}.`;
}

/**
 * Every field that exceeds its limit, by label. Returned as a list so the
 * caller can name all of them at once rather than making the user fix one,
 * retry, and discover the next.
 */
export function overLimitFields(
  values: Partial<Record<AdvertLimitKey, string>>,
): string[] {
  return (Object.keys(values) as AdvertLimitKey[])
    .filter((k) => {
      const v = values[k];
      return typeof v === "string" && isOverLimit(k, v);
    })
    .map((k) => LABELS[k]);
}

/**
 * Clean a highlights list for storage: trim, drop blanks, cap the count.
 *
 * Blank rows appear naturally as a user clears a bullet they no longer want,
 * so dropping them here means the UI never has to special-case an empty row.
 */
export function normaliseHighlights(
  highlights: string[],
  max: number = MAX_HIGHLIGHTS,
): string[] {
  return highlights
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Validation for the highlight list as a whole. */
export function highlightsError(highlights: string[]): string | null {
  const cleaned = highlights.map((h) => h.trim()).filter(Boolean);
  if (cleaned.length > MAX_HIGHLIGHTS) {
    return `Only ${MAX_HIGHLIGHTS} highlights are shown on the listing card.`;
  }
  const tooLong = cleaned.find((h) => isOverLimit("highlight", h));
  if (tooLong) {
    return `Each highlight must be ${ADVERT_LIMITS.highlight} characters or fewer.`;
  }
  return null;
}
