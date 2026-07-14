/**
 * Fixed legal text + Car Capital company constants for the 2-page sales
 * invoice. Transcribed VERBATIM from Car_Capital_Sales_Invoice.tex
 * (LaTeX → plain text: `\&`→`&`, `--`→`—`, `\gbp{x}`→`£x`). These are
 * legally fixed and NOT user-editable through the form (SPEC §3, §7).
 *
 * Per the user's v1 decision the company record is hardcoded here rather
 * than added to the `companies` table.
 */

import type { AddonCategory, PreDeliveryCheck } from "./types";

export const CAR_CAPITAL_COMPANY = {
  legalName: "Car Capital Ltd",
  addressLines: ["220, Uxbridge Road", "Southall", "London", "UB1 3DZ"],
  bankAccountName: "CAR CAPITAL LTD",
  bankName: "HSBC BANK",
  bankAccountNumber: "81600230",
  bankSortCode: "40-06-23",
  companyRegNumber: "10265341",
  vatRegNumber: "273 2823 02",
  fcaNumber: "788162",
  contactPhones: ["+44(0)208-8434-878", "+44(0)755-5012-101"],
  contactEmail: "info@thecarcapital.co.uk",
  website: "www.thecarcapital.co.uk",
  warrantyProviderPhone: "02088434878",
  warrantyProviderEmail: "info@thecarcapital.co.uk",
  // Accreditation logos rendered in the invoice footer. Served from /public so
  // @react-pdf/renderer's <Image> fetches them at build/print time (the PDF is
  // generated client-side, so a root-relative URL resolves against the origin).
  // JPG/PNG only — @react-pdf/renderer can't rasterise SVG (GEN-35).
  badges: [
    {
      src: "/invoice/autotrader-highly-rated-2023.jpg",
      alt: "AutoTrader — Highly Rated for our Customer Service 2023",
    },
    {
      src: "/invoice/cargurus-top-rated-2023.jpg",
      alt: "CarGurus — Top-Rated Dealer 2023",
    },
  ],
} as const;

export const CUSTOMER_DECLARATION_TEXT =
  "I, the customer, acknowledge that payment for the aforementioned vehicle constitutes a binding contract of purchase and is non-refundable should I withdraw from the agreement or fail to fulfill any outstanding amounts. I accept responsibility for any expenses incurred by the seller in preparing the vehicle for delivery and agree that, in the event of a refund, a deduction of £0.40 per mile driven will apply in addition to any damages caused. Exchanges or returns are not accepted, though my statutory rights under the Consumer Rights Act 2015 remain unaffected. By signing, I confirm that I have read, understood, and agreed to these terms in full.";

export const FINANCE_DECLARATION_TEXT =
  "Car Capital Ltd. is authorised and regulated by the Financial Conduct Authority. We are authorised as a CREDIT BROKER and NOT A LENDER. We can introduce you to a limited number of lenders and their finance products, which may have different interest rates and charges. We are not an independent finance advisor; we will provide details of products available from the lenders that we work with, but no advice or recommendation will be made. You must decide whether the finance product is right for you. We do not charge you a fee for our services. We may receive commission from the lenders we introduce you to. However, the amount of commission that we receive from a lender does not have an effect on the amount that you pay to that lender under your credit agreement.";

export const WARRANTY_COVERAGE_PARTS = {
  engine:
    "Rocker assembly, valves, valve guides, valve springs (burnt or pitted valves & valve seats are excluded from cover), cylinder head, cylinder head gasket, stretched head bolts, push rods, camshaft followers, timing gears, timing chains, tensioner, oil pump, drive gears, pistons, piston rings, cylinder bores, gudgeon pins, connecting rods, big end bearings, main bearing, crankshaft, ring gear, timing belts (subject to correct replacement schedule having taken place), engine casings (if damaged by an internal component).",
  manualGearbox:
    "Gears, shafts, synchromesh hubs, baulk rings, gear selector forks, bearings, speedometer drive, solenoids, transfer box components, gearbox casings (if damaged by an internal component).",
  automaticGearbox:
    "Shafts, bushes, clutches, bearings, oil pump, governers, servos, torque converter, drive plate, valve block, speedometer drive, casings (if damaged by an internal component).",
  clutch:
    "Clutch cover diaphragm, centre plate torque springs, clutch assembly, clutch fork, clutch master cylinder, slave cylinder (excluding semi-automatic gearboxes).",
} as const;

export const WARRANTY_DISCLAIMER_TEXT =
  "The above is a representative example and there maybe exclusions. For any further questions please consult the dealer.";

export const NON_WARRANTY_DISCLAIMER_TEXT =
  "I confirm that when purchasing the above vehicle, I have been offered the comprehensive warranty cover but have chosen to opt for the basic free cover available instead. By Signing this agreement, I am confirming my understanding of all of the above details as correct.";

export const TEST_DRIVE_AFFIRMATION_TEXT =
  "I hereby affirm that following a test drive of the aforementioned vehicle, I am content with its quality and drive. I also confirm that it aligns with the description provided and fulfills its intended purpose suitably. The vehicle's condition corresponds appropriately with its age and mileage.";

