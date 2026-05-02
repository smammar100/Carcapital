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
  stockIdPrefix: string; // "CC" or "CG"
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
  role: UserRole;
  avatarUrl: string | null;
  active: boolean;
  createdAt: ISODateTime;
}

// ============================================================
// VEHICLES
// ============================================================

export type VehicleStatus =
  | "received"
  | "inspection_pending"
  | "being_prepared"
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

export type WarrantyType = "in_house" | "third_party";
export type WarrantyStatus = "active" | "expired" | "claimed" | "cancelled";

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

export type InvoiceType = "purchase" | "sale";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface InvoiceLineItem {
  id: UUID;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface Invoice {
  id: UUID;
  companyId: UUID;
  type: InvoiceType;
  vehicleId: UUID | null;
  partyName: string;
  partyPhone: string | null;
  partyEmail: string | null;
  invoiceNumber: string;
  invoiceDate: ISODate;
  dueDate: ISODate | null;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  status: InvoiceStatus;
  notes: string | null;
  attachmentUrl: string | null;
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
