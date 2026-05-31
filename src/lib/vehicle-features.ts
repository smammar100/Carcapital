/**
 * Vehicle feature catalogue for the Advert tool — mirrors the AutoTrader /
 * dealer-DMS equipment taxonomy (the "This car comes with…" picker).
 *
 * Features are grouped into the five standard categories so the picker can
 * colour-code chips the way AutoTrader does (Comfort / Exterior / Interior /
 * Safety & Security / Other). The list is intentionally static — it's a
 * reference catalogue, not user data — so it lives as a constant rather than
 * a table.
 */

export type FeatureCategory =
  | "Comfort"
  | "Exterior"
  | "Interior"
  | "Safety & Security"
  | "Other";

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  "Comfort",
  "Exterior",
  "Interior",
  "Safety & Security",
  "Other",
];

/** Tailwind chip tones per category — matches the AutoTrader colour key. */
export const FEATURE_CATEGORY_TONE: Record<
  FeatureCategory,
  { chip: string; dot: string }
> = {
  Comfort: {
    chip: "border-violet-300 text-violet-800 dark:border-violet-500/40 dark:text-violet-200",
    dot: "bg-violet-500",
  },
  Exterior: {
    chip: "border-emerald-300 text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  Interior: {
    chip: "border-blue-300 text-blue-800 dark:border-blue-500/40 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  "Safety & Security": {
    chip: "border-rose-300 text-rose-800 dark:border-rose-500/40 dark:text-rose-200",
    dot: "bg-rose-500",
  },
  Other: {
    chip: "border-amber-300 text-amber-800 dark:border-amber-500/40 dark:text-amber-200",
    dot: "bg-amber-500",
  },
};