export const DOCS_RECEIVED_TEXT =
  "I have received all relevant documents in relation to sale including but not limited (where applicable) to Invoice, Current unexpired MOT certificate along with any advisories, Service papers, warranty documents and vehicle logbook / V62.";

export const GENERAL_SERVICING_TEXT =
  "If you have purchased a Land Rover or a Jaguar, please service it every 5000 miles or 6 months (whichever comes earlier), irrespective of the current mileage of the car in order to maintain the validity of the warranty. All other makes to be serviced at regular intervals which is generally recommended at 6000 miles or every year (whichever comes first). Also, it is recommended to keep a copy of your service record accordingly and maintain the record.";

export const DPF_NOTICE_TEXT =
  "For vehicles equipped with Diesel Particulate Filters (DPFs), it is important to note that short journeys at low speeds are the primary cause of DPF blockages. To ensure optimal performance, it is recommended that drivers allow the DPF to fully regenerate itself when it reaches maximum capacity, indicated by the warning light. This regeneration process is facilitated by passive regeneration during extended motorway journeys, where the exhaust temperature rises to effectively burn off excess soot in the filter. To further assist in DPF maintenance, drivers should regularly undertake sustained 30–50 minute drives at highway or major road speeds. It is imperative to understand that the dealer cannot be held liable if the customer neglects to clear the DPF. (Source: RAC)";

export const SELLER_DECLARATION_TEXT =
  "As a Seller I confirm that all the above information is to the best of my knowledge and vehicle details provided are correct at the time of purchase.";

/** SPEC §3 Section I — three toggleable footer notes (default ON). */
export const FOOTER_NOTES = {
  unitStocking:
    "If the vehicle is on unit stocking, it will be removed in due course upon receipt of full funds and vehicle collection.",
  idRequirement:
    "Drivers Licence / Photo ID to be produced upon collection or delivery - No Hand out without ID.",
  serviceHistory:
    "No service history available unless provided. Previous repair status unknown. Also read notes at the back of this invoice.",
} as const;

/**
 * 14 PDI items in the EXACT column order of the .tex (2 columns × 7 rows):
 * the rendered grid reads left-col row 1..7 then right-col row 1..7.
 */
export const PDI_ITEMS: { key: keyof PreDeliveryCheck; label: string }[] = [
  { key: "engineStarts", label: "Engine Starts & Idles Properly" },
  { key: "engineNoise", label: "Engine Noise is Normal (Cold/Hot & High/Low Speeds)" },
  { key: "transmission", label: "Automatic/Manual Transmission - Operates normally" },
  { key: "noiseNormal", label: "Noise Normal (Cold & Hot)" },
  { key: "clutch", label: "Clutch Operates Properly" },
  { key: "steering", label: "Steers Normally (Response, Centring & Free Play)" },
  { key: "bodyCondition", label: "General Body Condition" },
  { key: "bodySuspension", label: "Body & Suspension (No Squeaks & Rattles)" },
  { key: "brakes", label: "Brakes/ABS Operate Properly" },
  { key: "gauges", label: "Operates normally (Cold & Hot shift) Gauges Operate Properly" },
  { key: "warningLights", label: "No Dashboard Warning Lights" },
  { key: "exhaust", label: "Exhaust Smoke is Normal (Cold & Hot)" },
  { key: "exteriorLights", label: "Exterior Lights & Indicators Work" },
  { key: "serviceLight", label: "Service Light Reset Done" },
];

/** SPEC §3 Section D — 10 add-on categories + default descriptions. */
export const ADDON_CATEGORY_OPTIONS: {
  value: AddonCategory;
  label: string;
  defaultDescription: string;
}[] = [
  { value: "warranty", label: "Warranty", defaultDescription: "3 MONTH COMPREHENSIVE WARRANTY - BACK TO BASE" },
  { value: "home_delivery", label: "Home Delivery", defaultDescription: "HOME DELIVERY" },
  { value: "wash", label: "Wash", defaultDescription: "VEHICLE WASH" },
  { value: "polish", label: "Polish", defaultDescription: "POLISH & DETAIL" },
  { value: "fuel", label: "Fuel", defaultDescription: "FULL TANK OF FUEL" },
  { value: "floor_mats", label: "Floor Mats", defaultDescription: "FLOOR MATS" },
  { value: "service_pack", label: "Service Pack", defaultDescription: "FRESH OIL SERVICE" },
  { value: "paint_protection", label: "Paint Protection", defaultDescription: "PAINT PROTECTION" },
  { value: "accessories", label: "Accessories", defaultDescription: "ACCESSORIES" },
  { value: "custom", label: "Custom", defaultDescription: "" },
];

/** Section G defaults (SPEC §3 Section G). */
export const WARRANTY_DEFAULTS = {
  provider: CAR_CAPITAL_COMPANY.legalName,
  providerPhone: CAR_CAPITAL_COMPANY.warrantyProviderPhone,
  providerEmail: CAR_CAPITAL_COMPANY.warrantyProviderEmail,
  coverType: "Premier" as const,
  claimLimit: 2000,
  diagnosticsCover: 60,
  duration: "3 Months" as const,
  excessPercent: 10,
  wearTearCovered: false,
};

export const FINANCE_PROVIDERS = [
  "Close Brothers",
  "Blue Motor Finance",
  "MotoNovo",
  "JBR Capital",
  "Other",
] as const;
