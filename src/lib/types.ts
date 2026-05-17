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
  address: string;
  vatNumber: string | null;
  logoUrl: string | null;
  stockIdPrefix: string; // "CC" — single-tenant in v1
  nextStockSeq: number;  // monotonic counter for stock IDs (Phase 2)
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
export type SourceType =
  | "auction"
  | "private"
  | "trade_in"
  | "dealer"
  | "other";
export type PurchaseChannel = "vendor" | "supplier" | "g_trader" | "direct";
export type ServiceHistory = "full" | "partial" | "none" | "unknown";
export type FinanceProvider =
  | "next_gear"
  | "close_brothers"
  | "bca"
  | "infinit"
  | "none";

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
  sourceType: SourceType;
  purchaseChannel: PurchaseChannel | null;
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

  // AI-generated hero image (lazy, persisted to public/generated/cars/<id>/hero.png)
  heroImageUrl: string | null;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
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

export interface Listing {
  id: UUID;
  companyId: UUID;
  vehicleId: UUID;
  title: string;
  description: string;
  price: number;
  specialFeatures: string;
  channels: Record<ListingChannel, boolean>;
  atPriceIndicator: "great" | "good" | "above_average" | "unrated";
  status: ListingStatus;
  publishedAt: ISODateTime | null;
  enquiriesCount: number;
  createdAt: ISODateTime;
}

// ============================================================
// LEADS & APPOINTMENTS
// ============================================================

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

export interface Lead {
  id: UUID;
  companyId: UUID;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  vehicleInterest: string;
  vehicleId: UUID | null;
  source: LeadSource;
  status: LeadStatus;
  assignedTo: UUID;
  notes: string | null;
  appointmentId: UUID | null;
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
  createdAt: ISODateTime;
}

// ============================================================
// SALES PIPELINE
// ============================================================

export type SalesStage =
  | "new_lead"
  | "contacted"
  | "test_drive"
  | "offer_made"
  | "deposit_taken"
  | "collection_delivery"
  | "completed_sale"
  | "lost";

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
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type VatScheme = "margin" | "standard" | "zero_rated";
export type InvoiceLineType = "vehicle" | "addon" | "discount" | "fee";

/**
 * Predefined add-on types for the line-item picker on the sales invoice form.
 * Order matches the spec §11.15 dropdown. "custom" lets the user type a free
 * description for one-off line items.
 */
export type AddonType =
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

export type DepositMethod = "cash" | "card" | "bank_transfer";

export interface InvoiceLineItem {
  id: UUID;
  lineType: InvoiceLineType;
  /** Populated when lineType === "addon"; null otherwise. */
  addonType: AddonType | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  /** quantity × unitPrice (signed for discounts). */
  subtotal: number;
  /** VAT for this line, computed against the invoice's vatScheme. */
  vatAmount: number;
}

/**
 * Payment breakdown sub-record — Bass Bhai feedback v4.1.
 * Captures how the customer is paying for a sales invoice: upfront deposit,
 * finance amount via a provider, and the residual balance due by a date.
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

export interface Invoice {
  id: UUID;
  companyId: UUID;
  type: InvoiceType;
  vehicleId: UUID | null;
  /** Legacy name — kept for vendor invoices (purchases). For sales invoices, prefer the buyer* fields. */
  partyName: string;
  partyPhone: string | null;
  partyEmail: string | null;
  /** Sales-invoice buyer fields. Required by the v4.1 PDF template for sales. */
  buyerName: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  buyerAddress: string | null;
  invoiceNumber: string;
  invoiceDate: ISODate;
  dueDate: ISODate | null;
  vatScheme: VatScheme;
  lineItems: InvoiceLineItem[];
  /** Sum of all line subtotals (excl. VAT), signed. */
  subtotal: number;
  /** Sum of subtotals where lineType === "addon". */
  addonsTotal: number;
  /** Sum of subtotals where lineType === "discount" (negative). */
  discountTotal: number;
  /** Sum of all line vatAmounts. Aliases the legacy `vatAmount`. */
  vatAmount: number;
  /** Subtotal + vatAmount. */
  total: number;
  payment: InvoicePayment | null;
  status: InvoiceStatus;
  notes: string | null;
  attachmentUrl: string | null;
  /**
   * Set only on `type === "refund"` invoices. Links the refund back to the
   * `VehicleReturn` that generated it and the original SALE invoice it
   * reverses. Both are nullable because the migration that adds the columns
   * is user-applied — code reads them defensively (see invoice-service).
   */
  relatedReturnId: UUID | null;
  relatedInvoiceId: UUID | null;
  createdAt: ISODateTime;
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
  | "maintenance_job_created"
  | "maintenance_job_completed"
  | "workshop_job_created"
  | "photo_uploaded"
  | "photo_processed"
  | "listing_created"
  | "listing_published"
  | "lead_created"
  | "lead_converted"
  | "appointment_booked"
  | "appointment_updated"
  | "appointment_completed"
  | "sale_stage_changed"
  | "sale_completed"
  | "warranty_created"
  | "warranty_claim_opened"
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "cost_updated"
  | "user_invited"
  | "company_setting_changed";

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