const CATALOG: Record<FeatureCategory, string[]> = {
  Comfort: [
    "Air Conditioning",
    "Air-Conditioning - Automatic",
    "Armrest - Front",
    "Armrest - Front/Rear",
    "Armrest - Rear",
    "Cruise Control",
    "Cup Holder",
    "Electric Memory Seats",
    "Electric Seats",
    "Electric Windows - Front",
    "Electric Windows - Front/Rear",
    "Fridge in Armrest",
    "Folding Split Rear Seats",
    "Heated Door Mirrors",
    "Heated Front and Rear Seats",
    "Heated Front Screen",
    "Heated Front Seats",
    "Heated Rear Screen",
    "Heated Washer Jets",
    "Seat Height Adjustment - Driver",
    "Seat Height Adjustment - Driver/Passenger",
    "Seat Height Adjustment - Electric Driver",
    "Seat Lumbar Support - Driver",
    "Seat Lumbar Support - Driver Electric",
    "Seat Lumbar Support - Driver/Passenger",
    "Seats Electric - Driver",
    "Seats Electric - Driver/Passenger",
    "Seats Heated - Driver",
    "Seats Heated - Driver/Passenger",
    "Seats Heated - Driver/Passenger/Rear",
    "Seats Split Rear 60/40",
    "Electric Roof",
    "Electric Slide and Tilt Sunroof",
    "Electric Sunroof",
    "Manual Sunroof",
    "Panoramic Roof",
    "Sunroof",
    "Sunroof Visor",
    "Twin Electric Sunroof",
    "Power Assisted Steering",
    "Adjustable Steering Column/Wheel - Rake",
    "Adjustable Steering Wheel - Rake/Reach",
    "Multi Function Steering Wheel",
    "Leather Steering Wheel",
    "Steering Wheel Mounted Controls",
    "M Sport Multi-function Steering Wheel",
    "Paddle Shift Gear Change",
    "Power Socket",
    "Power Socket - Front/Rear",
    "Cigar Lighter",
    "Self Levelling Suspension",
    "Clock - Digital",
    "Rev Counter",
    "Trip Computer",
    "External Temperature Display",
    "Computer - Driver Information System",
    "Drivers Information System",
    "Rain Sensor",
  ],
  Exterior: [
    "Alloy Wheels",
    "Alloy Wheels - 15in",
    "Alloy Wheels - 16in",
    "Alloy Wheels - 17in",
    "Alloy Wheels - 18in",
    "Alloy Wheels - 19in",
    "Alloy Wheels - 20in",
    "M Sport Alloys",
    "Bi Xenon Lighting System",
    "Xenon Headlights",
    "Front Fog Lights",
    "Body Coloured Bumpers",
    "Body Kit",
    "Colour Coding - Body",
    "Metallic Paint",
    "Pearlescent Paint",
    "Electric Door Mirrors",
    "Electric Door Mirrors - Heated",
    "Electric Door Mirrors - Heated/Folding",
    "Roof Rails",
    "Side Protection Mouldings",
    "Side Steps",
    "Sideskirts",
    "Spoiler",
    "Front Bull Bars",
    "Detachable Hard Top",
    "Spare Wheel - Alloy",
    "Spare Wheel - Full Size",
    "Spare Wheel - Spacesaver",
    "Four Wheel Drive",
    "Tinted Glass",
    "Top Tinted Windscreen",
  ],
  Interior: [
    "Leather Interior",
    "Leather Interior - Beige",
    "Leather Interior - Black",
    "Leather Interior - Grey",
    "Half Leather Seats",
    "Half Leather Sports Seats",
    "Leather Sports Seats",
    "Sports Seats",
    "Centre Console",
    "Chilli Pack",
    "Seating Capacity - Two Seats",
    "Seating Capacity - Four Seats",
    "Seating Capacity - Five Seats",
    "Seating Capacity - Seven Seats",
  ],
  "Safety & Security": [
    "ABS Brakes",
    "Air Bag Driver",
    "Air Bag Passenger",
    "Air Bag Side - Curtain",
    "Air Bag Side - Driver/Passenger",
    "Air Bag Side - Front & Rear Curtain",
    "Head Air Bags - Front",
    "Head Air Bags - Front/Rear",
    "Alarm",
    "Alarm - Perimetric",
    "Alarm - Remote Control",
    "Alarm - Volumetric",
    "Central Door Locking - Key",
    "Central Door Locking - Remote",
    "Central Locking",
    "Deadlocks",
    "Child Locks",
    "Immobiliser",
    "Keyless Entry",
    "Locking Wheel Nuts",
    "Electronic Brake Force Distribution",
    "Electronic Stability Programme",
    "Traction Control",
    "Tyre Pressure Control",
    "Seat Belt Pre-Tensioners - Front",
    "Seat Belt Pre-Tensioners - Front/Rear",
    "Centre Rear Seat Belt",
    "Front Head Restraints",
    "Head Restraints - Front",
    "Head Restraints - Front/Rear",
    "Isofix Child Seat Anchor Points",
    "Seat - ISOFIX Anchorage Point",
    "Seat - ISOFIX Anchorage Point - Rear",
    "Third Brake Light",
    "Front and Rear Parking Sensors",
    "Park Distance Control",
    "Park Distance Control - Front/Rear",
    "Park Distance Control - Reverse Camera",
    "Intelligent Parking Assist",
    "Headlamp Wash Wipe",
    "Headlight Washers",
    "Headlight Protectors",
    "Wash/Wipe - Rear",
  ],
  Other: [
    "Bluetooth Phone Preparation",
    "Hands Free Bluetooth Kit",
    "Bose Sound System",
    "CD Multichanger",
    "CD Player",
    "CD/Radio",
    "DVD Player",
    "In Car Entertainment - Multi-Change CD",
    "In Car Entertainment - Radio/Cassette",
    "In Car Entertainment - Radio/Cassette/CD",
    "In Car Entertainment - Radio/CD",
    "In Car Entertainment - Radio/CD/MP3",
    "Sat Nav",
    "Satellite Navigation",
    "TV",
    "Full Service History",
    "Main Agent Service History",
    "Full 12 months MOT",
  ],
};

export interface CatalogFeature {
  name: string;
  category: FeatureCategory;
}

/** Flat, ordered list of every catalogue feature with its category. */
export const VEHICLE_FEATURES: CatalogFeature[] = FEATURE_CATEGORIES.flatMap(
  (category) => CATALOG[category].map((name) => ({ name, category })),
);

const CATEGORY_BY_NAME = new Map<string, FeatureCategory>(
  VEHICLE_FEATURES.map((f) => [f.name.toLowerCase(), f.category]),
);

/** Best-effort category for an arbitrary feature string (chips from saved data). */
export function categoryForFeature(name: string): FeatureCategory {
  return CATEGORY_BY_NAME.get(name.trim().toLowerCase()) ?? "Other";
}
