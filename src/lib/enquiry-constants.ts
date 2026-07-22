/**
 * Curated lists of enquiry sources and types. Kept as TS consts (not a DB
 * lookup table) so dev can iterate quickly; revisit if the dealership wants
 * to manage these from the admin UI.
 *
 * The two TYPES arrays are intentionally split into "Active" and "Lost"
 * groups — the dropdown UI renders them as separate sections, and picking
 * any `lost_*` type auto-derives the matching `lost_reason` on the enquiry
 * row.
 */
import type { LostReason } from "@/lib/types";

export const ENQUIRY_SOURCES = [
  // Active marketing channels
  { value: "autotrader_internet", label: "AutoTrader (Internet)" },
  { value: "autotrader_chat", label: "AutoTrader (Chat)" },
  { value: "cargurus", label: "CarGurus" },
  { value: "hey_car", label: "Hey Car" },
  { value: "ebay_motors", label: "eBay Motors" },
  { value: "gumtree", label: "Gumtree" },
  { value: "cinch", label: "Cinch" },
  { value: "motors", label: "Motors.co.uk" },
  // Social
  { value: "facebook", label: "Facebook" },
  { value: "facebook_marketplace", label: "Facebook Marketplace" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  // Search
  { value: "google_ppc", label: "Google (PPC)" },
  { value: "google_organic", label: "Google (Organic)" },
  { value: "bing_ppc", label: "Bing (PPC)" },
  // Direct & repeat
  { value: "dealer_website", label: "Dealer Website" },
  { value: "website_chat", label: "Website Chat" },
  { value: "phone", label: "Phone (inbound)" },
  { value: "walk_in", label: "Walk-in" },
  { value: "drive_by", label: "Drive-by" },
  // Repeat / referral
  { value: "existing_customer", label: "Existing Customer" },
  { value: "referral", label: "Referral" },
  // Other
  { value: "inbound_sms", label: "Inbound SMS" },
  { value: "other", label: "Other" },
] as const;

export type EnquirySourceValue = (typeof ENQUIRY_SOURCES)[number]["value"];

export const ENQUIRY_TYPES_ACTIVE = [
  { value: "cash", label: "Cash" },
  { value: "finance", label: "Finance" },
  { value: "test_drive", label: "Test Drive" },
  { value: "trade", label: "Trade-in (PX)" },
  { value: "web_enquiry", label: "Web Enquiry" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "walk_on", label: "Walk-on" },
  { value: "workshop", label: "Workshop" },
  { value: "hot_lead", label: "Hot Lead" },
] as const;

export const ENQUIRY_TYPES_LOST = [
  { value: "lost_price", label: "Lost: Price", reason: "price" as LostReason },
  { value: "lost_vehicle_sold", label: "Lost: Vehicle Sold", reason: "vehicle_sold" as LostReason },
  { value: "lost_finance", label: "Lost: Finance", reason: "finance" as LostReason },
  { value: "lost_contact", label: "Lost: Contact", reason: "contact" as LostReason },
  { value: "lost_px", label: "Lost: PX", reason: "px" as LostReason },
  { value: "lost_product", label: "Lost: Product", reason: "product" as LostReason },
  { value: "lost_people", label: "Lost: People", reason: "people" as LostReason },
  { value: "lost_purchased", label: "Lost: Purchased", reason: "purchased" as LostReason },
  { value: "lost_duplicate", label: "Lost: Duplicate", reason: "duplicate" as LostReason },
] as const;

export type EnquiryActiveTypeValue = (typeof ENQUIRY_TYPES_ACTIVE)[number]["value"];
export type EnquiryLostTypeValue = (typeof ENQUIRY_TYPES_LOST)[number]["value"];

/** Resolve the LostReason from a Lost-X type value; null for active types. */
export function lostReasonForType(type: string): LostReason | null {
  const hit = ENQUIRY_TYPES_LOST.find((t) => t.value === type);
  return hit?.reason ?? null;
}
