// ============================================================
// CORE
// ============================================================

export type UUID = string;
export type ISODate = string;       // "2026-04-22"
export type ISODateTime = string;   // "2026-04-22T14:30:00.000Z"

// ============================================================
// COMPANIES & USERS
// ============================================================

export interface Company {
  id: UUID;
  name: string;
  /** URL-safe dealership identifier — scopes no-email synthetic logins and
   *  resolves the dealership at /login?org=<slug>. Always set on DB-loaded rows;
   *  optional only so demo/mock literals can omit it. */
  slug?: string;
  address: string;
  vatNumber: string | null;
  /** Full logo + wordmark, rendered on invoices. */
  logoUrl: string | null;
  /** Square logo mark, shown in the sidebar (falls back to initials). */
  logoMarkUrl: string | null;
  stockIdPrefix: string; // "CC" — single-tenant in v1
  nextStockSeq: number;  // monotonic counter for stock IDs (Phase 2)
  /** Business day window, "HH:mm" (24h) — drives the Appointment Book grid. */
  workingHoursStart: string;
  workingHoursEnd: string;
}

export type UserRole =
  | "owner"
  | "admin"
  | "inventory_manager"
  | "driver"
  | "inspector"
  | "prep_lead"
  | "sales";

export interface User {
  id: UUID;
  companyId: UUID;
  name: string;
  email: string;
  /**
   * Per-dealership login handle for no-email staff (unique per company). NULL
   * for email-based accounts. Staff with a username never see/use the email —
   * it is an internal synthetic address (see src/lib/auth/username.ts).
   * Always present on DB-loaded rows (string or null); optional only so
   * demo/mock literals can omit it.
   */
  username?: string | null;
  /** Legacy display label only — authority is driven by `roles` + capabilities. */
  role: UserRole;
  /** v4.1 Gap 3 — bypasses every capability check. */
  isSuperUser: boolean;
  /**
   * Stripe-style team roles. Each role is a bundle of granular capabilities
   * defined in `src/lib/roles.ts`. The effective permission set is the
   * UNION across all assigned roles plus any explicit grants in
   * `mockUserPermissions`.
   */
  roles: import("./roles").RoleValue[];
  avatarUrl: string | null;
  active: boolean;
  /** Set when an invitation is sent. Null for users created directly (seeded). */
  invitedAt: ISODateTime | null;
  /** Set when the user accepts the invitation (or on first login for seeded users). */
  acceptedAt: ISODateTime | null;
  /** Most recent login. Null = never logged in. */
  lastLoginAt: ISODateTime | null;
  twoStepEnabled: boolean;
  /** SPEC Point 2 — how the account was created. */
  creationMode: "invite" | "direct";
  /** True for directly-created users until they set their own password. */
  passwordResetRequired: boolean;
  /** When a directly-created user first set their own password. */
  activatedAt: ISODateTime | null;
  /**
   * Seed user shipped with the app (migration 0009 — Chunk 1.5). The wipe
   * step deletes every row with `is_demo = true` before real-staff invites.
   */
  isDemo?: boolean;
  createdAt: ISODateTime;
}

/**
 * Per-user capability grant. v4.1 spec §11.18 + Gap 3 — replaces the legacy
 * role-based authority matrix.
 */
export interface UserPermission {
  id: UUID;
  userId: UUID;
  capability: string; // matches Capability from src/lib/capabilities.ts
  grantedBy: UUID;
  grantedAt: ISODateTime;
}

/**
 * Reusable magic-link a company shares so people can self-join without an
 * email invite. One row per company; "Reset" rotates the token.
 */
export interface TeamJoinLink {
  id: UUID;
  companyId: UUID;
  token: string;
  /** Role new joiners land with — editable later in the permissions grid. */
  defaultRole: import("./roles").RoleValue;
  createdBy: UUID | null;
  createdAt: ISODateTime;
  /** Redemption deadline — Reset refreshes this (+72h). Migration 0033. */
  expiresAt: ISODateTime;
  /** Optional redemption cap (null = uncapped until expiry). */
  maxUses: number | null;
  /** Successful redemptions so far (server-incremented). */
  usedCount: number;
  /** Set when an admin revokes the link without rotating it. */
  revokedAt: ISODateTime | null;
}

// ============================================================
// VEHICLES
// ============================================================

export type VehicleStatus =
  | "received"
  | "inspection_pending"
  | "being_prepared"
  | "photos_pending"
  | "photos_ready"
  | "ready"
  | "listed"
  | "reserved"
  | "sold"
  | "returned";

export type VehicleType = "car" | "van";
export type BodyType =
  | "hatchback"
  | "saloon"
  | "suv"
  | "mpv"
  | "estate"
  | "convertible"
  | "coupe";
export type FuelType = "petrol" | "diesel" | "hybrid" | "electric";
export type Transmission = "automatic" | "manual";
/**
 * Physical location of a vehicle (Spec v3.0 · Module A · Decision D-A2).
 * Exactly one of these at any time; movements between values are audited
 * via the `location_movements` table.
 */
export type VehicleLocation = "forecourt" | "yard" | "garage" | "staff";

export const VEHICLE_LOCATIONS: VehicleLocation[] = [
  "forecourt",
  "yard",
  "garage",
  "staff",
];

export const VEHICLE_LOCATION_LABELS: Record<VehicleLocation, string> = {
  forecourt: "Forecourt",
  yard: "Yard",
  garage: "Garage",
  staff: "Staff",
};

/**
 * Where the dealership *bought* the car (auction / private seller / trade-in
 * / dealer / other). Renamed from `SourceType` in Spec v3.0 — Decision C-1.
 * The legacy name is exported below as an alias so any straggling consumer
 * keeps compiling during the rename pass.
 */
export type PurchaseSource =
  | "auction"
  | "private"
  | "trade_in"
  | "dealer"
  | "other";
/** @deprecated renamed to PurchaseSource — Spec v3.0 Decision C-1. */
export type SourceType = PurchaseSource;
export type PurchaseChannel = "vendor" | "supplier" | "g_trader" | "direct";
export type ServiceHistory = "full" | "partial" | "none" | "unknown";
export type FinanceProvider =
  | "next_gear"
  | "close_brothers"
  | "bca"
  | "infinit"
  | "none";

// ── Custom Fields (SPEC Point 1) ────────────────────────────────────────────
export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "multi_select"
  | "boolean"
  | "currency";

export interface CustomFieldDefinition {
  id: UUID;
  companyId: UUID;
  /** Immutable slug auto-derived from the label at creation. */
  fieldKey: string;
  /** Human-readable, editable. */
  label: string;
  fieldType: CustomFieldType;
  /** For dropdown / multi_select; null otherwise. */
  options: string[] | null;
  required: boolean;
  showInMasterSheet: boolean;
  showInArrivalForm: boolean;
  displayOrder: number;
  createdBy: UUID | null;
  createdAt: ISODateTime;
  /** Soft-delete — archived defs vanish from forms/tables, values persist. */
  archivedAt: ISODateTime | null;
}

/** A per-vehicle custom field value, keyed by `CustomFieldDefinition.fieldKey`. */
export type CustomFieldValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export interface Vehicle {
  id: UUID;
  companyId: UUID;

  // Identity
  registration: string;
  stockId: string;
  tagNumber: string | null;
  make: string;
  model: string;
  variantName: string | null;
  variantCode: string | null;
  year: number;
  colour: string;
  mileage: number;
  vehicleType: VehicleType;
  bodyType: BodyType;
  fuelType: FuelType;
  transmission: Transmission;
  engineSizeCC: number | null;

  // Source & Purchase
  receivedDate: ISODate;
  receivedBy: UUID;
  sellerName: string;
  sellerPhone: string;
  purchaseSource: PurchaseSource;
  purchaseChannel: PurchaseChannel | null;
  /**
   * The dealer partner this vehicle was sourced from (migration 0002).
   * NULL for private-seller / unmatched stock. Read defensively — the
   * column is user-applied so services tolerate its absence.
   */
  supplierId: UUID | null;
  localOrImport: "local" | "import";
  auctionHouse: string | null;
  ownedBy: string | null;
  managedBy: UUID | null;
  invoiceDate: ISODate | null;

  // Documentation
  v5Received: boolean;
  serviceHistory: ServiceHistory;
  numKeys: number;
  lockNut: boolean;
  motExpiry: ISODate | null;
  /** Chassis number — VRM/VIN composite on the sales invoice (DVLA in prod). */
  vin: string | null;
  /** Date of first registration — D.O.R on the sales invoice. */
  firstRegisteredDate: ISODate | null;

  // Purchase Cost Breakdown
  buyingPrice: number;
  vatOnBuyingPrice: number;
  buyersFee: number | null;
  inspectionCharge: number | null;
  collectionFee: number | null;
  deliveryFee: number | null;
  lateStorageFee: number | null;
  otherCharges: number | null;
  totalBuyingPrice: number;

  // Stocking Plan
  financeProvider: FinanceProvider;
  loadingFee: number | null;
  dailyChargeRate: number | null;
  unloadingFee: number | null;
  stockingCharges: number;

  // Preparation
  valueAddition: number;
  warrantyCost: number | null;
  landedCost: number;
  baseCost: number;

  // Pricing
  minimumSalePrice: number | null;
  listingPrice: number | null;
  sellingPrice: number | null;
  dateSold: ISODate | null;
  sellingAgent: string | null;
  grossEarning: number | null;

  // Lifecycle
  status: VehicleStatus;
  /** v4.1 Gap 1 — sold vehicles stay on Work List until this is set. */
  removedFromWebsiteAt: ISODateTime | null;
  daysInStock: number;
  imagesCount: number;
  /**
   * Who owns this car through Prep & Repair (GEN-63). Null is the "Unassigned"
   * lane every car lands in when its inspection completes.
   */
  prepAssignedTo: UUID | null;

  // AI-generated hero image (lazy, persisted to public/generated/cars/<id>/hero.png)
  heroImageUrl: string | null;

  /**
   * Custom field values keyed by CustomFieldDefinition.fieldKey
   * (SPEC Point 1). Defaults to `{}`. Read defensively — the column is
   * user-applied via migration 0003.
   */
  customFields: Record<string, CustomFieldValue>;

  /**
   * Unmapped Excel columns preserved one-way from the master-sheet import
   * (migration 0009 — Decision F-2). Read-only after import.
   */
  legacyData?: Record<string, unknown>;

  // Module A — physical location (migration 0010).
  /** Current physical location. Always set; defaults to 'forecourt'. */
  currentLocation: VehicleLocation;
  /** When the car was placed at `currentLocation`. Updates on every move. */
  locationSince: ISODateTime;
  /**
   * True while a customer is out on a test drive. NOT a location — the car
   * keeps its `currentLocation` while the flag is set (Decision D-A1).
   */
  outForTestDrive: boolean;
  /** Expected return-by time when `outForTestDrive` is true; otherwise null. */
  testDriveExpectedBackAt: ISODateTime | null;

  /**
   * True for the seed cars that ship with the app (migration 0009). Wiped
   * on launch day along with seed leads / appointments / users — Chunk 1.5.
   */
  isDemo?: boolean;

  // ─── DVLA + DVSA compliance fields (migration 0017) ──────────────────
  // Populated by /api/vehicle/lookup. All nullable — DVLA omits euroStatus
  // and automatedVehicle for most cars; DVSA returns 404 for brand-new
  // vehicles that haven't had an MOT yet.
  co2Emissions: number | null;
  euroStatus: string | null;
  taxStatus: string | null;
  taxDueDate: ISODate | null;
  motStatus: string | null;
  wheelplan: string | null;
  automatedVehicle: boolean | null;
  dateOfLastV5CIssued: ISODate | null;

  // ─── AutoTrader taxonomy + valuation (migration 0018) ────────────────
  // Populated by /api/vehicle/lookup from AutoTrader Connect. DVLA leaves
  // model/derivative/generation/trim blank; AutoTrader fills them.
  // Valuations are WHOLE GBP (matching listingPrice), not pence.
  derivative: string | null;
  generation: string | null;
  trim: string | null;
  atDerivativeId: string | null;
  atRetailValuation: number | null;
  atTradeValuation: number | null;
  atPartExchangeValuation: number | null;
  atPrivateValuation: number | null;
  atPriceIndicator: string | null;
  atValuationAt: ISODateTime | null;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * Append-only audit of a vehicle relocation (Spec v3.0 · Module A).
 *
 * `from_location` is null only for the very first placement after arrival;
 * `to_location` is always one of the 4 valid VehicleLocation values.
 * Garage moves carry `externalVendorId`; staff moves carry `staffUserId`
 * (DB-level CHECK constraints in migration 0010).
 */
export interface LocationMovement {
  id: UUID;
  vehicleId: UUID;
  fromLocation: VehicleLocation | null;
  toLocation: VehicleLocation;

  /** Populated only when `toLocation === 'garage'`. */
  externalVendorId: UUID | null;
  /** Populated only when `toLocation === 'staff'`. */
  staffUserId: UUID | null;

  /** Optional everywhere; required (UI-enforced) for garage/staff moves. */
  expectedReturnAt: ISODateTime | null;
  /** Set when the car is marked returned. */
  actualReturnAt: ISODateTime | null;

  notes: string | null;
  createdBy: UUID;
  createdAt: ISODateTime;
}

export interface VehiclePhoto {
  id: UUID;
  vehicleId: UUID;
  url: string;
  processedUrl: string | null;
  composedUrl: string | null;
  backgroundProcessed: boolean;
  selectedBackground: string | null;
  order: number;
  uploadedBy: UUID;
  uploadedAt: ISODateTime;
}

// ============================================================
// THINGS TO DO
// ============================================================

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TodoSource = "manual" | "inspection";

export interface TodoItem {
  id: UUID;
  vehicleId: UUID;
  serialNumber: number;
  description: string;
  vendorId: UUID | null;
  status: TodoStatus;
  cost: number | null;
  source: TodoSource;
  createdBy: UUID;
  completedBy: UUID | null;
  completedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

// ============================================================
// INSPECTION
// ============================================================

export interface InspectionCheck {
  id: UUID;
  vehicleId: UUID;
  checkNumber: number;
  checkItem: string;
  status: string;
  actionRequired: string | null;
  carriedOutBy: UUID;
  carriedOutDate: ISODate;
  createdAt: ISODateTime;
}

/**
 * A configurable checklist point (GEN-78). `number` is the stable identity
 * that `InspectionCheck.checkNumber` stores — it's assigned once and never
 * reused, independent of `sortOrder` which the Settings screen reorders.
 */
export interface InspectionChecklistItem {
  id: UUID;
  companyId: UUID;
  number: number;
  item: string;
  statusOptions: string[];
  sortOrder: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Inspection notes — v4.1 §11.5 / Gap 4. Append-only sub-entity. */
export interface InspectionNote {
  id: UUID;
  vehicleId: UUID;
  userId: UUID;
  content: string;
  createdAt: ISODateTime;
}

/** Workshop / maintenance job note types — v4.1 §11.7 / Gap 5. */
export type JobNoteType = "note" | "call_log" | "status_update" | "vendor_update";

export interface MaintenanceJobNote {
  id: UUID;
  jobId: UUID;
  userId: UUID;
  noteType: JobNoteType;
  content: string;
  createdAt: ISODateTime;
}

// ============================================================
// VENDORS
// ============================================================

export type VendorSpeciality =
  | "mechanical"
  | "electrical"
  | "bodywork"
  | "tyres"
  | "mot"
  | "general";

export interface Vendor {
  id: UUID;
  companyId: UUID;
  name: string;
  phone: string;
  speciality: VendorSpeciality;
  active: boolean;
}

/**
 * A trade partner who supplies stock to sell (migration 0002). Distinct
 * from `Vendor` (service garages) — different lifecycle and payment flow.
 */
export interface DealerPartner {
  id: UUID;
  companyId: UUID;
  /** Primary contact person. */
  name: string;
  phone: string | null;
  companyName: string | null;
  /** SPEC Points 6/7 — richer contact detail (migration 0005, nullable). */
  email: string | null;
  companyAddress: string | null;
  vatNumber: string | null;
  notes: string | null;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ============================================================
// MAINTENANCE & WORKSHOP
// ============================================================

export type MaintenanceStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "stalled";

export interface MaintenanceJob {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  description: string;
  assignedTo: UUID | null;
  vendorId: UUID | null;
  estimatedCost: number | null;
  actualCost: number | null;
  estimatedDurationHours: number | null;
  startDate: ISODate | null;
  dueDate: ISODate | null;
  completedDate: ISODate | null;
  status: MaintenanceStatus;
  notes: string | null;
  createdAt: ISODateTime;
}

export interface WorkshopJob {
  id: UUID;
  companyId: UUID;
  customerName: string;
  customerPhone: string;
  vehicleReg: string;
  vehicleDescription: string;
  description: string;
  assignedTo: UUID | null;
  estimatedCost: number | null;
  actualCost: number | null;
  scheduledDate: ISODate;
  scheduledTime: string;
  completedDate: ISODate | null;
  status: MaintenanceStatus;
  notes: string | null;
  createdAt: ISODateTime;
}

// ============================================================
// LISTINGS / ADVERTS
// ============================================================

export type ListingStatus = "draft" | "live" | "reserved" | "sold" | "archived";
export type ListingChannel = "website" | "autotrader" | "ebay" | "facebook";

/**
 * Rich AutoTrader/website advert fields composed in the Advert tool. Stored as
 * a single `advert_data` jsonb column (migration 0021) so the model can grow
 * without a migration per field. Everything is optional / defaulted — an empty
 * `{}` is a valid, unfilled advert.
 */
export interface AdvertData {
  /** AutoTrader "Attention Grabber" (max 30 chars). */
  attentionGrabber: string;
  /** AutoTrader "Key Selling Point" (max 35 chars). */
  keySellingPoint: string;
  /** Dealer strapline shown beneath the description (max 999). */
  strapline: string;
  /** Website vehicle subtitle (max 500). */
  subtitle: string;
  /** Up to 5 short website highlight bullets (max 40 chars each). */
  highlights: string[];
  /** Selected equipment/feature names (from the feature catalogue). */
  features: string[];
  /** AutoTrader taxonomy overrides; blank fields fall back to the vehicle. */
  taxonomy: {
    make?: string;
    model?: string;
    generation?: string;
    trim?: string;
    derivative?: string;
    fuelType?: string;
    engineSize?: string;
    transmission?: string;
  };
}

export const EMPTY_ADVERT_DATA: AdvertData = {
  attentionGrabber: "",
  keySellingPoint: "",
  strapline: "",
  subtitle: "",
  highlights: [],
  features: [],
  taxonomy: {},
};

export interface Listing {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  title: string;
  description: string;
  price: number;
  specialFeatures: string;
  channels: Record<ListingChannel, boolean>;
  atPriceIndicator: "great" | "good" | "above_average" | "high" | "unrated";
  status: ListingStatus;
  publishedAt: ISODateTime | null;
  enquiriesCount: number;
  // ─── AutoTrader stock publish (migration 0019) ───────────────────────
  /** AutoTrader Stock ID once published via POST /stock; null until then. */
  atStockId: string | null;
  /** AutoTrader advertising lifecycle: not_published | published. */
  atAdvertisingStatus: "not_published" | "published" | null;
  atLastSyncedAt: ISODateTime | null;
  atLastError: string | null;
  // ─── Rich advert composer (migration 0021) ──────────────────────────
  /** AutoTrader/website advert fields composed in the Advert tool. */
  advertData: AdvertData;
  createdAt: ISODateTime;
}

// ============================================================
// LEADS & APPOINTMENTS
// ============================================================

/**
 * Legacy lead-source enum. Superseded by the dynamic `LeadChannel`
 * catalogue (migration 0009 — Decision C-2). Kept for backfill / audit
 * and as the column shape until every consumer is migrated.
 */
export type LeadSource =
  | "website"
  | "phone"
  | "walk_in"
  | "autotrader"
  | "ebay"
  | "facebook"
  | "referral"
  | "other";
export type LeadStatus =
  | "new"
  | "contacted"
  | "appointment_booked"
  | "lost";

/**
 * Where the buyer came from (per-company catalogue, migration 0009).
 * Seeded with 9 system rows; Super User can add / rename / disable from
 * /admin/settings/lead-channels (Chunk 3.4 — Decision C-2).
 */
export interface LeadChannel {
  id: UUID;
  companyId: UUID;
  /** Stable identifier used in code + URLs (lowercase snake_case). */
  slug: string;
  /** Human label shown in dropdowns. */
  label: string;
  /** Display order in dropdowns + admin grid. */
  sortOrder: number;
  /** Disabled channels stay in the data but vanish from dropdowns. */
  enabled: boolean;
  /** System rows can be disabled but not deleted. */
  isSystem: boolean;
  /**
   * Hex colour for the chip on Lead Detail + the dot on Sales Pipeline
   * cards (Spec v3.0 · Module C). Always set; defaults to neutral grey
   * for legacy rows pre-0013.
   */
  colour: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Lead {
  id: UUID;
  companyId: UUID;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  vehicleInterest: string;
  vehicleId: UUID | null;
  source: LeadSource;
  /**
   * FK to lead_channels (migration 0009). Replaces the free-text `source`
   * field over time — Module C. Optional during rollout so existing
   * call-sites and seed data keep compiling; the 0009 backfill populates
   * the column from `source` for every existing row.
   */
  leadChannelId?: UUID | null;
  status: LeadStatus;
  assignedTo: UUID;
  notes: string | null;
  appointmentId: UUID | null;
  /** Seed lead — wiped on launch day (Chunk 1.5). */
  isDemo?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type AppointmentStatus =
  | "upcoming"
  | "completed"
  | "cancelled"
  | "no_show";
export type AppointmentOutcome =
  | "pending"
  | "test_drive"
  | "offer_made"
  | "deposit_taken"
  | "sold"
  | "lost";

export interface Appointment {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  leadId: UUID | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: ISODate;
  time: string;
  specialRequirements: string | null;
  status: AppointmentStatus;
  outcome: AppointmentOutcome;
  notificationsSent: { whatsapp: boolean; email: boolean };
  createdBy: UUID;
  /** Seed appointment — wiped on launch day (Chunk 1.5). */
  isDemo?: boolean;
  createdAt: ISODateTime;
}

// ============================================================
// SALES PIPELINE
// ============================================================

/**
 * The stages the app ships with. Kept as a union because the service layer
 * still reasons about these specific slugs (seeding, fallbacks) — but a deal's
 * stage is NOT limited to them: companies rename, reorder, add and remove
 * stages from Settings (GEN-65).
 */
export type BuiltInSalesStage =
  | "new_lead"
  | "contacted"
  | "test_drive"
  | "deposit_taken"
  | "collection_delivery"
  | "completed_sale"
  | "lost";

/** A `pipeline_stages.slug` for the deal's company. */
export type SalesStage = string;

/**
 * What the app does when a deal enters a stage. Side effects hang off this,
 * not off the slug, so a renamed stage keeps working and a user-added one can
 * opt into reserving the car.
 */
export type StageBehaviour = "open" | "reserved" | "won" | "lost";

/** A configurable column on the sales pipeline board (migration 0038). */
export interface PipelineStage {
  id: UUID;
  companyId: UUID;
  /** Stable identifier stored on deals. Never changes once created. */
  slug: string;
  /** Human label on the board and in dropdowns. Freely renameable. */
  label: string;
  sortOrder: number;
  /** Disabled stages vanish from the board but keep their deals readable. */
  enabled: boolean;
  behaviour: StageBehaviour;
  /** Seeded stages the app's own logic depends on — renameable, not deletable. */
  isSystem: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SalesDeal {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  leadId: UUID | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  stage: SalesStage;
  offerPrice: number | null;
  agreedPrice: number | null;
  depositAmount: number | null;
  depositDate: ISODate | null;
  collectionDate: ISODate | null;
  completionDate: ISODate | null;
  sellingAgent: UUID;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * Timestamped, attributed note on a sales deal (GEN-74) — append-only, same
 * shape as InspectionNote. `SalesDeal.notes` (a single flat text field) is
 * the pre-existing free-text column and is unrelated to this log.
 */
export interface DealNote {
  id: UUID;
  dealId: UUID;
  userId: UUID;
  content: string;
  createdAt: ISODateTime;
}

// ============================================================
// WARRANTIES & CLAIMS
// ============================================================

export type WarrantyType = "in_house" | "external";
// v4.1: "claimed" removed — derived from claims with status in (open, under_review).
// See /warranties/claims for the live filter.
export type WarrantyStatus = "active" | "expired" | "cancelled";

/**
 * Gap 4 — external warranties have a purchase lifecycle independent of the
 * warranty itself. In-house warranties (`type === 'in_house'`) always carry
 * `n_a`; external warranties default to `pending` and flip to `purchased`
 * once the dealership has bought the cover from the provider.
 */
export type WarrantyPurchaseStatus = "n_a" | "pending" | "purchased";

export interface Warranty {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  saleDealId: UUID | null;
  /** Sales invoice that issued this cover, when it came from one (GEN-66). */
  invoiceId: UUID | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  type: WarrantyType;
  provider: string | null;
  coverageDetails: string;
  startDate: ISODate;
  endDate: ISODate;
  costToDealership: number;
  costToCustomer: number;
  /** Actual amount paid to the external provider at purchase (≠ cost_to_dealership). */
  amountPaid: number | null;
  status: WarrantyStatus;
  /** Gap 4 — purchase tracker. `n_a` for in-house, `pending`/`purchased` for external. */
  purchaseStatus: WarrantyPurchaseStatus;
  /** Set when the dealership marks the external warranty as bought from the provider. */
  purchasedAt: ISODateTime | null;
  purchasedBy: UUID | null;
  /** Provider's policy / reference number once the purchase is logged. */
  providerReference: string | null;
  certificateGenerated: boolean;
  createdAt: ISODateTime;
}

export type ClaimStatus =
  | "open"
  | "under_review"
  | "approved"
  | "resolved"
  | "rejected";

export interface WarrantyClaim {
  id: UUID;
  warrantyId: UUID;
  vehicleId: UUID;
  companyId: UUID;
  customerName: string;
  issueDescription: string;
  isComplaint: boolean;
  estimatedCost: number | null;
  actualCost: number | null;
  status: ClaimStatus;
  resolution: string | null;
  createdAt: ISODateTime;
  resolvedAt: ISODateTime | null;
}

// ============================================================
// INVOICES
// ============================================================

export type InvoiceType = "purchase" | "sale" | "refund";
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "issued"
  | "cancelled";

/** SPEC_Invoicing_Module §3 Section F — new VAT scheme enum. */
export type VatScheme = "margin_used" | "standard_20" | "zero_rated";
/** Pre-spec values still present on existing rows; mapped at the edges. */
export type LegacyVatScheme = "margin" | "standard" | "zero_rated";

/** Legacy line grouping (purchases / refunds / external uploads still use it). */
export type InvoiceLineType = "vehicle" | "addon" | "discount" | "fee";
/** SPEC §3 Section D / §5 — sales-invoice line item type. */
export type InvoiceLineItemType =
  | "vehicle_price"
  | "discount"
  | "addon_paid"
  | "addon_free";

/**
 * Add-on dropdown categories (SPEC §3 Section D — 10 types). Identical value
 * set to the legacy `AddonType`; `AddonType` is kept as an alias so existing
 * code keeps compiling.
 */
export type AddonCategory =
  | "warranty"
  | "home_delivery"
  | "wash"
  | "polish"
  | "fuel"
  | "floor_mats"
  | "service_pack"
  | "paint_protection"
  | "accessories"
  | "custom";
export type AddonType = AddonCategory;

export type DepositMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "cheque"
  | "pdq";

export interface InvoiceLineItem {
  id: UUID;
  /** SPEC line item type. */
  type: InvoiceLineItemType;
  description: string;
  /** Set for addon_paid / addon_free; null for vehicle_price / discount. */
  addonCategory: AddonCategory | null;
  quantity: number;
  unitPrice: number;
  /** quantity × unitPrice (0 for addon_free). */
  total: number;
  /** VAT for this line (0 under margin_used). */
  vatAmount: number;
  // ---- Legacy aliases (kept so the invoicing list / refund flow compile) ----
  /** @deprecated use `type`. vehicle_price→vehicle, addon_*→addon. */
  lineType?: InvoiceLineType;
  /** @deprecated use `addonCategory`. */
  addonType?: AddonType | null;
  /** @deprecated alias of `total`. */
  subtotal?: number;
  /** @deprecated legacy per-line VAT rate. */
  vatRate?: number;
}

/** SPEC §3 Section G / §5 — warranty declaration (Page 2 top). */
export interface WarrantyDeclaration {
  /**
   * Who stands behind the cover — Car Capital ("in_house") or a third party
   * ("external"). Drives which Warranties tab the record lands in and whether
   * it needs purchasing from a provider (GEN-66). Legacy invoices saved before
   * this field existed read as "in_house", which is what they were.
   */
  type?: WarrantyType;
  provider: string;
  providerPhone: string;
  providerEmail: string;
  coverType: "Basic" | "Standard" | "Premier" | "Comprehensive";
  claimLimit: number;
  diagnosticsCover: number;
  duration: "1 Month" | "3 Months" | "6 Months" | "12 Months";
  excessPercent: number;
  wearTearCovered: boolean;
}

/** SPEC §3 Section H / §5 — 14-item pre-delivery check + documents row. */
export interface PreDeliveryCheck {
  engineStarts: boolean;
  engineNoise: boolean;
  transmission: boolean;
  noiseNormal: boolean;
  clutch: boolean;
  steering: boolean;
  bodyCondition: boolean;
  bodySuspension: boolean;
  brakes: boolean;
  gauges: boolean;
  warningLights: boolean;
  exhaust: boolean;
  exteriorLights: boolean;
  serviceLight: boolean;
  // Documents & records
  lockNut: boolean;
  numKeys: number;
  serviceHistoryStatus: string;
  engineServiceDoneDate: ISODate | null;
  engineServiceDoneMileage: number | null;
  v5Status: "V5C-2 Green Slip" | "V5C — Awaited" | "Not Received";
  hpiCheckResult: "Clear" | "Issues Found" | "Pending" | "Not Performed";
}

/**
 * Payment breakdown sub-record. Captures how the customer is paying for a
 * sales invoice: upfront deposit, finance amount via a provider, and the
 * residual balance due by a date. (Mirrored onto Invoice.* columns too.)
 */
export interface InvoicePayment {
  id: UUID;
  invoiceId: UUID;
  depositAmount: number;
  depositMethod: DepositMethod | null;
  financeAmount: number;
  financeProvider: string | null;
  /** Auto-derived: grandTotal − depositAmount − financeAmount. */
  balanceDue: number;
  balanceDueBy: ISODate | null;
}

/**
 * Invoice — compatibility superset. The new sales path populates the SPEC
 * fields; the legacy fields (`partyName`, `subtotal`, `total`, `vatAmount`,
 * `relatedReturnId`, …) are retained and synthesised by invoice-service so
 * the invoicing list, the vehicle-returns refund flow, and the VAT summary
 * keep working untouched.
 */
export interface Invoice {
  id: UUID;
  companyId: UUID;
  type: InvoiceType;
  vehicleId: UUID | null;
  /** Legacy — vendor/purchase invoices. Sales invoices use buyer* fields. */
  partyName: string;
  partyPhone: string | null;
  partyEmail: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  /** Street + town (SPEC `buyerAddressLine`). Alias of legacy buyerAddress. */
  buyerAddress: string | null;
  buyerPostcode: string | null;
  invoiceNumber: string;
  invoiceDate: ISODate;
  dueDate: ISODate | null;
  vatScheme: VatScheme;
  lineItems: InvoiceLineItem[];

  // SPEC §3 Section C — vehicle identity snapshot
  presentMileage: number | null;
  dorDate: ISODate | null;

  // SPEC §6 totals (persisted, immutable)
  salesPrice: number;
  discount: number;
  paidAddonsTotal: number;
  /** Subtotal − discount + paid add-ons + VAT. Alias of legacy `total`. */
  grandTotalInclAddons: number;

  // SPEC §3 Section E — payment
  depositAmount: number;
  depositReceivedDate: ISODate | null;
  depositMethod: DepositMethod | null;
  financeAmount: number;
  financeProvider: string | null;
  balanceDue: number;
  balanceDueBy: ISODate | null;

  // SPEC §3 Sections G/H
  warranty: WarrantyDeclaration | null;
  nonWarrantyDisclaimerAccepted: boolean;
  preDeliveryCheck: PreDeliveryCheck | null;

  // SPEC §3 Section I — footer notes
  includeUnitStockingNote: boolean;
  includeIdRequirementNote: boolean;
  includeServiceHistoryNote: boolean;
  customNote: string | null;

  // ---- Legacy totals/links (kept; synthesised by invoice-service) ----
  subtotal: number;
  addonsTotal: number;
  discountTotal: number;
  vatAmount: number;
  total: number;
  payment: InvoicePayment | null;
  status: InvoiceStatus;
  notes: string | null;
  attachmentUrl: string | null;
  relatedReturnId: UUID | null;
  relatedInvoiceId: UUID | null;
  saleId: UUID | null;
  createdBy: UUID | null;
  issuedAt: ISODateTime | null;
  /** Seed invoice — wiped on launch day (Chunk 1.5). */
  isDemo?: boolean;
  createdAt: ISODateTime;
}

// ============================================================
// EXTERNAL / PURCHASE INVOICES (Spec v3.0 · Module D)
// ============================================================

/** Inbound invoice the dealership receives. */
export type InvoiceKind = "auction_purchase" | "external_job";

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  auction_purchase: "Auction purchase",
  external_job: "External job",
};

export interface ExternalInvoice {
  id: UUID;
  invoiceKind: InvoiceKind;
  /** Vendor's invoice reference (BCA-style). Optional / often blank. */
  invoiceNumber: string | null;
  vendorId: UUID;
  vehicleId: UUID;
  invoiceDate: ISODate;
  /** Money in pence (matches the existing legal-invoice convention). */
  totalPence: number;
  vatPence: number;
  /** Generated column in DB (total − vat); always present on read. */
  preVatPence: number;
  description: string;
  notes: string | null;
  /** Auction-purchase only — the vehicle's previous registered keeper. */
  previousOwner: string | null;
  /** Auction-purchase only — reference to the service history pack supplied. */
  serviceHistoryRef: string | null;
  attachmentUrl: string | null;
  attachmentFilename: string | null;
  attachmentSizeBytes: number | null;
  attachmentMimeType: string | null;
  createdBy: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ============================================================
// VEHICLE RETURNS
// ============================================================

export type ReturnResolutionPath =
  | "vendor"
  | "supplier"
  | "g_trader"
  | "other";
export type ReturnStatus =
  | "pending"
  | "in_review"
  | "resolved"
  | "rejected";

/** SPEC Point 3 — structured return reason (free-text `reason` = detail). */
export type ReturnReason =
  | "mechanical_fault"
  | "misrepresentation"
  | "finance_failure"
  | "customer_change_of_mind"
  | "cooling_off_period"
  | "other";

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  mechanical_fault: "Mechanical Fault",
  misrepresentation: "Misrepresentation",
  finance_failure: "Finance Failure",
  customer_change_of_mind: "Customer Change of Mind",
  cooling_off_period: "Cooling-off Period",
  other: "Other",
};

export interface VehicleReturn {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  saleDealId: UUID | null;
  customerName: string;
  customerPhone: string;
  returnDate: ISODate;
  reason: string;
  resolutionPath: ReturnResolutionPath;
  resolutionNotes: string | null;
  refundAmount: number | null;
  status: ReturnStatus;
  /**
   * The original SALE invoice this return reverses, auto-fetched by
   * registration when the return is created. NULL when no sale invoice was
   * on file (manual-entry fallback). Columns are user-applied via migration
   * 0001 — services read these defensively.
   */
  originalInvoiceId: UUID | null;
  /** UK domestic refund bank block — where the refund is paid back to. */
  refundBankAccountName: string | null;
  refundSortCode: string | null;
  refundAccountNumber: string | null;
  refundBankName: string | null;
  /** Structured reason category (migration 0006; `reason` = the detail). */
  reasonCode: ReturnReason | null;
  createdAt: ISODateTime;
  resolvedAt: ISODateTime | null;
}

// ============================================================
// ACTIVITY LOG
// ============================================================

export type ActivityActionType =
  | "vehicle_arrived"
  | "vehicle_status_changed"
  | "vehicle_returned"
  | "inspection_started"
  | "inspection_completed"
  | "todo_added"
  | "todo_completed"
  | "prep_assigned"
  | "maintenance_job_created"
  | "maintenance_job_completed"
  | "workshop_job_created"
  | "photo_uploaded"
  | "photo_processed"
  | "listing_created"
  | "listing_published"
  | "listing_deleted"
  | "lead_created"
  | "lead_converted"
  | "lead_status_changed"
  | "appointment_booked"
  | "appointment_updated"
  | "appointment_completed"
  | "sale_stage_changed"
  | "sale_completed"
  | "warranty_created"
  | "warranty_purchased"
  | "warranty_cancelled"
  | "warranty_claim_opened"
  | "return_resolved"
  | "return_rejected"
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "cost_updated"
  | "user_invited"
  | "company_setting_changed"
  | "channel_changed"
  | "data_migrated"
  | "vehicle_moved"
  | "external_invoice_created"
  | "external_invoice_updated"
  | "external_invoice_deleted"
  | "deal_note_added";

export interface ActivityLogEntry {
  id: UUID;
  companyId: UUID;
  userId: UUID;
  vehicleId: UUID | null;
  actionType: ActivityActionType;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: ISODateTime;
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export type NotificationType = "info" | "warning" | "success" | "urgent";

export interface Notification {
  id: UUID;
  companyId: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: ISODateTime;
}

// ============================================================
// CUSTOMERS & ENQUIRIES (v4.2 customer-first lead capture)
// ============================================================

/**
 * v4.2 — leads attach to a Customer record, deduped on phone / email /
 * postcode so repeat buyers and trade-in customers stay connected across
 * vehicles. See `src/lib/services/customer-service.ts` for the search +
 * findOrCreate flow.
 */
export interface Customer {
  id: UUID;
  companyId: UUID;
  title: string | null;          // "Mr", "Ms", etc. — optional
  firstName: string;
  lastName: string;
  companyName: string | null;    // B2B / trade buyers only
  email: string | null;          // stored lowercased
  homePhone: string | null;
  mobilePhone: string | null;
  postcode: string | null;
  addressLines: string[];        // up to 4 lines (number+street, area, town, county)
  marketingConsent: boolean;
  notes: string | null;
  /** First-touch source — denormalised for fast Lost-Reason reporting later. */
  sourceOrigin: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** EnquirySource — full curated list lives in `src/lib/enquiry-constants.ts`. */
export type EnquirySource = string;

/** Active enquiry-type values — see `ENQUIRY_TYPES_ACTIVE` for the labels. */
export type EnquiryActiveType =
  | "cash"
  | "finance"
  | "test_drive"
  | "trade"
  | "web_enquiry"
  | "phone"
  | "whatsapp"
  | "walk_on"
  | "workshop"
  | "hot_lead";

export type LostReason =
  | "price"
  | "vehicle_sold"
  | "finance"
  | "contact"
  | "px"
  | "product"
  | "people"
  | "purchased"
  | "duplicate";

/** Either an active type or `lost_<reason>`. */
export type EnquiryType = EnquiryActiveType | `lost_${LostReason}`;

export type EnquiryStatus = "open" | "won" | "lost";

export interface Enquiry {
  id: UUID;
  companyId: UUID;
  customerId: UUID;
  /** Nullable — enquiries can exist before a vehicle of interest is picked. */
  vehicleId: UUID | null;
  source: EnquirySource;
  type: EnquiryType;
  status: EnquiryStatus;
  /** Set when `type` is one of `lost_<reason>` — auto-derived on insert. */
  lostReason: LostReason | null;
  salespersonId: UUID;
  financeInterest: boolean;
  nextActionDueAt: ISODateTime | null;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface EnquiryHistoryEntry {
  id: UUID;
  enquiryId: UUID;
  actorId: UUID;
  fromStatus: EnquiryStatus | null;
  toStatus: EnquiryStatus;
  note: string | null;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// AutoTrader Connect — Advertisers (dealers configured on the integration)
// ---------------------------------------------------------------------------
/**
 * A dealer (advertiser) returned by the AutoTrader Advertisers API. Field
 * names normalise AutoTrader's raw shape — `raw` keeps the full payload so we
 * never lose data we haven't surfaced yet. Confirm raw field names against a
 * live response (scripts/autotrader-advertisers-probe.mjs).
 */
export interface Advertiser {
  advertiserId: string;
  name: string | null;
  status: string | null;
  postcode: string | null;
  products: string[];
  raw: Record<string, unknown>;
}

/** A row in our `at_advertisers` mirror table (camelCase view). */
export interface AdvertiserRecord extends Advertiser {
  /** Last time we pulled this advertiser from the Advertisers API. */
  syncedAt: ISODateTime | null;
  /** Last time an ADVERTISER update notification touched this row. */
  atUpdatedAt: ISODateTime | null;
}
