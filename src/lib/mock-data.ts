/**
 * Single source of seed data. Services read from these arrays.
 * UI code MUST NOT import from this file directly — use services.
 *
 * The migration tool will eventually read these arrays and write to Supabase.
 * Keep this file flat and serializable — local helpers are fine, runtime
 * dependencies on other modules are not.
 */

import type {
  ActivityLogEntry,
  Appointment,
  Company,
  Customer,
  Enquiry,
  InspectionNote,
  Invoice,
  InvoiceLineItem,
  InvoiceLineType,
  InvoiceLineItemType,
  InvoiceType,
  InvoiceStatus,
  InvoicePayment,
  AddonType,
  VatScheme,
  LegacyVatScheme,
  Lead,
  LeadChannel,
  Listing,
  LocationMovement,
  MaintenanceJob,
  MaintenanceJobNote,
  Notification,
  SalesDeal,
  TodoItem,
  User,
  UserPermission,
  Vehicle,
  VehicleReturn,
  Vendor,
  Warranty,
  WarrantyClaim,
  WorkshopJob,
} from "./types";
import type { Capability } from "./capabilities";

// ---- Date helpers (file-local) ----
const TODAY = "2026-05-01";
const NOW = "2026-05-01T09:00:00.000Z";

function daysAgo(n: number): string {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function hoursAgo(n: number): string {
  const d = new Date(NOW);
  d.setUTCHours(d.getUTCHours() - n);
  return d.toISOString();
}

function inDays(n: number): string {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// COMPANIES
// ============================================================

export const mockCompanies: Company[] = [
  {
    id: "company-1",
    name: "Car Capital UK",
    address: "220 Uxbridge Rd, Southall, UB1 3DZ",
    vatNumber: "GB123456789",
    logoUrl: null,
    stockIdPrefix: "CC",
    nextStockSeq: 115,
  },
];

// ============================================================
// USERS
// ============================================================

export const mockUsers: User[] = [
  {
    id: "user-1",
    companyId: "company-1",
    name: "Abbas Bhai",
    email: "abbas@carcapital.uk",
    role: "owner",
    avatarUrl: null,
    isSuperUser: true,
    roles: ["owner"],
    invitedAt: null,
    acceptedAt: "2024-01-15T09:00:00.000Z",
    lastLoginAt: NOW,
    twoStepEnabled: true, creationMode: "invite", passwordResetRequired: false, activatedAt: null,
    active: true,
    createdAt: "2024-01-15T09:00:00.000Z",
  },
  {
    id: "user-2",
    companyId: "company-1",
    name: "Amjad Bhai",
    email: "amjad@carcapital.uk",
    role: "inventory_manager",
    avatarUrl: null,
    isSuperUser: false,
    roles: ["inventory_manager"],
    invitedAt: "2024-02-01T09:00:00.000Z",
    acceptedAt: "2024-02-02T11:00:00.000Z",
    lastLoginAt: hoursAgo(6),
    twoStepEnabled: true, creationMode: "invite", passwordResetRequired: false, activatedAt: null,
    active: true,
    createdAt: "2024-02-01T09:00:00.000Z",
  },
  {
    id: "user-3",
    companyId: "company-1",
    name: "Raza",
    email: "raza@carcapital.uk",
    role: "driver",
    avatarUrl: null,
    isSuperUser: false,
    roles: ["driver"],
    invitedAt: "2024-03-01T09:00:00.000Z",
    acceptedAt: "2024-03-02T11:00:00.000Z",
    lastLoginAt: daysAgo(2) + "T08:00:00.000Z",
    twoStepEnabled: false, creationMode: "invite", passwordResetRequired: false, activatedAt: null,
    active: true,
    createdAt: "2024-03-01T09:00:00.000Z",
  },
  {
    id: "user-4",
    companyId: "company-1",
    name: "Mohsin",
    email: "mohsin@carcapital.uk",
    role: "driver",
    avatarUrl: null,
    isSuperUser: false,
    roles: ["driver"],
    invitedAt: "2024-03-15T09:00:00.000Z",
    acceptedAt: "2024-03-15T15:00:00.000Z",
    lastLoginAt: daysAgo(5) + "T09:00:00.000Z",
    twoStepEnabled: false, creationMode: "invite", passwordResetRequired: false, activatedAt: null,
    active: true,
    createdAt: "2024-03-15T09:00:00.000Z",
  },
  {
    id: "user-5",
    companyId: "company-1",
    name: "Kami",
    email: "kami@carcapital.uk",
    role: "inspector",
    avatarUrl: null,
    isSuperUser: false,
    roles: ["inspector"],
    invitedAt: "2024-04-01T09:00:00.000Z",
    acceptedAt: "2024-04-02T10:00:00.000Z",
    lastLoginAt: hoursAgo(28),
    twoStepEnabled: false, creationMode: "invite", passwordResetRequired: false, activatedAt: null,
    active: true,
    createdAt: "2024-04-01T09:00:00.000Z",
  },
  {
    id: "user-6",
    companyId: "company-1",
    name: "Sikander",
    email: "sikander@carcapital.uk",
    role: "sales",
    avatarUrl: null,
    isSuperUser: false,
    roles: ["sales_manager"],
    invitedAt: "2024-04-15T09:00:00.000Z",
    acceptedAt: "2024-04-15T14:00:00.000Z",
    lastLoginAt: hoursAgo(2),
    twoStepEnabled: true, creationMode: "invite", passwordResetRequired: false, activatedAt: null,
    active: true,
    createdAt: "2024-04-15T09:00:00.000Z",
  },
  {
    id: "user-7",
    companyId: "company-1",
    name: "Shan Bhai",
    email: "shan@carcapital.uk",
    role: "prep_lead",
    avatarUrl: null,
    isSuperUser: false,
    roles: ["workshop_lead"],
    invitedAt: "2024-05-01T09:00:00.000Z",
    acceptedAt: "2024-05-02T09:00:00.000Z",
    lastLoginAt: hoursAgo(12),
    twoStepEnabled: false, creationMode: "invite", passwordResetRequired: false, activatedAt: null,
    active: true,
    createdAt: "2024-05-01T09:00:00.000Z",
  },
];

// ============================================================
// USER PERMISSIONS — v4.1 Gap 3 capability grid
// ============================================================
// Abbas (user-1) is super-user — granted automatically via isSuperUser, no rows needed.
// Other users get capability sets that loosely mirror their legacy role label
// so the demo behaves intuitively before an admin tweaks the grid.

function grants(userId: string, caps: Capability[]): UserPermission[] {
  return caps.map((c, i) => ({
    id: `perm-${userId}-${i + 1}`,
    userId,
    capability: c,
    grantedBy: "user-1",
    grantedAt: "2024-06-01T09:00:00.000Z",
  }));
}

// Inspection notes (Phase 5 / Gap 4) — append-only sub-entity per vehicle.
export const mockInspectionNotes: InspectionNote[] = [];

// Maintenance job notes (Phase 5 / Gap 5) — call_log / status_update / vendor_update / note.
export const mockMaintenanceJobNotes: MaintenanceJobNote[] = [];

export const mockUserPermissions: UserPermission[] = [
  // user-2 Amjad — Inventory Manager
  ...grants("user-2", [
    "inventory:add",
    "inventory:edit",
    "inventory:edit_costs",
    "maintenance:create",
    "photos:process",
    "advert:create",
    "advert:edit",
    "admin:view_master_sheet",
    "admin:view_financials",
  ]),
  // user-3 Raza — Driver
  ...grants("user-3", ["inventory:add"]),
  // user-4 Mohsin — Driver
  ...grants("user-4", ["inventory:add"]),
  // user-5 Kami — Inspector
  ...grants("user-5", [
    "inspection:run",
    "inspection:add_note",
    "maintenance:create",
    "workshop:add_note",
  ]),
  // user-6 Sikander — Sales
  ...grants("user-6", [
    "sales:create_lead",
    "sales:edit_lead",
    "sales:book_appointment",
    "sales:edit_appointment",
    "sales:edit_pipeline_stage",
    "sales:mark_sold",
    "invoice:generate",
    "invoice:send",
    "warranty:create",
    "warranty:raise_claim",
    "admin:view_master_calendar",
  ]),
  // user-7 Shan — Prep Lead
  ...grants("user-7", [
    "maintenance:create",
    "maintenance:edit",
    "maintenance:complete",
    "workshop:add_note",
    "photos:process",
  ]),
];

// ============================================================
// VEHICLES
// ============================================================

interface VehicleSeed {
  id: string;
  stockId: string;
  registration: string;
  make: string;
  model: string;
  variant: string;
  bodyType: Vehicle["bodyType"];
  fuelType: Vehicle["fuelType"];
  transmission: Vehicle["transmission"];
  status: Vehicle["status"];
  daysInStock: number;
  source: string;
  buyingPrice: number;
  listingPrice: number | null;
  year: number;
  colour: string;
  mileage: number;
  // Optional CSV-derived fields (work_list.csv)
  imagesCount?: number;
  motExpiry?: string | null;
  autoTrader?: boolean;
  enquiriesCount?: number;
  localOrImport?: "local" | "import";
}

// Auto-generated from work_list.csv on 2026-05-09T11:41:32.906Z
// 114 vehicles
const VEHICLE_SEEDS: VehicleSeed[] = [
  { id: "vehicle-1", stockId: "CC-0001", registration: "LX18FTN", make: "AUDI", model: "A1", variant: "1.0 TFSI SE S Tronic Euro 6 (s/s) 3dr", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 17, source: "BCA Auction", buyingPrice: 9000, listingPrice: 12488, year: 2018, colour: "White", mileage: 29600, imagesCount: 46, motExpiry: "2026-10-05", autoTrader: false, enquiriesCount: 2, localOrImport: "local" },
  { id: "vehicle-2", stockId: "CC-0002", registration: "LW16RUH", make: "AUDI", model: "A1", variant: "1.0 TFSI Sport Sportback 5dr Petrol S Tronic Euro 6 (s/s) (Nav) (95 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 17, source: "Japan Import", buyingPrice: 7900, listingPrice: 10950, year: 2016, colour: "Blue", mileage: 51500, imagesCount: 50, motExpiry: "2027-03-22", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-3", stockId: "CC-0003", registration: "LX66CZK", make: "AUDI", model: "A3", variant: "1.4 TFSI CoD SE Sportback 5dr Petrol S Tronic Euro 6 (s/s) (15165 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 164, source: "Japan Import", buyingPrice: 7200, listingPrice: 9990, year: 2016, colour: "White", mileage: 54500, imagesCount: 51, motExpiry: "2026-08-26", autoTrader: false, enquiriesCount: 2, localOrImport: "import" },
  { id: "vehicle-4", stockId: "CC-0004", registration: "SA17WUV", make: "AUDI", model: "A3", variant: "1.4 TFSI CoD Sport Sportback 5dr Petrol S Tronic Euro 6 (s/s) (150 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 54, source: "BCA Auction", buyingPrice: 9550, listingPrice: 13250, year: 2017, colour: "Grey", mileage: 32900, imagesCount: 51, motExpiry: "2026-12-14", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-5", stockId: "CC-0005", registration: "YN63NFA", make: "AUDI", model: "A4", variant: "2.0 TFSI Black Edition Saloon 4dr Petrol S Tronic quattro Euro 6 (s/s) (225 ps)", bodyType: "saloon", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 53, source: "BCA Auction", buyingPrice: 6850, listingPrice: 9480, year: 2013, colour: "White", mileage: 75400, imagesCount: 50, motExpiry: "2027-02-16", autoTrader: false, enquiriesCount: 3, localOrImport: "local" },
  { id: "vehicle-6", stockId: "CC-0006", registration: "LB64ZHM", make: "AUDI", model: "A6 SALOON", variant: "2.0 TFSI S line Edition S Tronic quattro Euro 5 (s/s) 5dr", bodyType: "saloon", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 80, source: "BCA Auction", buyingPrice: 7900, listingPrice: 10950, year: 2014, colour: "Black", mileage: 46900, imagesCount: 49, motExpiry: "2026-12-12", autoTrader: false, enquiriesCount: 6, localOrImport: "local" },
  { id: "vehicle-7", stockId: "CC-0007", registration: "MV17HFJ", make: "AUDI", model: "Q2", variant: "1.4 TFSI CoD S line SUV 5dr Petrol Manual Euro 6 (s/s) (150 ps)", bodyType: "suv", fuelType: "petrol", transmission: "manual", status: "listed", daysInStock: 54, source: "BCA Auction", buyingPrice: 6400, listingPrice: 8890, year: 2017, colour: "Black", mileage: 110350, imagesCount: 50, motExpiry: "2026-05-14", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-8", stockId: "CC-0008", registration: "KR71FRP", make: "AUDI", model: "Q3", variant: "1.5 TFSI CoD 35 Technik SUV 5dr Petrol S Tronic Euro 6 (s/s) (150 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 111, source: "BCA Auction", buyingPrice: 14150, listingPrice: 19650, year: 2021, colour: "Grey", mileage: 39488, imagesCount: 52, motExpiry: "2026-12-10", autoTrader: true, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-9", stockId: "CC-0009", registration: "BW17NLL", make: "AUDI", model: "RS7", variant: "4.0 TFSI V8 Performance Sportback 5dr Petrol Tiptronic quattro Euro 6 (s/s) (605 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 40, source: "BCA Auction", buyingPrice: 27350, listingPrice: 37990, year: 2017, colour: "Black", mileage: 31500, imagesCount: 66, motExpiry: "2027-02-23", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-10", stockId: "CC-0010", registration: "KF67ATZ", make: "BMW", model: "2 Series GRAN TOURER", variant: "2.0 218d M Sport Auto Euro 6 (s/s) 5dr", bodyType: "mpv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 470, source: "Japan Import", buyingPrice: 10000, listingPrice: 13922, year: 2017, colour: "Black", mileage: 59980, imagesCount: 52, motExpiry: "2026-12-17", autoTrader: false, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-11", stockId: "CC-0011", registration: "LJ17MKA", make: "BMW", model: "2 Series GRAN TOURER", variant: "2.0 218d SE Auto Euro 6 (s/s) 5dr", bodyType: "mpv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 331, source: "Japan Import", buyingPrice: 8250, listingPrice: 11490, year: 2017, colour: "Blue", mileage: 51100, imagesCount: 56, motExpiry: "2026-04-21", autoTrader: false, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-12", stockId: "CC-0012", registration: "LU17JHZ", make: "BMW", model: "2 Series GRAN TOURER", variant: "2.0 218d SE MPV 5dr Diesel Auto Euro 6 (s/s) (150 ps)", bodyType: "mpv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 144, source: "Japan Import", buyingPrice: 7200, listingPrice: 9980, year: 2017, colour: "White", mileage: 65600, imagesCount: 57, motExpiry: "2026-06-04", autoTrader: true, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-13", stockId: "CC-0013", registration: "LG68OCH", make: "BMW", model: "3 SERIES", variant: "2.0 318d Sport Saloon 4dr Diesel Auto Euro 6 (s/s) (150 ps)", bodyType: "saloon", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 62, source: "BCA Auction", buyingPrice: 8250, listingPrice: 11490, year: 2018, colour: "Blue", mileage: 68800, imagesCount: 50, motExpiry: "2027-04-03", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-14", stockId: "CC-0014", registration: "HX15PYA", make: "BMW", model: "5 SERIES", variant: "2.0 518d SE Saloon 4dr Diesel Auto Euro 6 (s/s) (150 ps)", bodyType: "saloon", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 8, source: "BCA Auction", buyingPrice: 4200, listingPrice: 5850, year: 2015, colour: "Black", mileage: 149900, imagesCount: 53, motExpiry: null, autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-15", stockId: "CC-0015", registration: "LA14FTY", make: "BMW", model: "X1", variant: "2.0 220i SE Auto sDrive Euro 5 (s/s) 5dr", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 470, source: "Japan Import", buyingPrice: 7100, listingPrice: 9850, year: 2014, colour: "Black", mileage: 57400, imagesCount: 36, motExpiry: "2025-11-22", autoTrader: false, enquiriesCount: 2, localOrImport: "import" },
  { id: "vehicle-16", stockId: "CC-0016", registration: "KF18VCU", make: "BMW", model: "X1", variant: "2.0 18d xLine SUV 5dr Diesel Auto xDrive Euro 6 (s/s)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 402, source: "Japan Import", buyingPrice: 12900, listingPrice: 17950, year: 2018, colour: "White", mileage: 41026, imagesCount: 53, motExpiry: "2027-04-13", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-17", stockId: "CC-0017", registration: "MT67RLZ", make: "BMW", model: "X1", variant: "2.0 20i xLine SUV 5dr Petrol Auto xDrive Euro 6 (s/s) (192 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 66, source: "BCA Auction", buyingPrice: 8650, listingPrice: 11980, year: 2017, colour: "Silver", mileage: 38500, imagesCount: 53, motExpiry: "2026-08-07", autoTrader: true, enquiriesCount: 4, localOrImport: "local" },
  { id: "vehicle-18", stockId: "CC-0018", registration: "NA66XGM", make: "BMW", model: "X5", variant: "2.0 40e 9.0kWh M Sport SUV 5dr Petrol Plug-in Hybrid Auto xDrive Euro 6 (s/s) (313 ps)", bodyType: "suv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 24, source: "BCA Auction", buyingPrice: 12750, listingPrice: 17680, year: 2016, colour: "Black", mileage: 73500, imagesCount: 59, motExpiry: "2026-05-11", autoTrader: true, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-19", stockId: "CC-0019", registration: "HV67UPS", make: "CITROEN", model: "GRAND C4 PICASSO", variant: "1.6 BlueHDi Feel MPV 5dr Diesel EAT6 Euro 6 (s/s) (120 ps)", bodyType: "mpv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 99, source: "BCA Auction", buyingPrice: 6850, listingPrice: 9490, year: 2017, colour: "Blue", mileage: 42150, imagesCount: 48, motExpiry: "2027-03-18", autoTrader: false, enquiriesCount: 3, localOrImport: "local" },
  { id: "vehicle-20", stockId: "CC-0020", registration: "HY68AAU", make: "CITROEN", model: "SPACETOURER", variant: "2.0 BlueHDi Feel M MPV 5dr Diesel EAT8 MWB Euro 6 (s/s) (180 ps)", bodyType: "mpv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 92, source: "BCA Auction", buyingPrice: 10700, listingPrice: 14850, year: 2018, colour: "Grey", mileage: 76400, imagesCount: 48, motExpiry: "2026-08-18", autoTrader: true, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-21", stockId: "CC-0021", registration: "KH16DJZ", make: "FIAT", model: "500", variant: "0.9 TwinAir Lounge Dualogic Euro 6 (s/s) 3dr", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 357, source: "Japan Import", buyingPrice: 4950, listingPrice: 6850, year: 2016, colour: "White", mileage: 23800, imagesCount: 48, motExpiry: "2026-03-19", autoTrader: false, enquiriesCount: 3, localOrImport: "import" },
  { id: "vehicle-22", stockId: "CC-0022", registration: "R500HNT", make: "FIAT", model: "500", variant: "1.2 Lounge Hatchback 3dr Petrol Dualogic Euro 6 (s/s) (69 bhp)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "reserved", daysInStock: 10, source: "BCA Auction", buyingPrice: 5350, listingPrice: 7450, year: 2023, colour: "Red", mileage: 62500, imagesCount: 46, motExpiry: "2027-01-16", autoTrader: false, enquiriesCount: 2, localOrImport: "local" },
  { id: "vehicle-23", stockId: "CC-0023", registration: "WG18FLB", make: "FORD", model: "ECOSPORT", variant: "1.0T EcoBoost Zetec SUV 5dr Petrol Auto Euro 6 (s/s) (125 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "reserved", daysInStock: 38, source: "BCA Auction", buyingPrice: 6500, listingPrice: 9050, year: 2018, colour: "Silver", mileage: 51100, imagesCount: 53, motExpiry: "2027-03-31", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-24", stockId: "CC-0024", registration: "LM66YYR", make: "FORD", model: "FIESTA", variant: "1.0T EcoBoost Zetec Hatchback 5dr Petrol Powershift Euro 6 (100 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "reserved", daysInStock: 40, source: "BCA Auction", buyingPrice: 4850, listingPrice: 6750, year: 2016, colour: "White", mileage: 72350, imagesCount: 49, motExpiry: "2026-12-06", autoTrader: false, enquiriesCount: 3, localOrImport: "local" },
  { id: "vehicle-25", stockId: "CC-0025", registration: "MW66UUY", make: "FORD", model: "FIESTA", variant: "1.0T EcoBoost Zetec Hatchback 5dr Petrol Manual Euro 6 (s/s) (100 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "manual", status: "listed", daysInStock: 40, source: "BCA Auction", buyingPrice: 3250, listingPrice: 4488, year: 2016, colour: "White", mileage: 74500, imagesCount: 47, motExpiry: "2026-11-26", autoTrader: false, enquiriesCount: 2, localOrImport: "local" },
  { id: "vehicle-26", stockId: "CC-0026", registration: "MM17KHD", make: "FORD", model: "FOCUS", variant: "1.0T EcoBoost ST-Line Hatchback 5dr Petrol Auto Euro 6 (s/s) (125 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 31, source: "BCA Auction", buyingPrice: 6650, listingPrice: 9250, year: 2017, colour: "Grey", mileage: 49700, imagesCount: 52, motExpiry: "2027-03-06", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-27", stockId: "CC-0027", registration: "YS71WMV", make: "FORD", model: "RANGER", variant: "2.0 EcoBlue Wildtrak Pickup Double Cab 4dr Diesel Auto 4WD Euro 6 (s/s) (213 ps)", bodyType: "estate", fuelType: "diesel", transmission: "automatic", status: "sold", daysInStock: 253, source: "BCA Auction", buyingPrice: 12050, listingPrice: 16750, year: 2021, colour: "Black", mileage: 78500, imagesCount: 56, motExpiry: "2027-02-24", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-28", stockId: "CC-0028", registration: "LX71AUW", make: "HONDA", model: "HR-V", variant: "1.5 h i-MMD Elegance CVT Euro 6 (s/s) 5dr", bodyType: "suv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 219, source: "Japan Import", buyingPrice: 12900, listingPrice: 17950, year: 2021, colour: "White", mileage: 20500, imagesCount: 47, motExpiry: "2026-10-08", autoTrader: false, enquiriesCount: 3, localOrImport: "import" },
  { id: "vehicle-29", stockId: "CC-0029", registration: "WM21KCA", make: "JAGUAR", model: "E-PACE", variant: "2.0 P250 MHEV R-Dynamic SE SUV 5dr Petrol Auto AWD Euro 6 (s/s) (249 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 77, source: "BCA Auction", buyingPrice: 17250, listingPrice: 23988, year: 2021, colour: "Black", mileage: 32350, imagesCount: 57, motExpiry: "2027-02-20", autoTrader: true, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-30", stockId: "CC-0030", registration: "KM68FWL", make: "JAGUAR", model: "E-PACE", variant: "2.0 D150 R-Dynamic SE SUV 5dr Diesel Auto AWD Euro 6 (s/s) (150 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 28, source: "BCA Auction", buyingPrice: 10050, listingPrice: 13950, year: 2018, colour: "White", mileage: 57400, imagesCount: 57, motExpiry: "2026-11-20", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-31", stockId: "CC-0031", registration: "DK18OOH", make: "JAGUAR", model: "E-PACE", variant: "2.0 P250 S SUV 5dr Petrol Auto AWD Euro 6 (s/s) (249 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 18, source: "BCA Auction", buyingPrice: 10250, listingPrice: 14250, year: 2018, colour: "Black", mileage: 66580, imagesCount: 53, motExpiry: "2027-02-09", autoTrader: true, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-32", stockId: "CC-0032", registration: "OE19BVL", make: "JAGUAR", model: "F-PACE", variant: "2.0 D180 R-Sport SUV 5dr Diesel Auto AWD Euro 6 (s/s) (180 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 34, source: "BCA Auction", buyingPrice: 11850, listingPrice: 16450, year: 2019, colour: "Grey", mileage: 58200, imagesCount: 59, motExpiry: "2027-04-17", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-33", stockId: "CC-0033", registration: "YE68TVF", make: "JAGUAR", model: "F-PACE", variant: "2.0 D180 Portfolio SUV 5dr Diesel Auto AWD Euro 6 (s/s) (180 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "reserved", daysInStock: 22, source: "BCA Auction", buyingPrice: 11150, listingPrice: 15480, year: 2018, colour: "Grey", mileage: 57900, imagesCount: 60, motExpiry: "2026-12-18", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-34", stockId: "CC-0034", registration: "ET70AZV", make: "KIA", model: "SPORTAGE", variant: "1.6 T-GDi GT-Line S SUV 5dr Petrol DCT AWD Euro 6 (s/s) (174 bhp)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 9, source: "BCA Auction", buyingPrice: 11450, listingPrice: 15898, year: 2020, colour: "Grey", mileage: 64100, imagesCount: 61, motExpiry: null, autoTrader: true, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-35", stockId: "CC-0035", registration: "KM23XZG", make: "KIA", model: "SPORTAGE", variant: "1.6 h T-GDi GT-Line S SUV 5dr Petrol Hybrid Auto Euro 6 (s/s) (226 bhp)", bodyType: "suv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 9, source: "BCA Auction", buyingPrice: 19400, listingPrice: 26950, year: 2023, colour: "Grey", mileage: 11900, imagesCount: 54, motExpiry: null, autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-36", stockId: "CC-0036", registration: "RE17BGF", make: "LAND ROVER", model: "DISCOVERY", variant: "2.0 SD4 HSE SUV 5dr Diesel Auto 4WD Euro 6 (s/s) (240 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 4, source: "BCA Auction", buyingPrice: 13650, listingPrice: 18950, year: 2017, colour: "Black", mileage: 69500, imagesCount: 18, motExpiry: null, autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-37", stockId: "CC-0037", registration: "SY16ZFB", make: "LAND ROVER", model: "DISCOVERY 4", variant: "3.0 SD V6 Landmark SUV 5dr Diesel Auto 4WD Euro 6 (s/s) (256 bhp)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 84, source: "BCA Auction", buyingPrice: 15750, listingPrice: 21880, year: 2016, colour: "Black", mileage: 79900, imagesCount: 63, motExpiry: "2026-06-08", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-38", stockId: "CC-0038", registration: "YY68AAE", make: "LAND ROVER", model: "DISCOVERY SPORT", variant: "2.0 TD4 HSE SUV 5dr Diesel Auto 4WD Euro 6 (s/s) (180 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 58, source: "BCA Auction", buyingPrice: 7900, listingPrice: 10950, year: 2018, colour: "Grey", mileage: 74700, imagesCount: 60, motExpiry: "2026-07-03", autoTrader: true, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-39", stockId: "CC-0039", registration: "BP19PGE", make: "LAND ROVER", model: "DISCOVERY SPORT", variant: "2.0 TD4 Landmark SUV 5dr Diesel Auto 4WD Euro 6 (s/s) (180 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 38, source: "BCA Auction", buyingPrice: 9800, listingPrice: 13599, year: 2019, colour: "Black", mileage: 79100, imagesCount: 55, motExpiry: "2026-06-28", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-40", stockId: "CC-0040", registration: "SN70VLK", make: "LAND ROVER", model: "RANGE ROVER", variant: "3.0 SD V6 Autobiography SUV 5dr Diesel Auto 4WD Euro 6 (s/s) (275 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 89, source: "BCA Auction", buyingPrice: 26600, listingPrice: 36920, year: 2020, colour: "Black", mileage: 48900, imagesCount: 69, motExpiry: "2026-12-02", autoTrader: true, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-41", stockId: "CC-0041", registration: "SL68NYZ", make: "LAND ROVER", model: "RANGE ROVER EVOQUE", variant: "2.0 TD4 Landmark SUV 5dr Diesel Auto 4WD Euro 6 (s/s) (180 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "reserved", daysInStock: 61, source: "BCA Auction", buyingPrice: 9300, listingPrice: 12950, year: 2018, colour: "White", mileage: 63200, imagesCount: 54, motExpiry: "2027-03-24", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-42", stockId: "CC-0042", registration: "YF16CUY", make: "LAND ROVER", model: "RANGE ROVER EVOQUE", variant: "2.0 TD4 SE Tech SUV 5dr Diesel Auto 4WD Euro 6 (s/s) (180 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 61, source: "BCA Auction", buyingPrice: 6850, listingPrice: 9490, year: 2016, colour: "White", mileage: 64300, imagesCount: 51, motExpiry: "2026-07-31", autoTrader: true, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-43", stockId: "CC-0043", registration: "AK69HZH", make: "LAND ROVER", model: "RANGE ROVER EVOQUE", variant: "2.0 P200 MHEV R-Dynamic SUV 5dr Petrol Auto 4WD Euro 6 (s/s) (200 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 40, source: "BCA Auction", buyingPrice: 12550, listingPrice: 17450, year: 2019, colour: "Black", mileage: 31900, imagesCount: 51, motExpiry: "2026-09-28", autoTrader: true, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-44", stockId: "CC-0044", registration: "B24CKK", make: "LAND ROVER", model: "RANGE ROVER SPORT", variant: "3.0 SD V6 HSE SUV 5dr Diesel Auto 4WD Euro 6 (s/s) (306 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 18, source: "BCA Auction", buyingPrice: 23050, listingPrice: 32000, year: 2023, colour: "Black", mileage: 45900, imagesCount: 67, motExpiry: "2027-04-03", autoTrader: false, enquiriesCount: 3, localOrImport: "local" },
  { id: "vehicle-45", stockId: "CC-0045", registration: "KF64JTV", make: "MAZDA", model: "CX-5", variant: "2.2 SKYACTIV-D SE-L Nav Auto 4WD Euro 6 (s/s) 5dr", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 424, source: "Japan Import", buyingPrice: 6450, listingPrice: 8990, year: 2014, colour: "White", mileage: 44900, imagesCount: 48, motExpiry: "2026-04-18", autoTrader: false, enquiriesCount: 3, localOrImport: "import" },
  { id: "vehicle-46", stockId: "CC-0046", registration: "KE13YTC", make: "MERCEDES-BENZ", model: "A CLASS", variant: "1.6 A18125 Sport Hatchback 5dr Petrol 7G-DCT Euro 6 (s/s) (122 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 43, source: "BCA Auction", buyingPrice: 5700, listingPrice: 7950, year: 2013, colour: "Black", mileage: 73700, imagesCount: 47, motExpiry: "2027-02-18", autoTrader: false, enquiriesCount: 2, localOrImport: "local" },
  { id: "vehicle-47", stockId: "CC-0047", registration: "BK19YLR", make: "MERCEDES-BENZ", model: "A-CLASS", variant: "1.3 A180 AMG Line (Executive) Hatchback 5dr Petrol 7G-DCT Euro 6 (s/s) (136 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "reserved", daysInStock: 22, source: "BCA Auction", buyingPrice: 10250, listingPrice: 14250, year: 2019, colour: "Silver", mileage: 66900, imagesCount: 54, motExpiry: "2027-04-19", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-48", stockId: "CC-0048", registration: "DL68FUT", make: "MERCEDES-BENZ", model: "A-CLASS", variant: "1.3 A200 Sport (Executive) Hatchback 5dr Petrol 7G-DCT Euro 6 (s/s) (163 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "reserved", daysInStock: 17, source: "BCA Auction", buyingPrice: 10450, listingPrice: 14480, year: 2018, colour: "Silver", mileage: 45500, imagesCount: 55, motExpiry: "2027-02-10", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-49", stockId: "CC-0049", registration: "LW15JGV", make: "MERCEDES-BENZ", model: "B-CLASS", variant: "1.6 B180 SE 7G-DCT Euro 6 (s/s) 5dr", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 725, source: "Japan Import", buyingPrice: 6850, listingPrice: 9490, year: 2015, colour: "Silver", mileage: 44800, imagesCount: 38, motExpiry: "2026-04-19", autoTrader: false, enquiriesCount: 5, localOrImport: "import" },
  { id: "vehicle-50", stockId: "CC-0050", registration: "LX66FVU", make: "MERCEDES-BENZ", model: "B-CLASS", variant: "1.6 B180 Sport MPV 5dr Petrol 7G-DCT Euro 6 (s/s) (122 ps)", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 653, source: "Japan Import", buyingPrice: 7550, listingPrice: 10490, year: 2016, colour: "White", mileage: 35300, imagesCount: 45, motExpiry: "2027-01-15", autoTrader: false, enquiriesCount: 2, localOrImport: "import" },
  { id: "vehicle-51", stockId: "CC-0051", registration: "KF64JUV", make: "MERCEDES-BENZ", model: "B-CLASS", variant: "1.6 B180 BlueEfficiency Sport 7G-DCT Euro 5 (s/s) 5dr", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 106, source: "Japan Import", buyingPrice: 7200, listingPrice: 9998, year: 2014, colour: "Silver", mileage: 33800, imagesCount: 51, motExpiry: "2026-07-27", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-52", stockId: "CC-0052", registration: "EO12WDE", make: "MERCEDES-BENZ", model: "C-CLASS", variant: "1.8 C180 BlueEfficiency SE Saloon 4dr Petrol G-Tronic+ Euro 5 (s/s) (156 ps)", bodyType: "saloon", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 59, source: "BCA Auction", buyingPrice: 2850, listingPrice: 3950, year: 2012, colour: "Silver", mileage: 90700, imagesCount: 46, motExpiry: "2026-09-26", autoTrader: true, enquiriesCount: 12, localOrImport: "local" },
  { id: "vehicle-53", stockId: "CC-0053", registration: "LD64FJN", make: "MERCEDES-BENZ", model: "C-CLASS", variant: "2.0 C200 Sport (Premium Plus) Saloon 4dr Petrol 7G-Tronic+ Euro 6 (s/s) (184 ps)", bodyType: "saloon", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 24, source: "BCA Auction", buyingPrice: 8250, listingPrice: 11450, year: 2014, colour: "Black", mileage: 62700, imagesCount: 51, motExpiry: "2026-11-24", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-54", stockId: "CC-0054", registration: "EX68EYK", make: "MERCEDES-BENZ", model: "CLA", variant: "2.1 CLA220d AMG Line Night Edition Coupe 4dr Diesel 7G-DCT Euro 6 (s/s) (170 ps)", bodyType: "saloon", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 24, source: "BCA Auction", buyingPrice: 9800, listingPrice: 13590, year: 2018, colour: "White", mileage: 65600, imagesCount: 52, motExpiry: "2027-03-02", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-55", stockId: "CC-0055", registration: "LJ66PRV", make: "MERCEDES-BENZ", model: "E-CLASS", variant: "2.0 E200 AMG Sport Coupe 2dr Petrol G-Tronic+ Euro 6 (s/s) (184 ps)", bodyType: "coupe", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 33, source: "BCA Auction", buyingPrice: 10050, listingPrice: 13988, year: 2016, colour: "White", mileage: 43500, imagesCount: 52, motExpiry: "2027-02-15", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-56", stockId: "CC-0056", registration: "AK69PFZ", make: "MERCEDES-BENZ", model: "GLA", variant: "1.6 GLA180 GPF Urban Edition SUV 5dr Petrol 7G-DCT Euro 6 (s/s) (122 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 37, source: "BCA Auction", buyingPrice: 9700, listingPrice: 13480, year: 2019, colour: "Red", mileage: 56100, imagesCount: 53, motExpiry: "2027-01-15", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-57", stockId: "CC-0057", registration: "YR67GVG", make: "MERCEDES-BENZ", model: "GLC", variant: "2.1 GLC220d Sport (Premium) SUV 5dr Diesel G-Tronic 4MATIC Euro 6 (s/s) (170 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 40, source: "BCA Auction", buyingPrice: 11500, listingPrice: 15988, year: 2017, colour: "White", mileage: 72500, imagesCount: 58, motExpiry: "2026-09-20", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-58", stockId: "CC-0058", registration: "KJ19NZM", make: "MINI", model: "HATCH", variant: "1.5 Cooper Classic Hatchback 5dr Petrol Steptronic Euro 6 (s/s) (136 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 81, source: "BCA Auction", buyingPrice: 6850, listingPrice: 9490, year: 2019, colour: "Red", mileage: 72500, imagesCount: 50, motExpiry: "2026-05-15", autoTrader: true, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-59", stockId: "CC-0059", registration: "LC12GKZ", make: "MINI", model: "HATCH", variant: "1.6 Cooper S Hatchback 3dr Petrol Steptronic Euro 5 (184 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 19, source: "BCA Auction", buyingPrice: 5050, listingPrice: 6995, year: 2012, colour: "Blue", mileage: 49600, imagesCount: 49, motExpiry: "2027-04-13", autoTrader: true, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-60", stockId: "CC-0060", registration: "FT19XGM", make: "MITSUBISHI", model: "OUTLANDER", variant: "2.4h TwinMotor 13.8kWh 4h SUV 5dr Petrol Plug-in Hybrid CVT 4WD Euro 6 (s/s) (209 ps)", bodyType: "suv", fuelType: "hybrid", transmission: "automatic", status: "sold", daysInStock: 34, source: "BCA Auction", buyingPrice: 8600, listingPrice: 11950, year: 2019, colour: "Silver", mileage: 69500, imagesCount: 58, motExpiry: "2026-06-06", autoTrader: false, enquiriesCount: 3, localOrImport: "local" },
  { id: "vehicle-61", stockId: "CC-0061", registration: "LF62LGX", make: "NISSAN", model: "ELGRAND", variant: "2.5 HIGHWAY STAR PETROL AUTO 8 SEATS", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 826, source: "Japan Import", buyingPrice: 8650, listingPrice: 11990, year: 2012, colour: "Black", mileage: 38700, imagesCount: 49, motExpiry: "2026-04-20", autoTrader: false, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-62", stockId: "CC-0062", registration: "LX60JFY", make: "NISSAN", model: "ELGRAND", variant: "3.5 HIGHWAY STAR PETROL CVT 8 SEATS", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 813, source: "Japan Import", buyingPrice: 7150, listingPrice: 9950, year: 2010, colour: "White", mileage: 69800, imagesCount: 31, motExpiry: "2025-12-14", autoTrader: false, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-63", stockId: "CC-0063", registration: "LX61GHA", make: "NISSAN", model: "ELGRAND", variant: "2.5 HIGHWAY STAR PETROL AUTO 7 SEATS", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 813, source: "Japan Import", buyingPrice: 8550, listingPrice: 11900, year: 2011, colour: "White", mileage: 75200, imagesCount: 38, motExpiry: "2024-06-16", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-64", stockId: "CC-0064", registration: "KF67AVD", make: "NISSAN", model: "ELGRAND", variant: "2.5 HIGHWAY STAR PRESTIGE PETROL AUTO 7 SEATS", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 357, source: "Japan Import", buyingPrice: 11850, listingPrice: 16490, year: 2017, colour: "White", mileage: 57400, imagesCount: 51, motExpiry: "2026-03-08", autoTrader: false, enquiriesCount: 2, localOrImport: "import" },
  { id: "vehicle-65", stockId: "CC-0065", registration: "ELG66ND", make: "NISSAN", model: "ELGRAND", variant: "2.5 HIGHWAY STAR PETROL AUTO 7 SEATS", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 179, source: "Japan Import", buyingPrice: 9950, listingPrice: 13790, year: 2015, colour: "Black", mileage: 58450, imagesCount: 63, motExpiry: "2019-10-03", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-66", stockId: "CC-0066", registration: "LU17JDK", make: "NISSAN", model: "ELGRAND", variant: "2.5 HIGHWAY STAR PETROL EURO 6 AUTO 7 SEATS", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 140, source: "Japan Import", buyingPrice: 11850, listingPrice: 16490, year: 2017, colour: "White", mileage: 63500, imagesCount: 52, motExpiry: "2026-09-10", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-67", stockId: "CC-0067", registration: "DA72PWZ", make: "NISSAN", model: "LEAF", variant: "39kWh N-Connecta Hatchback 5dr Electric Auto (150 ps)", bodyType: "hatchback", fuelType: "electric", transmission: "automatic", status: "listed", daysInStock: 6, source: "BCA Auction", buyingPrice: 7150, listingPrice: 9950, year: 2022, colour: "White", mileage: 17300, imagesCount: 53, motExpiry: null, autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-68", stockId: "CC-0068", registration: "EF14TJU", make: "NISSAN", model: "MICRA", variant: "1.2 12V Acenta Hatchback 5dr Petrol CVT Euro 5 (80 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 166, source: "Japan Import", buyingPrice: 5000, listingPrice: 6950, year: 2014, colour: "White", mileage: 16600, imagesCount: 47, motExpiry: "2026-08-15", autoTrader: false, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-69", stockId: "CC-0069", registration: "DX17UGL", make: "NISSAN", model: "MICRA", variant: "0.9 IG-T N-Connecta Hatchback 5dr Petrol Manual Euro 6 (s/s) (90 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "manual", status: "reserved", daysInStock: 64, source: "BCA Auction", buyingPrice: 4500, listingPrice: 6250, year: 2017, colour: "White", mileage: 68100, imagesCount: 49, motExpiry: "2026-09-01", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-70", stockId: "CC-0070", registration: "LW62ASZ", make: "NISSAN", model: "NOTE", variant: "1.2 Acenta Hatchback 5dr Petrol CVT Euro 5 (885 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 67, source: "BCA Auction", buyingPrice: 3600, listingPrice: 4990, year: 2012, colour: "Black", mileage: 72100, imagesCount: 44, motExpiry: "2026-09-13", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-71", stockId: "CC-0071", registration: "KO16YYL", make: "NISSAN", model: "QASHQAI", variant: "1.6 dCi N-Connecta SUV 5dr Diesel XTRON 2WD Euro 6 (s/s) (130 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 63, source: "BCA Auction", buyingPrice: 7550, listingPrice: 10490, year: 2016, colour: "Red", mileage: 45100, imagesCount: 52, motExpiry: "2026-07-13", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-72", stockId: "CC-0072", registration: "DP19EAY", make: "NISSAN", model: "QASHQAI", variant: "1.3 DIG-T N-Connecta SUV 5dr Petrol Manual Euro 6 (s/s) (140 ps)", bodyType: "suv", fuelType: "petrol", transmission: "manual", status: "listed", daysInStock: 51, source: "BCA Auction", buyingPrice: 7150, listingPrice: 9950, year: 2019, colour: "Grey", mileage: 71105, imagesCount: 50, motExpiry: "2026-07-10", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-73", stockId: "CC-0073", registration: "HY69OHU", make: "NISSAN", model: "QASHQAI", variant: "1.3 DIG-T N-Connecta SUV 5dr Petrol DCT Auto Euro 6 (s/s) (160 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 22, source: "BCA Auction", buyingPrice: 7900, listingPrice: 10970, year: 2019, colour: "Grey", mileage: 75200, imagesCount: 48, motExpiry: "2026-09-29", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-74", stockId: "CC-0074", registration: "LO70EAF", make: "NISSAN", model: "QASHQAI", variant: "1.3 DIG-T N-Connecta SUV 5dr Petrol DCT Auto Euro 6 (s/s) (160 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "reserved", daysInStock: 17, source: "BCA Auction", buyingPrice: 8450, listingPrice: 11750, year: 2020, colour: "White", mileage: 72100, imagesCount: 48, motExpiry: "2026-12-10", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-75", stockId: "CC-0075", registration: "LB21ZDD", make: "NISSAN", model: "SERENA", variant: "1.2 Highway Star E-Power Hybrid 8 Seats", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 58, source: "Japan Import", buyingPrice: 17950, listingPrice: 24950, year: 2021, colour: "Black", mileage: 39950, imagesCount: 49, motExpiry: "2027-02-12", autoTrader: true, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-76", stockId: "CC-0076", registration: "LJ72FCF", make: "NISSAN", model: "SERENA", variant: "2.0 HIGHWAY STAR PURE DRIVE HYBRID PETROL CVT 8 SEATS", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 58, source: "Japan Import", buyingPrice: 19400, listingPrice: 26950, year: 2022, colour: "Black", mileage: 41100, imagesCount: 52, motExpiry: "2027-02-11", autoTrader: true, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-77", stockId: "CC-0077", registration: "LK22FUO", make: "NISSAN", model: "SERENA", variant: "2.0 HIGHWAY STAR PURE DRIVE HYBRID PETROL CVT 8 SEATS", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 43, source: "BCA Auction", buyingPrice: 16500, listingPrice: 22950, year: 2022, colour: "Silver", mileage: 48100, imagesCount: 49, motExpiry: "2026-12-27", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-78", stockId: "CC-0078", registration: "LV69XBM", make: "NISSAN", model: "SERENA", variant: "2.0 PURE DRIVE S-HYBRID PETROL CVT 8 SEATS", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 43, source: "BCA Auction", buyingPrice: 13650, listingPrice: 18950, year: 2019, colour: "Silver", mileage: 41500, imagesCount: 48, motExpiry: "2027-01-07", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-79", stockId: "CC-0079", registration: "YGZ3319", make: "PEUGEOT", model: "E-2008", variant: "50kWh Allure Premium + SUV 5dr Electric Auto (7kW Charger) (136 ps)", bodyType: "suv", fuelType: "electric", transmission: "automatic", status: "listed", daysInStock: 43, source: "BCA Auction", buyingPrice: 7900, listingPrice: 10980, year: 2022, colour: "Orange", mileage: 52100, imagesCount: 51, motExpiry: "2026-12-15", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-80", stockId: "CC-0080", registration: "KS16ZXU", make: "SEAT", model: "ALHAMBRA", variant: "2.0 TDI SE MPV 5dr Diesel DSG Euro 6 (s/s) (150 ps)", bodyType: "mpv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 68, source: "BCA Auction", buyingPrice: 5750, listingPrice: 7980, year: 2016, colour: "Black", mileage: 114200, imagesCount: 47, motExpiry: "2027-01-29", autoTrader: true, enquiriesCount: 3, localOrImport: "local" },
  { id: "vehicle-81", stockId: "CC-0081", registration: "SD66MTJ", make: "SKODA", model: "FABIA", variant: "1.0 S Hatchback 5dr Petrol Manual Euro 6 (s/s) (60 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "manual", status: "listed", daysInStock: 58, source: "BCA Auction", buyingPrice: 4150, listingPrice: 5790, year: 2016, colour: "Blue", mileage: 55500, imagesCount: 48, motExpiry: "2027-03-24", autoTrader: true, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-82", stockId: "CC-0082", registration: "HN71XTH", make: "SKODA", model: "OCTAVIA", variant: "1.4 TSI iV 13kWh SE Technology Hatchback 5dr Petrol Plug-in Hybrid DSG Euro 6 (s/s) (204 ps)", bodyType: "hatchback", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 4, source: "BCA Auction", buyingPrice: 9300, listingPrice: 12950, year: 2021, colour: "Black", mileage: 56500, imagesCount: 9, motExpiry: "2026-05-19", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-83", stockId: "CC-0083", registration: "LX25BWP", make: "SUZUKI", model: "JIMNY", variant: "NOMADE ALLGRIP AUTO 4WD 1.5L PETROL 5DR 4SEAT EURO 6", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 68, source: "Japan Import", buyingPrice: 24450, listingPrice: 33950, year: 2025, colour: "Beige", mileage: 100, imagesCount: 49, motExpiry: "2028-04-08", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-84", stockId: "CC-0084", registration: "LN58KVH", make: "TOYOTA", model: "ALPHARD", variant: "3.5 PETROL VVTI AUTO 7 SEATS 350S PRIME", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 51, source: "Japan Import", buyingPrice: 5400, listingPrice: 7480, year: 2008, colour: "Blue", mileage: 96500, imagesCount: 50, motExpiry: "2027-03-05", autoTrader: true, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-85", stockId: "CC-0085", registration: "LX24DSV", make: "TOYOTA", model: "ALPHARD", variant: "2.4 HYBRID VVTI AUTO 7 SEATS EXECUTIVE Z", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 23, source: "Japan Import", buyingPrice: 50400, listingPrice: 69980, year: 2024, colour: "White", mileage: 900, imagesCount: 76, motExpiry: "2027-04-01", autoTrader: true, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-86", stockId: "CC-0086", registration: "LF62FRO", make: "TOYOTA", model: "ALPHARD", variant: "2.4 HYBRID VVTI AUTO 7 SEATS PRIME SELECTION", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 23, source: "BCA Auction", buyingPrice: 8650, listingPrice: 11980, year: 2012, colour: "Grey", mileage: 74750, imagesCount: 56, motExpiry: "2026-12-08", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-87", stockId: "CC-0087", registration: "LX71AWR", make: "TOYOTA", model: "ALPHARD", variant: "2.5 HYBRID VVTI AUTO 7 SEATS EXECUTIVE LOUNGE", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 17, source: "Japan Import", buyingPrice: 28750, listingPrice: 39950, year: 2021, colour: "White", mileage: 22500, imagesCount: 59, motExpiry: "2026-02-21", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-88", stockId: "CC-0088", registration: "LA20USP", make: "TOYOTA", model: "C-HR", variant: "1.8 VVT-h Design CVT Euro 6 (s/s) 5dr", bodyType: "suv", fuelType: "hybrid", transmission: "automatic", status: "sold", daysInStock: 59, source: "Japan Import", buyingPrice: 10450, listingPrice: 14500, year: 2020, colour: "Yellow", mileage: 59300, imagesCount: 50, motExpiry: "2027-01-07", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-89", stockId: "CC-0089", registration: "CY19HHU", make: "TOYOTA", model: "COROLLA", variant: "1.8 VVT-h Design Hatchback 5dr Petrol Hybrid CVT Euro 6 (s/s) (122 ps)", bodyType: "hatchback", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 9, source: "BCA Auction", buyingPrice: 9300, listingPrice: 12948, year: 2019, colour: "Black", mileage: 75900, imagesCount: 49, motExpiry: null, autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-90", stockId: "CC-0090", registration: "LF12KSY", make: "TOYOTA", model: "ESTIMA", variant: "2.4 HYBRID VVTI AUTO 7 SEATS - AERAS", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 266, source: "Japan Import", buyingPrice: 5700, listingPrice: 7950, year: 2012, colour: "White", mileage: 135600, imagesCount: 25, motExpiry: "2026-06-03", autoTrader: false, enquiriesCount: 3, localOrImport: "import" },
  { id: "vehicle-91", stockId: "CC-0091", registration: "LW65CHV", make: "TOYOTA", model: "ESTIMA", variant: "2.4 HYBRID VVTI AUTO 7 SEATS - AERAS PREMIUM", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 219, source: "Japan Import", buyingPrice: 10750, listingPrice: 14950, year: 2015, colour: "Black", mileage: 63500, imagesCount: 57, motExpiry: "2026-10-12", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-92", stockId: "CC-0092", registration: "LJ66OTE", make: "TOYOTA", model: "ESTIMA", variant: "2.4 HYBRID VVTI AUTO 7 SEATS - AERAS", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 59, source: "Japan Import", buyingPrice: 13700, listingPrice: 18995, year: 2016, colour: "Red", mileage: 68250, imagesCount: 52, motExpiry: "2027-02-12", autoTrader: true, enquiriesCount: 3, localOrImport: "import" },
  { id: "vehicle-93", stockId: "CC-0093", registration: "LJ19DKH", make: "TOYOTA", model: "ESTIMA", variant: "2.4 CVT PETROL 8 SEATS 240 S AERAS", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 39, source: "BCA Auction", buyingPrice: 11500, listingPrice: 15950, year: 2019, colour: "Silver", mileage: 62500, imagesCount: 49, motExpiry: "2027-02-12", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-94", stockId: "CC-0094", registration: "LX62NRJ", make: "TOYOTA", model: "ESTIMA", variant: "2.4 CVT PETROL 7 SEATS 240 AERAS", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 39, source: "BCA Auction", buyingPrice: 6500, listingPrice: 9000, year: 2012, colour: "Silver", mileage: 53900, imagesCount: 51, motExpiry: "2026-09-30", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-95", stockId: "CC-0095", registration: "LW65CVR", make: "TOYOTA", model: "ESTIMA", variant: "2.4 CVT PETROL 7 SEATS BERRY EDITION", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 24, source: "Japan Import", buyingPrice: 8600, listingPrice: 11950, year: 2015, colour: "Black", mileage: 52500, imagesCount: 52, motExpiry: "2026-12-29", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-96", stockId: "CC-0096", registration: "LX25BXW", make: "TOYOTA", model: "LAND CRUISER", variant: "GDJ76 LC70 Series LWB RHD 2.8 Diesel Auto 6dr", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 58, source: "Japan Import", buyingPrice: 46450, listingPrice: 64500, year: 2025, colour: "White", mileage: 150, imagesCount: 61, motExpiry: "2028-04-01", autoTrader: false, enquiriesCount: 2, localOrImport: "import" },
  { id: "vehicle-97", stockId: "CC-0097", registration: "LX68DWY", make: "TOYOTA", model: "PRIUS", variant: "1.8 VVT-h Active Hatchback 5dr Petrol Hybrid CVT Euro 6 (s/s) (122 ps)", bodyType: "hatchback", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 68, source: "Japan Import", buyingPrice: 10800, listingPrice: 14990, year: 2018, colour: "Beige", mileage: 29200, imagesCount: 51, motExpiry: "2026-10-23", autoTrader: true, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-98", stockId: "CC-0098", registration: "KE70VJK", make: "TOYOTA", model: "PRIUS", variant: "1.8 VVT-h Active CVT Euro 6 (s/s) 5dr", bodyType: "hatchback", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 19, source: "Japan Import", buyingPrice: 9300, listingPrice: 12945, year: 2020, colour: "Black", mileage: 55400, imagesCount: 50, motExpiry: "2023-11-02", autoTrader: true, enquiriesCount: 4, localOrImport: "import" },
  { id: "vehicle-99", stockId: "CC-0099", registration: "LW15KFK", make: "TOYOTA", model: "VELLFIRE", variant: "2.4 CVT PETROL 8 SEATS 240 S PLATINUM EDITION", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 331, source: "Japan Import", buyingPrice: 13300, listingPrice: 18450, year: 2015, colour: "Black", mileage: 45601, imagesCount: 49, motExpiry: "2027-03-22", autoTrader: false, enquiriesCount: 6, localOrImport: "import" },
  { id: "vehicle-100", stockId: "CC-0100", registration: "LX60JGO", make: "TOYOTA", model: "VELLFIRE", variant: "3.5 PETROL VVTI AUTO 7 SEATS 350S PRIME", bodyType: "mpv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 18, source: "Japan Import", buyingPrice: 7900, listingPrice: 10950, year: 2010, colour: "White", mileage: 59800, imagesCount: 49, motExpiry: "2027-04-18", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-101", stockId: "CC-0101", registration: "LJ20EZX", make: "TOYOTA", model: "VOXY/NOAH", variant: "1.8 VVT-h Excel Business Edition 7 Seats CVT Euro 6 (s/s) 5dr", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 160, source: "Japan Import", buyingPrice: 13650, listingPrice: 18950, year: 2020, colour: "Blue", mileage: 42600, imagesCount: 48, motExpiry: "2026-09-26", autoTrader: true, enquiriesCount: 4, localOrImport: "import" },
  { id: "vehicle-102", stockId: "CC-0102", registration: "LC69CUH", make: "TOYOTA", model: "VOXY/NOAH", variant: "1.8 VVT-h Excel Business Edition 7 Seats CVT Euro 6 (s/s) 5dr", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 58, source: "Japan Import", buyingPrice: 13650, listingPrice: 18950, year: 2019, colour: "Black", mileage: 67250, imagesCount: 51, motExpiry: "2027-01-07", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-103", stockId: "CC-0103", registration: "VOXY22", make: "TOYOTA", model: "VOXY/NOAH", variant: "1.8 VVT-h Excel Business Edition CVT Euro 6 (s/s) 5dr", bodyType: "mpv", fuelType: "hybrid", transmission: "automatic", status: "listed", daysInStock: 24, source: "Japan Import", buyingPrice: 20100, listingPrice: 27950, year: 2021, colour: "Black", mileage: 62500, imagesCount: 55, motExpiry: "2025-05-02", autoTrader: false, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-104", stockId: "CC-0104", registration: "LX62KRF", make: "TOYOTA", model: "YARIS", variant: "1.33 Dual VVT-i Icon Hatchback 5dr Petrol Multidrive S Euro 5 (99 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 10, source: "BCA Auction", buyingPrice: 4900, listingPrice: 6800, year: 2012, colour: "Black", mileage: 58900, imagesCount: 49, motExpiry: "2025-07-11", autoTrader: false, enquiriesCount: 2, localOrImport: "local" },
  { id: "vehicle-105", stockId: "CC-0105", registration: "VA69NZG", make: "VAUXHALL", model: "ASTRA", variant: "1.4i Turbo SE Hatchback 5dr Petrol CVT Euro 6 (s/s) (145 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 32, source: "BCA Auction", buyingPrice: 6700, listingPrice: 9288, year: 2019, colour: "White", mileage: 53600, imagesCount: 52, motExpiry: "2027-04-13", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
  { id: "vehicle-106", stockId: "CC-0106", registration: "LR07OZC", make: "VAUXHALL", model: "ASTRA", variant: "1.8i 16v SRi Hatchback 5dr Petrol Manual (190 g/km, 123 bhp)", bodyType: "hatchback", fuelType: "petrol", transmission: "manual", status: "listed", daysInStock: 5, source: "BCA Auction", buyingPrice: 1050, listingPrice: 1450, year: 2007, colour: "Silver", mileage: 106600, imagesCount: 44, motExpiry: null, autoTrader: true, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-107", stockId: "CC-0107", registration: "HY18OLX", make: "VAUXHALL", model: "INSIGNIA", variant: "1.5i Turbo Design Grand Sport 5dr Petrol Manual Euro 6 (s/s) (165 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "manual", status: "reserved", daysInStock: 66, source: "BCA Auction", buyingPrice: 5050, listingPrice: 6990, year: 2018, colour: "Black", mileage: 78200, imagesCount: 46, motExpiry: "2027-02-18", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-108", stockId: "CC-0108", registration: "LB63TYY", make: "VOLKSWAGEN", model: "GOLF", variant: "1.4 TSI BlueMotion Tech ACT GT Hatchback 5dr Petrol DSG Euro 6 (s/s) (140 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 320, source: "Japan Import", buyingPrice: 6450, listingPrice: 8990, year: 2013, colour: "Blue", mileage: 72500, imagesCount: 47, motExpiry: "2026-03-17", autoTrader: true, enquiriesCount: 1, localOrImport: "import" },
  { id: "vehicle-109", stockId: "CC-0109", registration: "LJ16NPC", make: "VOLKSWAGEN", model: "GOLF", variant: "1.2 TSI BlueMotion Tech Match DSG Euro 5 (s/s) 5dr", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 59, source: "Japan Import", buyingPrice: 8650, listingPrice: 11980, year: 2016, colour: "Black", mileage: 54800, imagesCount: 53, motExpiry: "2027-02-08", autoTrader: false, enquiriesCount: 0, localOrImport: "import" },
  { id: "vehicle-110", stockId: "CC-0110", registration: "LJ16HSG", make: "VOLKSWAGEN", model: "POLO", variant: "1.2 TSI BlueMotion Tech SE Hatchback 5dr Petrol DSG Euro 6 (s/s) (90 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "sold", daysInStock: 324, source: "Japan Import", buyingPrice: 6800, listingPrice: 9450, year: 2016, colour: "Black", mileage: 66300, imagesCount: 52, motExpiry: "2026-06-02", autoTrader: false, enquiriesCount: 2, localOrImport: "import" },
  { id: "vehicle-111", stockId: "CC-0111", registration: "FD59WRT", make: "VOLKSWAGEN", model: "POLO", variant: "1.4 SE Hatchback 5dr Petrol DSG Euro 5 (85 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 50, source: "BCA Auction", buyingPrice: 3900, listingPrice: 5450, year: 2009, colour: "Grey", mileage: 75400, imagesCount: 47, motExpiry: "2026-11-29", autoTrader: false, enquiriesCount: 8, localOrImport: "local" },
  { id: "vehicle-112", stockId: "CC-0112", registration: "LX70DHO", make: "VOLKSWAGEN", model: "POLO", variant: "1.0 TSI Match Hatchback 5dr Petrol DSG Euro 6 (s/s) (95 ps)", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 19, source: "BCA Auction", buyingPrice: 10400, listingPrice: 14450, year: 2020, colour: "Orange", mileage: 11450, imagesCount: 57, motExpiry: "2026-04-16", autoTrader: false, enquiriesCount: 1, localOrImport: "local" },
  { id: "vehicle-113", stockId: "CC-0113", registration: "VA18YFV", make: "VOLKSWAGEN", model: "TIGUAN", variant: "2.0 TDI R-Line SUV 5dr Diesel DSG 4Motion Euro 6 (s/s) (150 ps)", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 64, source: "BCA Auction", buyingPrice: 12750, listingPrice: 17740, year: 2018, colour: "Silver", mileage: 55450, imagesCount: 53, motExpiry: "2026-09-23", autoTrader: true, enquiriesCount: 3, localOrImport: "local" },
  { id: "vehicle-114", stockId: "CC-0114", registration: "NK67OHB", make: "VOLKSWAGEN", model: "TIGUAN", variant: "2.0 TSI SEL SUV 5dr Petrol DSG 4Motion Euro 6 (s/s) (180 ps)", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 53, source: "BCA Auction", buyingPrice: 9700, listingPrice: 13450, year: 2017, colour: "Silver", mileage: 92100, imagesCount: 56, motExpiry: "2026-11-04", autoTrader: false, enquiriesCount: 0, localOrImport: "local" },
];

// Vehicle IDs that have a pre-rendered hero image at /cars/seed/<id>.png.
const SEED_IMAGE_IDS = new Set<string>([
  "vehicle-1", "vehicle-2", "vehicle-3", "vehicle-4", "vehicle-5",
  "vehicle-6", "vehicle-7", "vehicle-8", "vehicle-9", "vehicle-10",
  "vehicle-11", "vehicle-12", "vehicle-13", "vehicle-14", "vehicle-15",
]);

// Module A · Spec v3.0 — explicit location overrides for the seed so the
// Locations page has a few cars visibly in Yard / Garage / Staff. Vehicles
// not in this map default to Forecourt.
const SEED_LOCATION_OVERRIDES: Record<string, "forecourt" | "yard" | "garage" | "staff"> = {
  "vehicle-2": "yard",
  "vehicle-3": "garage",
  "vehicle-4": "garage",
  "vehicle-5": "staff",
  "vehicle-8": "yard",
  "vehicle-11": "yard",
};

function buildVehicle(s: VehicleSeed): Vehicle {
  const buyersFee = 200;
  const collectionFee = 100;
  const totalBuyingPrice = s.buyingPrice + buyersFee + collectionFee;
  const valueAddition = s.id === "vehicle-4" ? 180 : Math.round((s.daysInStock / 30) * 80);
  // Next Gear Capital defaults
  const stockingCharges = Math.round(85 + 0.375 * s.daysInStock + (s.status === "sold" ? 25 : 0));
  const warrantyCost = ["listed", "ready", "sold"].includes(s.status) ? 150 : null;
  const landedCost = totalBuyingPrice + valueAddition;
  const baseCost = landedCost + (warrantyCost ?? 0);
  const sellingPrice = s.status === "sold" ? Math.round((s.listingPrice ?? 0) * 0.95) : null;
  const dateSold = s.status === "sold" ? daysAgo(5) : null;
  const grossEarning = sellingPrice ? sellingPrice - baseCost : null;
  const isAuction = s.source.includes("Auction") || s.source.includes("BCA") || s.source.includes("Blackbushe") || s.source.includes("Paddock");
  return {
    id: s.id,
    companyId: "company-1",
    registration: s.registration,
    stockId: s.stockId,
    tagNumber: null,
    make: s.make,
    model: s.model,
    variantName: s.variant.split(" ")[0] ?? null,
    variantCode: s.variant,
    year: s.year,
    colour: s.colour,
    mileage: s.mileage,
    vehicleType: "car",
    bodyType: s.bodyType,
    fuelType: s.fuelType,
    transmission: s.transmission,
    engineSizeCC: null,
    receivedDate: daysAgo(s.daysInStock),
    receivedBy: "user-3",
    sellerName: isAuction ? s.source : "Private Seller",
    sellerPhone: "07700900000",
    purchaseSource: isAuction ? "auction" : s.source === "Trade-in" ? "trade_in" : s.source === "Private" ? "private" : "dealer",
    purchaseChannel: isAuction ? "supplier" : "vendor",
    supplierId: null,
    customFields: {},
    // Spec v3.0 — Decision F-3 / Chunk 1.5: every seed row is wiped on
    // launch day. Real arrivals from the arrival form default to false.
    isDemo: true,
    localOrImport: s.localOrImport ?? "local",
    auctionHouse: isAuction ? s.source : null,
    ownedBy: "Car Capital UK",
    managedBy: "user-2",
    invoiceDate: daysAgo(s.daysInStock),
    v5Received: true,
    serviceHistory: "partial",
    numKeys: 2,
    lockNut: true,
    motExpiry: s.motExpiry !== undefined ? s.motExpiry : inDays(180),
    vin: null,
    firstRegisteredDate: null,
    buyingPrice: s.buyingPrice,
    vatOnBuyingPrice: 0,
    buyersFee,
    inspectionCharge: null,
    collectionFee,
    deliveryFee: null,
    lateStorageFee: null,
    otherCharges: null,
    totalBuyingPrice,
    financeProvider: "next_gear",
    loadingFee: 85,
    dailyChargeRate: 0.375,
    unloadingFee: 25,
    stockingCharges,
    valueAddition,
    warrantyCost,
    landedCost,
    baseCost,
    minimumSalePrice: s.listingPrice ? s.listingPrice - 1000 : null,
    listingPrice: s.listingPrice,
    sellingPrice,
    dateSold,
    sellingAgent: sellingPrice ? "Sikander" : null,
    grossEarning,
    status: s.status,
    removedFromWebsiteAt: null,
    daysInStock: s.daysInStock,
    imagesCount: s.imagesCount ?? (["listed", "ready"].includes(s.status) ? 12 : 0),
    // Pre-generated seed image baked into the deployment. Vehicles added via
    // the arrival form get heroImageUrl=null and lazy-generate via the API.
    heroImageUrl: SEED_IMAGE_IDS.has(s.id) ? `/cars/seed/${s.id}.png` : null,
    // Module A — physical location (Spec v3.0 · migration 0010).
    currentLocation: SEED_LOCATION_OVERRIDES[s.id] ?? "forecourt",
    locationSince: `${daysAgo(s.daysInStock)}T09:00:00.000Z`,
    outForTestDrive: false,
    testDriveExpectedBackAt: null,
    createdAt: `${daysAgo(s.daysInStock)}T09:00:00.000Z`,
    updatedAt: NOW,
  };
}

export const mockVehicles: Vehicle[] = VEHICLE_SEEDS.map(buildVehicle);

// ============================================================
// LOCATION MOVEMENTS (Module A · Spec v3.0)
// ============================================================
//
// Audit trail of vehicle relocations. Final to_location matches each
// vehicle's `currentLocation` set above so the LocationCard's "Recent
// moves" preview reads consistently. Newest first by createdAt.

export const mockLocationMovements: LocationMovement[] = [
  // vehicle-1 — arrived 17d ago, sent to garage 7d ago, back 2d ago
  { id: "move-1a", vehicleId: "vehicle-1", fromLocation: null,        toLocation: "forecourt", externalVendorId: null,       staffUserId: null,   expectedReturnAt: null,                actualReturnAt: null,                  notes: null,                          createdBy: "user-3", createdAt: `${daysAgo(17)}T09:00:00.000Z` },
  { id: "move-1b", vehicleId: "vehicle-1", fromLocation: "forecourt", toLocation: "garage",    externalVendorId: "vendor-1", staffUserId: null,   expectedReturnAt: `${daysAgo(2)}T17:00:00.000Z`,  actualReturnAt: `${daysAgo(2)}T16:30:00.000Z`, notes: "AC re-gas at Ali's Garage",  createdBy: "user-2", createdAt: `${daysAgo(7)}T11:00:00.000Z` },
  { id: "move-1c", vehicleId: "vehicle-1", fromLocation: "garage",    toLocation: "forecourt", externalVendorId: null,       staffUserId: null,   expectedReturnAt: null,                actualReturnAt: null,                  notes: null,                          createdBy: "user-2", createdAt: `${daysAgo(2)}T16:40:00.000Z` },

  // vehicle-2 — at yard since arrival
  { id: "move-2a", vehicleId: "vehicle-2", fromLocation: null,        toLocation: "yard",      externalVendorId: null,       staffUserId: null,   expectedReturnAt: null,                actualReturnAt: null,                  notes: "Awaiting bodywork slot",      createdBy: "user-3", createdAt: `${daysAgo(34)}T09:00:00.000Z` },

  // vehicle-3 — currently at garage (Ali's), still out
  { id: "move-3a", vehicleId: "vehicle-3", fromLocation: null,        toLocation: "forecourt", externalVendorId: null,       staffUserId: null,   expectedReturnAt: null,                actualReturnAt: null,                  notes: null,                          createdBy: "user-3", createdAt: `${daysAgo(164)}T09:00:00.000Z` },
  { id: "move-3b", vehicleId: "vehicle-3", fromLocation: "forecourt", toLocation: "garage",    externalVendorId: "vendor-2", staffUserId: null,   expectedReturnAt: `${daysAgo(-3)}T17:00:00.000Z`, actualReturnAt: null,                  notes: "Bodywork at Southall Body Shop", createdBy: "user-2", createdAt: `${daysAgo(5)}T10:00:00.000Z` },

  // vehicle-4 — at garage (electrics)
  { id: "move-4a", vehicleId: "vehicle-4", fromLocation: null,        toLocation: "forecourt", externalVendorId: null,       staffUserId: null,   expectedReturnAt: null,                actualReturnAt: null,                  notes: null,                          createdBy: "user-3", createdAt: `${daysAgo(45)}T09:00:00.000Z` },
  { id: "move-4b", vehicleId: "vehicle-4", fromLocation: "forecourt", toLocation: "garage",    externalVendorId: "vendor-4", staffUserId: null,   expectedReturnAt: `${daysAgo(-1)}T17:00:00.000Z`, actualReturnAt: null,                  notes: "PK Auto — battery / electrics", createdBy: "user-2", createdAt: `${daysAgo(2)}T11:30:00.000Z` },

  // vehicle-5 — courtesy car with Sikander (user-6)
  { id: "move-5a", vehicleId: "vehicle-5", fromLocation: null,        toLocation: "forecourt", externalVendorId: null,       staffUserId: null,   expectedReturnAt: null,                actualReturnAt: null,                  notes: null,                          createdBy: "user-3", createdAt: `${daysAgo(28)}T09:00:00.000Z` },
  { id: "move-5b", vehicleId: "vehicle-5", fromLocation: "forecourt", toLocation: "staff",     externalVendorId: null,       staffUserId: "user-6", expectedReturnAt: `${daysAgo(-2)}T17:00:00.000Z`, actualReturnAt: null,                  notes: "Courtesy car while CC-0042 is in for warranty", createdBy: "user-1", createdAt: `${daysAgo(1)}T08:00:00.000Z` },

  // vehicle-8 / vehicle-11 — both at yard since arrival (no separate moves)
  { id: "move-8a",  vehicleId: "vehicle-8",  fromLocation: null, toLocation: "yard", externalVendorId: null, staffUserId: null, expectedReturnAt: null, actualReturnAt: null, notes: "Stocked at yard until prep slot opens", createdBy: "user-3", createdAt: `${daysAgo(12)}T09:00:00.000Z` },
  { id: "move-11a", vehicleId: "vehicle-11", fromLocation: null, toLocation: "yard", externalVendorId: null, staffUserId: null, expectedReturnAt: null, actualReturnAt: null, notes: "Awaiting V5 — yard hold",              createdBy: "user-3", createdAt: `${daysAgo(20)}T09:00:00.000Z` },
];

// ============================================================
// VENDORS
// ============================================================

export const mockVendors: Vendor[] = [
  { id: "vendor-1", companyId: "company-1", name: "Ali's Garage", phone: "02085711234", speciality: "mechanical", active: true },
  { id: "vendor-2", companyId: "company-1", name: "Southall Body Shop", phone: "02085715678", speciality: "bodywork", active: true },
  { id: "vendor-3", companyId: "company-1", name: "Quick Tyres Southall", phone: "02085713344", speciality: "tyres", active: true },
  { id: "vendor-4", companyId: "company-1", name: "PK Auto Electrics", phone: "02085719922", speciality: "electrical", active: true },
  { id: "vendor-5", companyId: "company-1", name: "Uxbridge MOT Centre", phone: "01895258899", speciality: "mot", active: true },
  { id: "vendor-6", companyId: "company-1", name: "Euro Car Parts Southall", phone: "02085718800", speciality: "general", active: true },
];

// ============================================================
// THINGS TO DO (Nissan Juke CC-0004 from physical job card)
// ============================================================

export const mockTodos: TodoItem[] = [
  { id: "todo-1", vehicleId: "vehicle-4", serialNumber: 1, description: "Car does not pickup when slow down", vendorId: null, status: "pending", cost: null, source: "manual", createdBy: "user-2", completedBy: null, completedAt: null, createdAt: hoursAgo(72) },
  { id: "todo-2", vehicleId: "vehicle-4", serialNumber: 2, description: "Driver front wheel makes noise", vendorId: "vendor-1", status: "in_progress", cost: 180, source: "manual", createdBy: "user-2", completedBy: null, completedAt: null, createdAt: hoursAgo(70) },
  { id: "todo-3", vehicleId: "vehicle-4", serialNumber: 3, description: "Fuel smell comes in morning", vendorId: null, status: "pending", cost: null, source: "manual", createdBy: "user-2", completedBy: null, completedAt: null, createdAt: hoursAgo(68) },
  { id: "todo-4", vehicleId: "vehicle-4", serialNumber: 4, description: "Above 40 mph car loses power", vendorId: null, status: "pending", cost: null, source: "manual", createdBy: "user-2", completedBy: null, completedAt: null, createdAt: hoursAgo(66) },
];

// ============================================================
// MAINTENANCE JOBS
// ============================================================

export const mockMaintenanceJobs: MaintenanceJob[] = [
  { id: "maint-1", companyId: "company-1", vehicleId: "vehicle-11", description: "New stock — needs inspection + readiness", assignedTo: "user-7", vendorId: null, estimatedCost: null, actualCost: null, estimatedDurationHours: 2, startDate: null, dueDate: inDays(2), completedDate: null, status: "pending", notes: null, createdAt: hoursAgo(20) },
  { id: "maint-2", companyId: "company-1", vehicleId: "vehicle-15", description: "New stock — needs inspection + readiness", assignedTo: "user-7", vendorId: null, estimatedCost: null, actualCost: null, estimatedDurationHours: 2, startDate: null, dueDate: inDays(3), completedDate: null, status: "pending", notes: null, createdAt: hoursAgo(2) },
  { id: "maint-3", companyId: "company-1", vehicleId: "vehicle-4", description: "Front wheel bearing replacement", assignedTo: null, vendorId: "vendor-1", estimatedCost: 180, actualCost: null, estimatedDurationHours: 4, startDate: daysAgo(2), dueDate: inDays(1), completedDate: null, status: "in_progress", notes: "Vendor confirmed parts arrived", createdAt: hoursAgo(72) },
  { id: "maint-4", companyId: "company-1", vehicleId: "vehicle-14", description: "Full prep + bodywork touch-up", assignedTo: null, vendorId: "vendor-2", estimatedCost: 450, actualCost: null, estimatedDurationHours: 16, startDate: daysAgo(4), dueDate: inDays(3), completedDate: null, status: "in_progress", notes: null, createdAt: daysAgo(5) + "T09:00:00.000Z" },
  { id: "maint-5", companyId: "company-1", vehicleId: "vehicle-13", description: "Pre-listing service + valet", assignedTo: "user-7", vendorId: null, estimatedCost: 200, actualCost: 195, estimatedDurationHours: 6, startDate: daysAgo(8), dueDate: daysAgo(5), completedDate: daysAgo(5), status: "completed", notes: null, createdAt: daysAgo(10) + "T09:00:00.000Z" },
  { id: "maint-6", companyId: "company-1", vehicleId: "vehicle-5", description: "Full prep, valet and photos", assignedTo: "user-7", vendorId: null, estimatedCost: 250, actualCost: 240, estimatedDurationHours: 8, startDate: daysAgo(12), dueDate: daysAgo(8), completedDate: daysAgo(8), status: "completed", notes: null, createdAt: daysAgo(15) + "T09:00:00.000Z" },
  { id: "maint-7", companyId: "company-1", vehicleId: "vehicle-7", description: "Re-list refresh — repolish + price drop review", assignedTo: null, vendorId: null, estimatedCost: 80, actualCost: null, estimatedDurationHours: 2, startDate: daysAgo(20), dueDate: daysAgo(15), completedDate: null, status: "stalled", notes: "Pending owner sign-off on price drop", createdAt: daysAgo(30) + "T09:00:00.000Z" },
  { id: "maint-8", companyId: "company-1", vehicleId: "vehicle-8", description: "Diagnostic + warning lights investigation", assignedTo: null, vendorId: "vendor-4", estimatedCost: 120, actualCost: null, estimatedDurationHours: 3, startDate: null, dueDate: inDays(2), completedDate: null, status: "pending", notes: null, createdAt: hoursAgo(70) },
];

// ============================================================
// WORKSHOP JOBS (external walk-ins)
// ============================================================

export const mockWorkshopJobs: WorkshopJob[] = [
  { id: "ws-1", companyId: "company-1", customerName: "John Smith", customerPhone: "07712345678", vehicleReg: "AB12 CDE", vehicleDescription: "Vauxhall Corsa 2014", description: "AC re-gas + cabin filter", assignedTo: "user-7", estimatedCost: 90, actualCost: null, scheduledDate: TODAY, scheduledTime: "14:30", completedDate: null, status: "pending", notes: null, createdAt: hoursAgo(48) },
  { id: "ws-2", companyId: "company-1", customerName: "Sarah Patel", customerPhone: "07798765432", vehicleReg: "EF63 GHI", vehicleDescription: "Honda Civic 2013", description: "Brake pads front + rear", assignedTo: "user-7", estimatedCost: 220, actualCost: null, scheduledDate: inDays(1), scheduledTime: "10:00", completedDate: null, status: "pending", notes: null, createdAt: hoursAgo(24) },
  { id: "ws-3", companyId: "company-1", customerName: "Mark Lewis", customerPhone: "07811223344", vehicleReg: "JK19 LMN", vehicleDescription: "Ford Focus 2019", description: "Diagnostic — engine light", assignedTo: null, estimatedCost: 60, actualCost: null, scheduledDate: inDays(2), scheduledTime: "09:30", completedDate: null, status: "pending", notes: null, createdAt: hoursAgo(12) },
  { id: "ws-4", companyId: "company-1", customerName: "Priya Singh", customerPhone: "07900112233", vehicleReg: "OP18 QRS", vehicleDescription: "VW Polo 2018", description: "Full service", assignedTo: "user-7", estimatedCost: 180, actualCost: 175, scheduledDate: daysAgo(2), scheduledTime: "11:00", completedDate: daysAgo(2), status: "completed", notes: "Customer happy", createdAt: daysAgo(5) + "T09:00:00.000Z" },
  { id: "ws-5", companyId: "company-1", customerName: "Tom Khan", customerPhone: "07655443322", vehicleReg: "TU16 VWX", vehicleDescription: "Audi A1 2016", description: "Tyre replacement x2 (outsourced to Quick Tyres)", assignedTo: null, estimatedCost: 200, actualCost: 195, scheduledDate: daysAgo(4), scheduledTime: "16:00", completedDate: daysAgo(4), status: "completed", notes: null, createdAt: daysAgo(7) + "T09:00:00.000Z" },
];

// ============================================================
// LISTINGS — one per status='listed' vehicle
// ============================================================

const LISTED_IDS = ["vehicle-1", "vehicle-2", "vehicle-3", "vehicle-6", "vehicle-7", "vehicle-12"];

export const mockListings: Listing[] = LISTED_IDS.map((vid, idx) => {
  const v = mockVehicles.find((veh) => veh.id === vid)!;
  return {
    id: `listing-${idx + 1}`,
    companyId: "company-1",
    vehicleId: vid,
    title: `${v.year} ${v.make} ${v.model} ${v.variantCode ?? ""}`.trim(),
    description: `Stunning ${v.colour.toLowerCase()} ${v.make} ${v.model} with ${v.mileage.toLocaleString()} miles. Full service history. Drives superb.`,
    price: v.listingPrice ?? 0,
    specialFeatures: "Bluetooth, Cruise Control, Parking Sensors, Alloy Wheels",
    channels: { website: true, autotrader: idx % 2 === 0, ebay: idx === 0, facebook: idx < 3 },
    atPriceIndicator: idx === 0 ? "great" : idx === 1 ? "good" : idx === 2 ? "above_average" : "unrated",
    status: "live",
    publishedAt: `${daysAgo(v.daysInStock - 5)}T10:00:00.000Z`,
    enquiriesCount: idx === 0 ? 8 : idx === 5 ? 11 : Math.max(0, 6 - idx),
    createdAt: `${daysAgo(v.daysInStock - 5)}T09:30:00.000Z`,
  };
});

// ============================================================
// LEAD CHANNELS (Spec v3.0 — Decision C-2, seeded by migration 0009)
// ============================================================

export const mockLeadChannels: LeadChannel[] = [
  { id: "channel-1", companyId: "company-1", slug: "website",    label: "Website",    sortOrder: 1, enabled: true, isSystem: true, createdAt: NOW, updatedAt: NOW },
  { id: "channel-2", companyId: "company-1", slug: "phone",      label: "Phone",      sortOrder: 2, enabled: true, isSystem: true, createdAt: NOW, updatedAt: NOW },
  { id: "channel-3", companyId: "company-1", slug: "walk_in",    label: "Walk-in",    sortOrder: 3, enabled: true, isSystem: true, createdAt: NOW, updatedAt: NOW },
  { id: "channel-4", companyId: "company-1", slug: "autotrader", label: "AutoTrader", sortOrder: 4, enabled: true, isSystem: true, createdAt: NOW, updatedAt: NOW },
  { id: "channel-5", companyId: "company-1", slug: "ebay",       label: "eBay",       sortOrder: 5, enabled: true, isSystem: true, createdAt: NOW, updatedAt: NOW },
  { id: "channel-6", companyId: "company-1", slug: "facebook",   label: "Facebook",   sortOrder: 6, enabled: true, isSystem: true, createdAt: NOW, updatedAt: NOW },
  { id: "channel-7", companyId: "company-1", slug: "instagram",  label: "Instagram",  sortOrder: 7, enabled: true, isSystem: true, createdAt: NOW, updatedAt: NOW },
  { id: "channel-8", companyId: "company-1", slug: "referral",   label: "Referral",   sortOrder: 8, enabled: true, isSystem: true, createdAt: NOW, updatedAt: NOW },
  { id: "channel-9", companyId: "company-1", slug: "other",      label: "Other",      sortOrder: 9, enabled: true, isSystem: true, createdAt: NOW, updatedAt: NOW },
];

// ============================================================
// LEADS
// ============================================================

export const mockLeads: Lead[] = [
  { id: "lead-1", companyId: "company-1", customerName: "James Wilson", customerPhone: "07711100001", customerEmail: "james.w@example.com", vehicleInterest: "AUDI A3 (LX68 CZK)", vehicleId: "vehicle-1", source: "website", status: "new", assignedTo: "user-6", notes: "Asked about HP finance", appointmentId: null, createdAt: hoursAgo(4), updatedAt: hoursAgo(4) },
  { id: "lead-2", companyId: "company-1", customerName: "Aisha Khan", customerPhone: "07711100002", customerEmail: "aisha@example.com", vehicleInterest: "AUDI Q3 (KR71 FRP)", vehicleId: "vehicle-12", source: "autotrader", status: "new", assignedTo: "user-6", notes: null, appointmentId: null, createdAt: hoursAgo(8), updatedAt: hoursAgo(8) },
  { id: "lead-3", companyId: "company-1", customerName: "Robert Smith", customerPhone: "07711100003", customerEmail: null, vehicleInterest: "BMW 2 SERIES GRAN TOURER (LJ17 MKA)", vehicleId: "vehicle-7", source: "phone", status: "new", assignedTo: "user-6", notes: "Wants test drive Saturday", appointmentId: null, createdAt: hoursAgo(14), updatedAt: hoursAgo(14) },
  { id: "lead-4", companyId: "company-1", customerName: "Michelle Brown", customerPhone: "07711100004", customerEmail: "mb@example.com", vehicleInterest: "AUDI RS7 (BW17 NLL)", vehicleId: "vehicle-6", source: "website", status: "new", assignedTo: "user-6", notes: null, appointmentId: null, createdAt: hoursAgo(22), updatedAt: hoursAgo(22) },
  { id: "lead-5", companyId: "company-1", customerName: "Daniel Lee", customerPhone: "07711100005", customerEmail: "dlee@example.com", vehicleInterest: "AUDI A3 (SA17 WUV)", vehicleId: "vehicle-2", source: "facebook", status: "contacted", assignedTo: "user-6", notes: "Replied via WhatsApp", appointmentId: null, createdAt: daysAgo(2) + "T11:00:00.000Z", updatedAt: hoursAgo(30) },
  { id: "lead-6", companyId: "company-1", customerName: "Sophia Martinez", customerPhone: "07711100006", customerEmail: "sm@example.com", vehicleInterest: "AUDI Q2 (MV17 HFJ)", vehicleId: "vehicle-5", source: "ebay", status: "contacted", assignedTo: "user-6", notes: null, appointmentId: null, createdAt: daysAgo(3) + "T13:00:00.000Z", updatedAt: daysAgo(2) + "T15:00:00.000Z" },
  { id: "lead-7", companyId: "company-1", customerName: "Olivia Taylor", customerPhone: "07711100007", customerEmail: "ot@example.com", vehicleInterest: "AUDI A4 (YN63 NFA)", vehicleId: "vehicle-3", source: "website", status: "appointment_booked", assignedTo: "user-6", notes: "Booked for tomorrow 2pm", appointmentId: "appt-1", createdAt: daysAgo(4) + "T10:00:00.000Z", updatedAt: hoursAgo(20) },
  { id: "lead-8", companyId: "company-1", customerName: "William Clark", customerPhone: "07711100008", customerEmail: null, vehicleInterest: "TOYOTA YARIS (HN20 BYE)", vehicleId: "vehicle-13", source: "walk_in", status: "appointment_booked", assignedTo: "user-6", notes: null, appointmentId: "appt-2", createdAt: daysAgo(5) + "T09:00:00.000Z", updatedAt: daysAgo(2) + "T11:00:00.000Z" },
  { id: "lead-9", companyId: "company-1", customerName: "Emma Davies", customerPhone: "07711100009", customerEmail: "ed@example.com", vehicleInterest: "AUDI A3 (LX68 CZK)", vehicleId: "vehicle-1", source: "autotrader", status: "lost", assignedTo: "user-6", notes: "Bought elsewhere", appointmentId: null, createdAt: daysAgo(7) + "T10:00:00.000Z", updatedAt: daysAgo(3) + "T16:00:00.000Z" },
  { id: "lead-10", companyId: "company-1", customerName: "Henry Phillips", customerPhone: "07711100010", customerEmail: "hp@example.com", vehicleInterest: "AUDI A6 SALOON (LB64 ZHM)", vehicleId: "vehicle-14", source: "referral", status: "contacted", assignedTo: "user-6", notes: null, appointmentId: null, createdAt: daysAgo(2) + "T14:30:00.000Z", updatedAt: daysAgo(1) + "T10:00:00.000Z" },
  { id: "lead-11", companyId: "company-1", customerName: "Charlotte Reed", customerPhone: "07711100011", customerEmail: "cr@example.com", vehicleInterest: "AUDI RS7 (BW17 NLL)", vehicleId: "vehicle-6", source: "website", status: "lost", assignedTo: "user-6", notes: "Not the spec they wanted", appointmentId: null, createdAt: daysAgo(10) + "T10:00:00.000Z", updatedAt: daysAgo(8) + "T10:00:00.000Z" },
  { id: "lead-12", companyId: "company-1", customerName: "Liam Cooper", customerPhone: "07711100012", customerEmail: "lc@example.com", vehicleInterest: "AUDI Q3 (KR71 FRP)", vehicleId: "vehicle-12", source: "phone", status: "appointment_booked", assignedTo: "user-6", notes: null, appointmentId: "appt-3", createdAt: daysAgo(3) + "T15:00:00.000Z", updatedAt: daysAgo(1) + "T12:00:00.000Z" },
];

// ============================================================
// APPOINTMENTS
// ============================================================

export const mockAppointments: Appointment[] = [
  { id: "appt-1", companyId: "company-1", vehicleId: "vehicle-3", leadId: "lead-7", customerName: "Olivia Taylor", customerPhone: "07711100007", customerEmail: "ot@example.com", date: inDays(1), time: "14:00", specialRequirements: null, status: "upcoming", outcome: "pending", notificationsSent: { whatsapp: true, email: true }, createdBy: "user-6", createdAt: hoursAgo(20) },
  { id: "appt-2", companyId: "company-1", vehicleId: "vehicle-13", leadId: "lead-8", customerName: "William Clark", customerPhone: "07711100008", customerEmail: "william@example.com", date: inDays(2), time: "11:00", specialRequirements: "Test drive on motorway requested", status: "upcoming", outcome: "pending", notificationsSent: { whatsapp: true, email: false }, createdBy: "user-6", createdAt: daysAgo(2) + "T11:00:00.000Z" },
  { id: "appt-3", companyId: "company-1", vehicleId: "vehicle-12", leadId: "lead-12", customerName: "Liam Cooper", customerPhone: "07711100012", customerEmail: "lc@example.com", date: inDays(3), time: "10:30", specialRequirements: null, status: "upcoming", outcome: "pending", notificationsSent: { whatsapp: true, email: true }, createdBy: "user-6", createdAt: daysAgo(1) + "T12:00:00.000Z" },
  { id: "appt-4", companyId: "company-1", vehicleId: "vehicle-1", leadId: null, customerName: "John Smith", customerPhone: "07700300001", customerEmail: "js@example.com", date: TODAY, time: "10:00", specialRequirements: null, status: "upcoming", outcome: "pending", notificationsSent: { whatsapp: true, email: true }, createdBy: "user-6", createdAt: hoursAgo(48) },
  { id: "appt-5", companyId: "company-1", vehicleId: "vehicle-9", leadId: null, customerName: "Mary Johnson", customerPhone: "07700300002", customerEmail: "mj@example.com", date: daysAgo(5), time: "14:00", specialRequirements: null, status: "completed", outcome: "deposit_taken", notificationsSent: { whatsapp: true, email: true }, createdBy: "user-6", createdAt: daysAgo(8) + "T09:00:00.000Z" },
  { id: "appt-6", companyId: "company-1", vehicleId: "vehicle-10", leadId: null, customerName: "Peter Hill", customerPhone: "07700300003", customerEmail: "ph@example.com", date: daysAgo(6), time: "16:30", specialRequirements: null, status: "completed", outcome: "sold", notificationsSent: { whatsapp: true, email: true }, createdBy: "user-6", createdAt: daysAgo(9) + "T09:00:00.000Z" },
  { id: "appt-7", companyId: "company-1", vehicleId: "vehicle-2", leadId: null, customerName: "Anna Edwards", customerPhone: "07700300004", customerEmail: "ae@example.com", date: daysAgo(4), time: "11:30", specialRequirements: null, status: "completed", outcome: "test_drive", notificationsSent: { whatsapp: true, email: true }, createdBy: "user-6", createdAt: daysAgo(7) + "T09:00:00.000Z" },
  { id: "appt-8", companyId: "company-1", vehicleId: "vehicle-3", leadId: null, customerName: "Karim Aziz", customerPhone: "07700300005", customerEmail: "ka@example.com", date: daysAgo(7), time: "10:00", specialRequirements: null, status: "completed", outcome: "offer_made", notificationsSent: { whatsapp: false, email: true }, createdBy: "user-6", createdAt: daysAgo(10) + "T09:00:00.000Z" },
  { id: "appt-9", companyId: "company-1", vehicleId: "vehicle-6", leadId: "lead-11", customerName: "Charlotte Reed", customerPhone: "07711100011", customerEmail: "cr@example.com", date: daysAgo(8), time: "13:00", specialRequirements: null, status: "cancelled", outcome: "lost", notificationsSent: { whatsapp: true, email: true }, createdBy: "user-6", createdAt: daysAgo(11) + "T09:00:00.000Z" },
  { id: "appt-10", companyId: "company-1", vehicleId: "vehicle-7", leadId: null, customerName: "Daniel Foster", customerPhone: "07700300006", customerEmail: "df@example.com", date: daysAgo(3), time: "15:00", specialRequirements: null, status: "cancelled", outcome: "pending", notificationsSent: { whatsapp: true, email: false }, createdBy: "user-6", createdAt: daysAgo(6) + "T09:00:00.000Z" },
];

// ============================================================
// SALES DEALS — at least one per stage including 1 lost
// ============================================================

export const mockSalesDeals: SalesDeal[] = [
  { id: "deal-1", companyId: "company-1", vehicleId: "vehicle-1", leadId: "lead-1", customerName: "James Wilson", customerPhone: "07711100001", customerEmail: "james.w@example.com", stage: "new_lead", offerPrice: null, agreedPrice: null, depositAmount: null, depositDate: null, collectionDate: null, completionDate: null, sellingAgent: "user-6", notes: null, createdAt: hoursAgo(4), updatedAt: hoursAgo(4) },
  { id: "deal-2", companyId: "company-1", vehicleId: "vehicle-12", leadId: "lead-2", customerName: "Aisha Khan", customerPhone: "07711100002", customerEmail: "aisha@example.com", stage: "contacted", offerPrice: null, agreedPrice: null, depositAmount: null, depositDate: null, collectionDate: null, completionDate: null, sellingAgent: "user-6", notes: null, createdAt: hoursAgo(8), updatedAt: hoursAgo(2) },
  { id: "deal-3", companyId: "company-1", vehicleId: "vehicle-3", leadId: "lead-7", customerName: "Olivia Taylor", customerPhone: "07711100007", customerEmail: "ot@example.com", stage: "test_drive", offerPrice: null, agreedPrice: null, depositAmount: null, depositDate: null, collectionDate: null, completionDate: null, sellingAgent: "user-6", notes: null, createdAt: daysAgo(4) + "T10:00:00.000Z", updatedAt: hoursAgo(20) },
  { id: "deal-4", companyId: "company-1", vehicleId: "vehicle-2", leadId: null, customerName: "Anna Edwards", customerPhone: "07700300004", customerEmail: "ae@example.com", stage: "offer_made", offerPrice: 12800, agreedPrice: null, depositAmount: null, depositDate: null, collectionDate: null, completionDate: null, sellingAgent: "user-6", notes: "Offered £12,800, considering counter", createdAt: daysAgo(4) + "T11:30:00.000Z", updatedAt: daysAgo(2) + "T14:00:00.000Z" },
  { id: "deal-5", companyId: "company-1", vehicleId: "vehicle-9", leadId: null, customerName: "Mary Johnson", customerPhone: "07700300002", customerEmail: "mj@example.com", stage: "deposit_taken", offerPrice: 3300, agreedPrice: 3300, depositAmount: 500, depositDate: daysAgo(5), collectionDate: inDays(2), completionDate: null, sellingAgent: "user-6", notes: null, createdAt: daysAgo(8) + "T09:00:00.000Z", updatedAt: daysAgo(5) + "T14:00:00.000Z" },
  { id: "deal-6", companyId: "company-1", vehicleId: "vehicle-10", leadId: null, customerName: "Peter Hill", customerPhone: "07700300003", customerEmail: "ph@example.com", stage: "completed_sale", offerPrice: 2150, agreedPrice: 2175, depositAmount: 200, depositDate: daysAgo(6), collectionDate: daysAgo(5), completionDate: daysAgo(5), sellingAgent: "user-6", notes: "Cash sale", createdAt: daysAgo(9) + "T09:00:00.000Z", updatedAt: daysAgo(5) + "T17:00:00.000Z" },
  { id: "deal-7", companyId: "company-1", vehicleId: "vehicle-6", leadId: "lead-11", customerName: "Charlotte Reed", customerPhone: "07711100011", customerEmail: "cr@example.com", stage: "lost", offerPrice: 36000, agreedPrice: null, depositAmount: null, depositDate: null, collectionDate: null, completionDate: null, sellingAgent: "user-6", notes: "Lost to competitor", createdAt: daysAgo(10) + "T10:00:00.000Z", updatedAt: daysAgo(8) + "T10:00:00.000Z" },
];

// ============================================================
// WARRANTIES & CLAIMS
// ============================================================

export const mockWarranties: Warranty[] = [
  // -------- In-house (9 total) --------
  { id: "warranty-1", companyId: "company-1", vehicleId: "vehicle-9", saleDealId: "deal-5", customerName: "Mary Johnson", customerPhone: "07700300002", customerEmail: "mj@example.com", type: "in_house", provider: null, coverageDetails: "3-month engine and gearbox cover", startDate: daysAgo(5), endDate: inDays(85), costToDealership: 0, costToCustomer: 0, status: "active", purchaseStatus: "n_a", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: true, createdAt: daysAgo(5) + "T16:00:00.000Z" },
  { id: "warranty-2", companyId: "company-1", vehicleId: "vehicle-10", saleDealId: "deal-6", customerName: "Peter Hill", customerPhone: "07700300003", customerEmail: "ph@example.com", type: "in_house", provider: null, coverageDetails: "1-month basic cover", startDate: daysAgo(5), endDate: inDays(25), costToDealership: 0, costToCustomer: 0, status: "active", purchaseStatus: "n_a", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: true, createdAt: daysAgo(5) + "T17:30:00.000Z" },
  { id: "warranty-4", companyId: "company-1", vehicleId: "vehicle-10", saleDealId: null, customerName: "Earlier Customer", customerPhone: "07700400001", customerEmail: null, type: "in_house", provider: null, coverageDetails: "Expired 3-month cover", startDate: daysAgo(120), endDate: daysAgo(30), costToDealership: 0, costToCustomer: 0, status: "expired", purchaseStatus: "n_a", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: true, createdAt: daysAgo(120) + "T09:00:00.000Z" },
  { id: "warranty-5", companyId: "company-1", vehicleId: "vehicle-9", saleDealId: null, customerName: "Mary Johnson", customerPhone: "07700300002", customerEmail: "mj@example.com", type: "in_house", provider: null, coverageDetails: "Special goodwill cover — has open claim", startDate: daysAgo(20), endDate: inDays(70), costToDealership: 0, costToCustomer: 0, status: "active", purchaseStatus: "n_a", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: true, createdAt: daysAgo(20) + "T09:00:00.000Z" },
  { id: "warranty-6", companyId: "company-1", vehicleId: "vehicle-15", saleDealId: null, customerName: "Priya Patel", customerPhone: "07700300010", customerEmail: "priya.patel@example.com", type: "in_house", provider: null, coverageDetails: "3-month engine, gearbox, electrics", startDate: daysAgo(8), endDate: inDays(82), costToDealership: 0, costToCustomer: 0, status: "active", purchaseStatus: "n_a", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: true, createdAt: daysAgo(8) + "T10:00:00.000Z" },
  { id: "warranty-7", companyId: "company-1", vehicleId: "vehicle-22", saleDealId: null, customerName: "Liam O'Brien", customerPhone: "07700300011", customerEmail: "liam.ob@example.com", type: "in_house", provider: null, coverageDetails: "6-month drivetrain cover", startDate: daysAgo(35), endDate: inDays(145), costToDealership: 0, costToCustomer: 0, status: "active", purchaseStatus: "n_a", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: true, createdAt: daysAgo(35) + "T13:00:00.000Z" },
  { id: "warranty-8", companyId: "company-1", vehicleId: "vehicle-30", saleDealId: null, customerName: "Sarah Johnson", customerPhone: "07700300012", customerEmail: "sarahj@example.com", type: "in_house", provider: null, coverageDetails: "3-month basic cover (expired)", startDate: daysAgo(180), endDate: daysAgo(90), costToDealership: 0, costToCustomer: 0, status: "expired", purchaseStatus: "n_a", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: true, createdAt: daysAgo(180) + "T09:00:00.000Z" },
  { id: "warranty-9", companyId: "company-1", vehicleId: "vehicle-44", saleDealId: null, customerName: "Michael Chen", customerPhone: "07700300013", customerEmail: "michael.chen@example.com", type: "in_house", provider: null, coverageDetails: "12-month comprehensive in-house cover", startDate: daysAgo(60), endDate: inDays(305), costToDealership: 0, costToCustomer: 0, status: "active", purchaseStatus: "n_a", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: true, createdAt: daysAgo(60) + "T11:30:00.000Z" },
  { id: "warranty-10", companyId: "company-1", vehicleId: "vehicle-50", saleDealId: null, customerName: "Aisha Khan", customerPhone: "07700300014", customerEmail: "aisha.k@example.com", type: "in_house", provider: null, coverageDetails: "6-month engine cover", startDate: daysAgo(45), endDate: inDays(135), costToDealership: 0, costToCustomer: 0, status: "active", purchaseStatus: "n_a", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: true, createdAt: daysAgo(45) + "T15:45:00.000Z" },

  // -------- External (5 total) --------
  { id: "warranty-3", companyId: "company-1", vehicleId: "vehicle-9", saleDealId: null, customerName: "Mary Johnson", customerPhone: "07700300002", customerEmail: "mj@example.com", type: "external", provider: "AA Warranty", coverageDetails: "12-month comprehensive — engine, gearbox, electrics", startDate: daysAgo(5), endDate: inDays(360), costToDealership: 250, costToCustomer: 350, status: "active", purchaseStatus: "purchased", purchasedAt: daysAgo(5) + "T16:30:00.000Z", purchasedBy: "user-1", providerReference: "AA-2026-00123", certificateGenerated: true, createdAt: daysAgo(5) + "T16:30:00.000Z" },
  { id: "warranty-11", companyId: "company-1", vehicleId: "vehicle-7", saleDealId: null, customerName: "Tom Williams", customerPhone: "07700300020", customerEmail: "tom.williams@example.com", type: "external", provider: "Warranty First", coverageDetails: "24-month bumper-to-bumper", startDate: daysAgo(75), endDate: inDays(655), costToDealership: 280, costToCustomer: 395, status: "active", purchaseStatus: "pending", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: false, createdAt: daysAgo(75) + "T10:00:00.000Z" },
  { id: "warranty-12", companyId: "company-1", vehicleId: "vehicle-12", saleDealId: null, customerName: "Hannah Roberts", customerPhone: "07700300021", customerEmail: "hannah.r@example.com", type: "external", provider: "AA Warranty", coverageDetails: "12-month standard cover", startDate: daysAgo(18), endDate: inDays(347), costToDealership: 320, costToCustomer: 449, status: "active", purchaseStatus: "pending", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: false, createdAt: daysAgo(18) + "T12:00:00.000Z" },
  { id: "warranty-13", companyId: "company-1", vehicleId: "vehicle-29", saleDealId: null, customerName: "David Singh", customerPhone: "07700300022", customerEmail: "david.s@example.com", type: "external", provider: "RAC Warranty", coverageDetails: "12-month engine and transmission", startDate: daysAgo(9), endDate: inDays(356), costToDealership: 250, costToCustomer: 350, status: "active", purchaseStatus: "pending", purchasedAt: null, purchasedBy: null, providerReference: null, certificateGenerated: false, createdAt: daysAgo(9) + "T09:00:00.000Z" },
  { id: "warranty-14", companyId: "company-1", vehicleId: "vehicle-35", saleDealId: null, customerName: "Lucy Edwards", customerPhone: "07700300023", customerEmail: "lucy.e@example.com", type: "external", provider: "MotorEasy", coverageDetails: "24-month premium", startDate: daysAgo(30), endDate: inDays(700), costToDealership: 295, costToCustomer: 425, status: "active", purchaseStatus: "purchased", purchasedAt: daysAgo(28) + "T14:00:00.000Z", purchasedBy: "user-2", providerReference: "ME-2026-7890", certificateGenerated: true, createdAt: daysAgo(30) + "T11:00:00.000Z" },
];

export const mockClaims: WarrantyClaim[] = [
  { id: "claim-1", warrantyId: "warranty-5", vehicleId: "vehicle-9", companyId: "company-1", customerName: "Mary Johnson", issueDescription: "Gearbox slipping in second gear", isComplaint: false, estimatedCost: 800, actualCost: null, status: "open", resolution: null, createdAt: hoursAgo(36), resolvedAt: null },
  { id: "claim-2", warrantyId: "warranty-1", vehicleId: "vehicle-9", companyId: "company-1", customerName: "Mary Johnson", issueDescription: "Customer feels brakes are noisy and dealer should cover", isComplaint: true, estimatedCost: 200, actualCost: null, status: "under_review", resolution: null, createdAt: hoursAgo(20), resolvedAt: null },
  { id: "claim-3", warrantyId: "warranty-4", vehicleId: "vehicle-10", companyId: "company-1", customerName: "Earlier Customer", issueDescription: "Aircon not cooling", isComplaint: false, estimatedCost: 90, actualCost: 85, status: "resolved", resolution: "Re-gas under in-house warranty — completed and charged to dealership", createdAt: daysAgo(45) + "T09:00:00.000Z", resolvedAt: daysAgo(40) + "T10:00:00.000Z" },
  { id: "claim-4", warrantyId: "warranty-9", vehicleId: "vehicle-44", companyId: "company-1", customerName: "Michael Chen", issueDescription: "Repeated misfire when cold; customer increasingly frustrated", isComplaint: true, estimatedCost: 650, actualCost: 580, status: "approved", resolution: "Spark plugs + coil pack replaced. Awaiting customer pickup.", createdAt: daysAgo(12) + "T09:00:00.000Z", resolvedAt: null },
];

// ============================================================
// INVOICES
// ============================================================

interface LegacyLineLiteral {
  id: string;
  lineType: InvoiceLineType;
  addonType: AddonType | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
}
interface LegacyInvoiceLiteral {
  id: string;
  companyId: string;
  type: InvoiceType;
  vehicleId: string | null;
  partyName: string;
  partyPhone: string | null;
  partyEmail: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  buyerAddress: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  vatScheme: VatScheme | LegacyVatScheme;
  lineItems: LegacyLineLiteral[];
  subtotal: number;
  addonsTotal: number;
  discountTotal: number;
  vatAmount: number;
  total: number;
  payment: InvoicePayment | null;
  status: InvoiceStatus;
  notes: string | null;
  attachmentUrl: string | null;
  relatedReturnId: string | null;
  relatedInvoiceId: string | null;
  createdAt: string;
}

function legacyVatToNew(s: VatScheme | LegacyVatScheme): VatScheme {
  if (s === "margin") return "margin_used";
  if (s === "standard") return "standard_20";
  return s as VatScheme;
}

function legacyLineToNew(l: LegacyLineLiteral): InvoiceLineItem {
  const itemType: InvoiceLineItemType =
    l.lineType === "vehicle"
      ? "vehicle_price"
      : l.lineType === "discount"
        ? "discount"
        : l.lineType === "addon"
          ? l.unitPrice > 0
            ? "addon_paid"
            : "addon_free"
          : "addon_paid"; // legacy "fee"
  return {
    id: l.id,
    type: itemType,
    description: l.description,
    addonCategory: l.addonType,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    total: l.subtotal,
    vatAmount: l.vatAmount,
    // legacy aliases retained for the invoicing list / refund flow
    lineType: l.lineType,
    addonType: l.addonType,
    subtotal: l.subtotal,
    vatRate: l.vatRate,
  };
}

/**
 * Adapt the pre-spec mock invoice literals to the compatibility-superset
 * `Invoice` type so seed data still satisfies the new shape without
 * rewriting ~10 fixtures by hand.
 */
function legacyMockInvoice(r: LegacyInvoiceLiteral): Invoice {
  const vehicleLine = r.lineItems.find((l) => l.lineType === "vehicle");
  return {
    ...r,
    vatScheme: legacyVatToNew(r.vatScheme),
    lineItems: r.lineItems.map(legacyLineToNew),
    buyerPostcode: null,
    presentMileage: null,
    dorDate: null,
    salesPrice: vehicleLine?.subtotal ?? 0,
    discount: Math.abs(r.discountTotal),
    paidAddonsTotal: r.addonsTotal,
    grandTotalInclAddons: r.total,
    depositAmount: r.payment?.depositAmount ?? 0,
    depositReceivedDate: null,
    depositMethod: r.payment?.depositMethod ?? null,
    financeAmount: r.payment?.financeAmount ?? 0,
    financeProvider: r.payment?.financeProvider ?? null,
    balanceDue: r.payment?.balanceDue ?? 0,
    balanceDueBy: r.payment?.balanceDueBy ?? null,
    warranty: null,
    nonWarrantyDisclaimerAccepted: false,
    preDeliveryCheck: null,
    includeUnitStockingNote: true,
    includeIdRequirementNote: true,
    includeServiceHistoryNote: true,
    customNote: null,
    saleId: null,
    createdBy: null,
    issuedAt: null,
  };
}

const mockInvoiceSeeds: LegacyInvoiceLiteral[] = [
  // ----------------------------------------------------------------------
  // PURCHASE INVOICES (4 from BCA — zero-rated, no buyer block)
  // ----------------------------------------------------------------------
  {
    id: "inv-1", companyId: "company-1", type: "purchase", vehicleId: "vehicle-1",
    partyName: "BCA Auction", partyPhone: "01234567890", partyEmail: "accounts@bca.co.uk",
    buyerName: null, buyerPhone: null, buyerEmail: null, buyerAddress: null,
    invoiceNumber: "BCA-2025-12-001", invoiceDate: daysAgo(147), dueDate: daysAgo(140),
    vatScheme: "zero_rated",
    lineItems: [
      { id: "li-1", lineType: "vehicle", addonType: null, description: "AUDI A3 LX68 CZK", quantity: 1, unitPrice: 8500, vatRate: 0, subtotal: 8500, vatAmount: 0 },
      { id: "li-2", lineType: "fee", addonType: null, description: "Buyer's fee", quantity: 1, unitPrice: 200, vatRate: 0.2, subtotal: 200, vatAmount: 40 },
    ],
    subtotal: 8700, addonsTotal: 0, discountTotal: 0, vatAmount: 40, total: 8740,
    payment: null, status: "paid", notes: null, attachmentUrl: null, relatedReturnId: null, relatedInvoiceId: null,
    createdAt: daysAgo(147) + "T09:00:00.000Z",
  },
  {
    id: "inv-2", companyId: "company-1", type: "purchase", vehicleId: "vehicle-7",
    partyName: "BCA Auction", partyPhone: "01234567890", partyEmail: "accounts@bca.co.uk",
    buyerName: null, buyerPhone: null, buyerEmail: null, buyerAddress: null,
    invoiceNumber: "BCA-2025-06-099", invoiceDate: daysAgo(314), dueDate: daysAgo(307),
    vatScheme: "zero_rated",
    lineItems: [
      { id: "li-3", lineType: "vehicle", addonType: null, description: "BMW 2 SERIES LJ17 MKA", quantity: 1, unitPrice: 6200, vatRate: 0, subtotal: 6200, vatAmount: 0 },
      { id: "li-4", lineType: "fee", addonType: null, description: "Buyer's fee", quantity: 1, unitPrice: 200, vatRate: 0.2, subtotal: 200, vatAmount: 40 },
    ],
    subtotal: 6400, addonsTotal: 0, discountTotal: 0, vatAmount: 40, total: 6440,
    payment: null, status: "paid", notes: null, attachmentUrl: null, relatedReturnId: null, relatedInvoiceId: null,
    createdAt: daysAgo(314) + "T09:00:00.000Z",
  },
  {
    id: "inv-3", companyId: "company-1", type: "purchase", vehicleId: "vehicle-12",
    partyName: "BCA Auction", partyPhone: "01234567890", partyEmail: "accounts@bca.co.uk",
    buyerName: null, buyerPhone: null, buyerEmail: null, buyerAddress: null,
    invoiceNumber: "BCA-2026-01-244", invoiceDate: daysAgo(95), dueDate: daysAgo(88),
    vatScheme: "zero_rated",
    lineItems: [
      { id: "li-5", lineType: "vehicle", addonType: null, description: "AUDI Q3 KR71 FRP", quantity: 1, unitPrice: 14200, vatRate: 0, subtotal: 14200, vatAmount: 0 },
    ],
    subtotal: 14200, addonsTotal: 0, discountTotal: 0, vatAmount: 0, total: 14200,
    payment: null, status: "paid", notes: null, attachmentUrl: null, relatedReturnId: null, relatedInvoiceId: null,
    createdAt: daysAgo(95) + "T09:00:00.000Z",
  },
  {
    id: "inv-4", companyId: "company-1", type: "purchase", vehicleId: "vehicle-15",
    partyName: "BCA Auction", partyPhone: "01234567890", partyEmail: "accounts@bca.co.uk",
    buyerName: null, buyerPhone: null, buyerEmail: null, buyerAddress: null,
    invoiceNumber: "BCA-2026-04-077", invoiceDate: daysAgo(1), dueDate: inDays(7),
    vatScheme: "zero_rated",
    lineItems: [
      { id: "li-6", lineType: "vehicle", addonType: null, description: "RANGE ROVER EVOQUE DE71 FRG", quantity: 1, unitPrice: 15850, vatRate: 0, subtotal: 15850, vatAmount: 0 },
    ],
    subtotal: 15850, addonsTotal: 0, discountTotal: 0, vatAmount: 0, total: 15850,
    payment: null, status: "sent", notes: null, attachmentUrl: null, relatedReturnId: null, relatedInvoiceId: null,
    createdAt: daysAgo(1) + "T09:00:00.000Z",
  },
  // ----------------------------------------------------------------------
  // SALE INVOICES (4)
  // inv-5 carries a structured payment breakdown (deposit + balance due) so
  // the v4.1 deposit-taken → invoice flow demos correctly in TC-E2E-001.
  // ----------------------------------------------------------------------
  {
    id: "inv-5", companyId: "company-1", type: "sale", vehicleId: "vehicle-9",
    partyName: "Mary Johnson", partyPhone: "07700300002", partyEmail: "mj@example.com",
    buyerName: "Mary Johnson", buyerPhone: "07700300002", buyerEmail: "mj@example.com",
    buyerAddress: "12 Maple Street, Slough, SL1 1AA",
    invoiceNumber: "INV-2026-0001", invoiceDate: daysAgo(5), dueDate: daysAgo(5),
    vatScheme: "margin",
    lineItems: [
      { id: "li-7", lineType: "vehicle", addonType: null, description: "VAUXHALL ASTRA PK63 XAW", quantity: 1, unitPrice: 3300, vatRate: 0, subtotal: 3300, vatAmount: 241.67 },
    ],
    subtotal: 3300, addonsTotal: 0, discountTotal: 0, vatAmount: 241.67, total: 3300,
    payment: {
      id: "pay-1", invoiceId: "inv-5",
      depositAmount: 500, depositMethod: "card",
      financeAmount: 0, financeProvider: null,
      balanceDue: 2800, balanceDueBy: daysAgo(5),
    },
    status: "paid", notes: null, attachmentUrl: null, relatedReturnId: null, relatedInvoiceId: null,
    createdAt: daysAgo(5) + "T16:00:00.000Z",
  },
  {
    id: "inv-6", companyId: "company-1", type: "sale", vehicleId: "vehicle-10",
    partyName: "Peter Hill", partyPhone: "07700300003", partyEmail: "ph@example.com",
    buyerName: "Peter Hill", buyerPhone: "07700300003", buyerEmail: "ph@example.com",
    buyerAddress: "44 Beech Avenue, Hounslow, TW3 4QT",
    invoiceNumber: "INV-2026-0002", invoiceDate: daysAgo(5), dueDate: daysAgo(5),
    vatScheme: "margin",
    lineItems: [
      { id: "li-8", lineType: "vehicle", addonType: null, description: "SMART FORTWO WF58 KXY", quantity: 1, unitPrice: 2175, vatRate: 0, subtotal: 2175, vatAmount: 220.83 },
    ],
    subtotal: 2175, addonsTotal: 0, discountTotal: 0, vatAmount: 220.83, total: 2175,
    payment: {
      id: "pay-2", invoiceId: "inv-6",
      depositAmount: 2175, depositMethod: "bank_transfer",
      financeAmount: 0, financeProvider: null,
      balanceDue: 0, balanceDueBy: null,
    },
    status: "paid", notes: null, attachmentUrl: null, relatedReturnId: null, relatedInvoiceId: null,
    createdAt: daysAgo(5) + "T17:00:00.000Z",
  },
  {
    id: "inv-7", companyId: "company-1", type: "sale", vehicleId: "vehicle-9",
    partyName: "Mary Johnson", partyPhone: "07700300002", partyEmail: "mj@example.com",
    buyerName: "Mary Johnson", buyerPhone: "07700300002", buyerEmail: "mj@example.com",
    buyerAddress: "12 Maple Street, Slough, SL1 1AA",
    invoiceNumber: "INV-2026-0003", invoiceDate: daysAgo(5), dueDate: inDays(3),
    vatScheme: "standard",
    lineItems: [
      { id: "li-9", lineType: "addon", addonType: "warranty", description: "AA Warranty 12-month", quantity: 1, unitPrice: 350, vatRate: 0.2, subtotal: 350, vatAmount: 70 },
    ],
    subtotal: 350, addonsTotal: 350, discountTotal: 0, vatAmount: 70, total: 420,
    payment: null,
    status: "sent", notes: null, attachmentUrl: null, relatedReturnId: null, relatedInvoiceId: null,
    createdAt: daysAgo(5) + "T16:30:00.000Z",
  },
  {
    id: "inv-8", companyId: "company-1", type: "sale", vehicleId: null,
    partyName: "Walk-in Customer", partyPhone: null, partyEmail: null,
    buyerName: "Walk-in Customer", buyerPhone: null, buyerEmail: null, buyerAddress: null,
    invoiceNumber: "INV-2026-0004", invoiceDate: daysAgo(2), dueDate: daysAgo(2),
    vatScheme: "standard",
    lineItems: [
      { id: "li-10", lineType: "fee", addonType: null, description: "Workshop service — full service", quantity: 1, unitPrice: 175, vatRate: 0.2, subtotal: 175, vatAmount: 35 },
    ],
    subtotal: 175, addonsTotal: 0, discountTotal: 0, vatAmount: 35, total: 210,
    payment: null,
    status: "paid", notes: null, attachmentUrl: null, relatedReturnId: null, relatedInvoiceId: null,
    createdAt: daysAgo(2) + "T13:00:00.000Z",
  },
];

export const mockInvoices: Invoice[] =
  mockInvoiceSeeds.map(legacyMockInvoice);

// ============================================================
// VEHICLE RETURNS
// ============================================================

export const mockReturns: VehicleReturn[] = [
  { id: "return-1", companyId: "company-1", vehicleId: "vehicle-10", saleDealId: null, customerName: "Earlier Customer", customerPhone: "07700400001", returnDate: daysAgo(60), reason: "Repeated electrical faults outside warranty cover", resolutionPath: "g_trader", resolutionNotes: "Returned to G-Trader for resolution; full credit received", refundAmount: 2200, status: "resolved", originalInvoiceId: null, refundBankAccountName: null, refundSortCode: null, refundAccountNumber: null, refundBankName: null, reasonCode: null, createdAt: daysAgo(60) + "T09:00:00.000Z", resolvedAt: daysAgo(45) + "T15:00:00.000Z" },
];

// ============================================================
// ACTIVITY LOG (last 7 days)
// ============================================================

export const mockActivityLog: ActivityLogEntry[] = [
  { id: "act-1", companyId: "company-1", userId: "user-3", vehicleId: "vehicle-15", actionType: "vehicle_arrived", description: "RANGE ROVER EVOQUE (DE71 FRG) received", metadata: { stockId: "CC-0015" }, createdAt: hoursAgo(2) },
  { id: "act-2", companyId: "company-1", userId: "user-3", vehicleId: "vehicle-11", actionType: "vehicle_arrived", description: "FORD FIESTA (YB19 XMD) received", metadata: { stockId: "CC-0011" }, createdAt: hoursAgo(20) },
  { id: "act-3", companyId: "company-1", userId: "user-2", vehicleId: "vehicle-15", actionType: "maintenance_job_created", description: "New stock maintenance job created for DE71 FRG", metadata: { jobId: "maint-2" }, createdAt: hoursAgo(2) },
  { id: "act-4", companyId: "company-1", userId: "user-2", vehicleId: "vehicle-11", actionType: "maintenance_job_created", description: "New stock maintenance job created for YB19 XMD", metadata: { jobId: "maint-1" }, createdAt: hoursAgo(20) },
  { id: "act-5", companyId: "company-1", userId: "user-5", vehicleId: "vehicle-8", actionType: "inspection_started", description: "Inspection started for FL22 HJK", metadata: {}, createdAt: hoursAgo(48) },
  { id: "act-6", companyId: "company-1", userId: "user-2", vehicleId: "vehicle-4", actionType: "todo_added", description: "Added: Driver front wheel makes noise", metadata: { todoId: "todo-2" }, createdAt: hoursAgo(70) },
  { id: "act-7", companyId: "company-1", userId: "user-2", vehicleId: "vehicle-4", actionType: "todo_added", description: "Added: Fuel smell comes in morning", metadata: { todoId: "todo-3" }, createdAt: hoursAgo(68) },
  { id: "act-8", companyId: "company-1", userId: "user-6", vehicleId: "vehicle-1", actionType: "lead_created", description: "Lead from website — James Wilson interested in LX68 CZK", metadata: { leadId: "lead-1" }, createdAt: hoursAgo(4) },
  { id: "act-9", companyId: "company-1", userId: "user-6", vehicleId: "vehicle-12", actionType: "lead_created", description: "Lead from AutoTrader — Aisha Khan interested in KR71 FRP", metadata: { leadId: "lead-2" }, createdAt: hoursAgo(8) },
  { id: "act-10", companyId: "company-1", userId: "user-6", vehicleId: "vehicle-7", actionType: "lead_created", description: "Lead from phone — Robert Smith interested in LJ17 MKA", metadata: { leadId: "lead-3" }, createdAt: hoursAgo(14) },
  { id: "act-11", companyId: "company-1", userId: "user-6", vehicleId: "vehicle-3", actionType: "appointment_booked", description: "Appointment booked: Olivia Taylor, YN63 NFA, tomorrow 2pm", metadata: { appointmentId: "appt-1" }, createdAt: hoursAgo(20) },
  { id: "act-12", companyId: "company-1", userId: "user-6", vehicleId: "vehicle-12", actionType: "appointment_booked", description: "Appointment booked: Liam Cooper, KR71 FRP", metadata: { appointmentId: "appt-3" }, createdAt: daysAgo(1) + "T12:00:00.000Z" },
  { id: "act-13", companyId: "company-1", userId: "user-7", vehicleId: "vehicle-13", actionType: "maintenance_job_completed", description: "Pre-listing service completed for HN20 BYE", metadata: { jobId: "maint-5" }, createdAt: daysAgo(5) + "T14:00:00.000Z" },
  { id: "act-14", companyId: "company-1", userId: "user-1", vehicleId: "vehicle-13", actionType: "vehicle_status_changed", description: "HN20 BYE → ready", metadata: { newStatus: "ready" }, createdAt: daysAgo(5) + "T14:30:00.000Z" },
  { id: "act-15", companyId: "company-1", userId: "user-6", vehicleId: "vehicle-9", actionType: "sale_completed", description: "PK63 XAW sold to Mary Johnson — £3,300", metadata: { dealId: "deal-5", price: 3300 }, createdAt: daysAgo(5) + "T16:00:00.000Z" },
  { id: "act-16", companyId: "company-1", userId: "user-6", vehicleId: "vehicle-10", actionType: "sale_completed", description: "WF58 KXY sold to Peter Hill — £2,175", metadata: { dealId: "deal-6", price: 2175 }, createdAt: daysAgo(5) + "T17:00:00.000Z" },
  { id: "act-17", companyId: "company-1", userId: "user-1", vehicleId: "vehicle-9", actionType: "warranty_created", description: "AA Warranty 12-month created for PK63 XAW", metadata: { warrantyId: "warranty-3" }, createdAt: daysAgo(5) + "T16:30:00.000Z" },
  { id: "act-18", companyId: "company-1", userId: "user-1", vehicleId: "vehicle-9", actionType: "warranty_claim_opened", description: "Warranty claim opened: gearbox slipping", metadata: { claimId: "claim-1" }, createdAt: hoursAgo(36) },
  { id: "act-19", companyId: "company-1", userId: "user-1", vehicleId: "vehicle-9", actionType: "invoice_created", description: "Sales invoice INV-2026-0001 created", metadata: { invoiceId: "inv-5" }, createdAt: daysAgo(5) + "T16:00:00.000Z" },
  { id: "act-20", companyId: "company-1", userId: "user-1", vehicleId: "vehicle-9", actionType: "invoice_paid", description: "INV-2026-0001 marked paid", metadata: { invoiceId: "inv-5" }, createdAt: daysAgo(5) + "T16:15:00.000Z" },
  { id: "act-21", companyId: "company-1", userId: "user-1", vehicleId: null, actionType: "user_invited", description: "Invited new sales user (mock)", metadata: {}, createdAt: daysAgo(2) + "T11:00:00.000Z" },
  { id: "act-22", companyId: "company-1", userId: "user-1", vehicleId: "vehicle-2", actionType: "listing_published", description: "AUDI A3 SA17 WUV published to website", metadata: { listingId: "listing-2" }, createdAt: daysAgo(32) + "T11:00:00.000Z" },
  { id: "act-23", companyId: "company-1", userId: "user-1", vehicleId: "vehicle-12", actionType: "listing_published", description: "AUDI Q3 KR71 FRP published to website + AT", metadata: { listingId: "listing-6" }, createdAt: daysAgo(90) + "T11:00:00.000Z" },
  { id: "act-24", companyId: "company-1", userId: "user-7", vehicleId: "vehicle-4", actionType: "todo_completed", description: "Marked completed: Front wheel bearing", metadata: { todoId: "todo-2" }, createdAt: hoursAgo(10) },
  { id: "act-25", companyId: "company-1", userId: "user-1", vehicleId: "vehicle-10", actionType: "vehicle_returned", description: "Earlier customer returned WF58 KXY — resolved via G-Trader", metadata: { returnId: "return-1" }, createdAt: daysAgo(60) + "T09:00:00.000Z" },
  { id: "act-26", companyId: "company-1", userId: "user-5", vehicleId: "vehicle-13", actionType: "inspection_completed", description: "Inspection completed for HN20 BYE — 2 items needed attention", metadata: {}, createdAt: daysAgo(15) + "T11:00:00.000Z" },
  { id: "act-27", companyId: "company-1", userId: "user-2", vehicleId: "vehicle-14", actionType: "cost_updated", description: "Updated bodywork cost on LB64 ZHM", metadata: {}, createdAt: daysAgo(3) + "T10:00:00.000Z" },
  { id: "act-28", companyId: "company-1", userId: "user-1", vehicleId: null, actionType: "company_setting_changed", description: "Updated company VAT number", metadata: {}, createdAt: daysAgo(7) + "T09:00:00.000Z" },
  { id: "act-29", companyId: "company-1", userId: "user-6", vehicleId: "vehicle-6", actionType: "appointment_completed", description: "Charlotte Reed cancelled — lost", metadata: { appointmentId: "appt-9" }, createdAt: daysAgo(8) + "T13:30:00.000Z" },
  { id: "act-30", companyId: "company-1", userId: "user-1", vehicleId: null, actionType: "workshop_job_created", description: "Walk-in workshop job: John Smith — AC re-gas", metadata: { jobId: "ws-1" }, createdAt: hoursAgo(48) },
];

// ============================================================
// NOTIFICATIONS — 5 unread for user-1 (Abbas Bhai)
// ============================================================

export const mockNotifications: Notification[] = [
  { id: "notif-1", companyId: "company-1", userId: "user-1", type: "warning", title: "Stuck stock alert", body: "BMW 2 SERIES (LJ17 MKA) has been in stock 314 days", link: "/vehicles/vehicle-7", read: false, createdAt: hoursAgo(1) },
  { id: "notif-2", companyId: "company-1", userId: "user-1", type: "urgent", title: "Open warranty claim", body: "Mary Johnson — gearbox slipping on PK63 XAW", link: "/warranties", read: false, createdAt: hoursAgo(36) },
  { id: "notif-3", companyId: "company-1", userId: "user-1", type: "info", title: "New stock arrived", body: "RANGE ROVER EVOQUE (DE71 FRG) received and pending inspection", link: "/vehicles/vehicle-15", read: false, createdAt: hoursAgo(2) },
  { id: "notif-4", companyId: "company-1", userId: "user-1", type: "success", title: "Sale completed", body: "PK63 XAW sold to Mary Johnson — £3,300 (deposit £500)", link: "/sales/pipeline", read: false, createdAt: daysAgo(5) + "T16:00:00.000Z" },
  { id: "notif-5", companyId: "company-1", userId: "user-1", type: "info", title: "4 new leads in 24h", body: "James, Aisha, Robert, Michelle — all need follow-up", link: "/sales/leads", read: false, createdAt: hoursAgo(4) },
];

// ============================================================
// CUSTOMERS (v4.2 — dedup playground)
// ============================================================
//
// 15 records crafted to exercise the four match strategies in
// customerService.searchCustomers:
//   - "Khan" → 3 fuzzy name matches (Mohammed / Sarah / Patel-Khan Trading)
//   - "07712" → 1 phone-prefix match
//   - "UB1 3DZ" → 2 postcode matches (a family edge case)
//   - One B2B / trade buyer with `companyName` set
//   - Two repeat customers with multi-enquiry history (see mockEnquiries below)
//
export const mockCustomers: Customer[] = [
  {
    id: "customer-1",
    companyId: "company-1",
    title: "Mr",
    firstName: "Mohammed",
    lastName: "Khan",
    companyName: null,
    email: "m.khan@example.com",
    homePhone: null,
    mobilePhone: "07712 345678",
    postcode: "UB1 3DZ",
    addressLines: ["12 Western Road", "Southall", "Greater London", "UB1 3DZ"],
    marketingConsent: true,
    notes: "Repeat buyer — bought from us in 2024 too.",
    sourceOrigin: "autotrader_internet",
    createdAt: hoursAgo(24 * 220),
    updatedAt: hoursAgo(48),
  },
  {
    id: "customer-2",
    companyId: "company-1",
    title: "Mrs",
    firstName: "Sarah",
    lastName: "Khan",
    companyName: null,
    email: "sarah.khan@example.co.uk",
    homePhone: "020 8574 1122",
    mobilePhone: "07911 223344",
    postcode: "UB1 3DZ",
    addressLines: ["12 Western Road", "Southall", "Greater London", "UB1 3DZ"],
    marketingConsent: true,
    notes: "Wife of Mohammed Khan — same address; treat as separate buyer.",
    sourceOrigin: "referral",
    createdAt: hoursAgo(24 * 60),
    updatedAt: hoursAgo(24 * 12),
  },
  {
    id: "customer-3",
    companyId: "company-1",
    title: null,
    firstName: "Hassan",
    lastName: "Patel",
    companyName: "Patel Khan Trading Ltd",
    email: "hassan@patel-khan-trading.co.uk",
    homePhone: null,
    mobilePhone: "07480 998877",
    postcode: "NW10 6RS",
    addressLines: ["Unit 7B", "Mountbatten Way", "London", "NW10 6RS"],
    marketingConsent: false,
    notes: "Trade buyer — typically takes 2–3 vehicles a quarter.",
    sourceOrigin: "existing_customer",
    createdAt: hoursAgo(24 * 400),
    updatedAt: hoursAgo(24 * 7),
  },
  {
    id: "customer-4",
    companyId: "company-1",
    title: "Ms",
    firstName: "Priya",
    lastName: "Patel",
    companyName: null,
    email: "priya.patel@example.com",
    homePhone: null,
    mobilePhone: "07712 998001",
    postcode: "TW3 1NH",
    addressLines: ["44 Lampton Road", "Hounslow", "TW3 1NH"],
    marketingConsent: true,
    notes: null,
    sourceOrigin: "facebook_marketplace",
    createdAt: hoursAgo(24 * 40),
    updatedAt: hoursAgo(24 * 2),
  },
  {
    id: "customer-5",
    companyId: "company-1",
    title: "Mr",
    firstName: "Liam",
    lastName: "O'Brien",
    companyName: null,
    email: "liam.obrien@example.com",
    homePhone: null,
    mobilePhone: "07900 112233",
    postcode: "EN1 1BY",
    addressLines: ["27 Bury Street", "Enfield", "EN1 1BY"],
    marketingConsent: true,
    notes: null,
    sourceOrigin: "autotrader_chat",
    createdAt: hoursAgo(24 * 80),
    updatedAt: hoursAgo(24 * 6),
  },
  {
    id: "customer-6",
    companyId: "company-1",
    title: "Mr",
    firstName: "Michael",
    lastName: "Chen",
    companyName: null,
    email: "m.chen@example.com",
    homePhone: null,
    mobilePhone: "07788 554433",
    postcode: "SE15 4LN",
    addressLines: ["8 Bellenden Road", "Peckham", "London", "SE15 4LN"],
    marketingConsent: true,
    notes: "Asked about a part-exchange — has a 2019 Civic.",
    sourceOrigin: "cargurus",
    createdAt: hoursAgo(24 * 25),
    updatedAt: hoursAgo(24 * 1),
  },
  {
    id: "customer-7",
    companyId: "company-1",
    title: "Mrs",
    firstName: "Jessica",
    lastName: "Smith",
    companyName: null,
    email: "jsmith@gmail.com",
    homePhone: null,
    mobilePhone: "07555 667788",
    postcode: "HA9 6BS",
    addressLines: ["5 Engineers Way", "Wembley", "HA9 6BS"],
    marketingConsent: true,
    notes: null,
    sourceOrigin: "google_ppc",
    createdAt: hoursAgo(24 * 12),
    updatedAt: hoursAgo(12),
  },
  {
    id: "customer-8",
    companyId: "company-1",
    title: "Mr",
    firstName: "James",
    lastName: "Walker",
    companyName: null,
    email: "j.walker@example.org",
    homePhone: "01923 884412",
    mobilePhone: "07404 998822",
    postcode: "WD18 7DT",
    addressLines: ["19 Clarendon Road", "Watford", "WD18 7DT"],
    marketingConsent: true,
    notes: null,
    sourceOrigin: "phone",
    createdAt: hoursAgo(24 * 18),
    updatedAt: hoursAgo(24 * 4),
  },
  {
    id: "customer-9",
    companyId: "company-1",
    title: "Ms",
    firstName: "Aisha",
    lastName: "Begum",
    companyName: null,
    email: "aisha.b@example.com",
    homePhone: null,
    mobilePhone: "07919 776655",
    postcode: "E1 4HJ",
    addressLines: ["77 Brick Lane", "London", "E1 4HJ"],
    marketingConsent: true,
    notes: "Wants finance — said budget is £180/month.",
    sourceOrigin: "instagram",
    createdAt: hoursAgo(24 * 5),
    updatedAt: hoursAgo(8),
  },
  {
    id: "customer-10",
    companyId: "company-1",
    title: "Mr",
    firstName: "Robert",
    lastName: "Johnson",
    companyName: null,
    email: "rob.johnson@example.com",
    homePhone: null,
    mobilePhone: "07733 221100",
    postcode: "CR0 2YR",
    addressLines: ["41 George Street", "Croydon", "CR0 2YR"],
    marketingConsent: false,
    notes: null,
    sourceOrigin: "drive_by",
    createdAt: hoursAgo(24 * 30),
    updatedAt: hoursAgo(24 * 9),
  },
  {
    id: "customer-11",
    companyId: "company-1",
    title: "Mrs",
    firstName: "Michelle",
    lastName: "Thompson",
    companyName: null,
    email: "michelle.t@example.co.uk",
    homePhone: null,
    mobilePhone: "07822 334455",
    postcode: "BR1 1HE",
    addressLines: ["3 Widmore Road", "Bromley", "BR1 1HE"],
    marketingConsent: true,
    notes: null,
    sourceOrigin: "motors",
    createdAt: hoursAgo(24 * 9),
    updatedAt: hoursAgo(24 * 1),
  },
  {
    id: "customer-12",
    companyId: "company-1",
    title: "Mr",
    firstName: "David",
    lastName: "Williams",
    companyName: null,
    email: "d.williams@example.com",
    homePhone: null,
    mobilePhone: "07700 900123",
    postcode: "SW1A 1AA",
    addressLines: ["10 Downing Street", "London", "SW1A 1AA"],
    marketingConsent: true,
    notes: "Test postcode lookup customer.",
    sourceOrigin: "dealer_website",
    createdAt: hoursAgo(24 * 14),
    updatedAt: hoursAgo(24 * 3),
  },
  {
    id: "customer-13",
    companyId: "company-1",
    title: "Mr",
    firstName: "Ahmed",
    lastName: "Hussain",
    companyName: null,
    email: "ahmed.h@example.com",
    homePhone: null,
    mobilePhone: "07712 112233",
    postcode: "SL2 5AS",
    addressLines: ["22 Farnham Road", "Slough", "SL2 5AS"],
    marketingConsent: true,
    notes: null,
    sourceOrigin: "whatsapp",
    createdAt: hoursAgo(24 * 3),
    updatedAt: hoursAgo(4),
  },
  {
    id: "customer-14",
    companyId: "company-1",
    title: "Ms",
    firstName: "Emma",
    lastName: "Brown",
    companyName: null,
    email: "emma.brown@example.com",
    homePhone: null,
    mobilePhone: "07866 445566",
    postcode: "RM7 9PR",
    addressLines: ["14 South Street", "Romford", "RM7 9PR"],
    marketingConsent: true,
    notes: null,
    sourceOrigin: "tiktok",
    createdAt: hoursAgo(24 * 21),
    updatedAt: hoursAgo(24 * 7),
  },
  {
    id: "customer-15",
    companyId: "company-1",
    title: "Mr",
    firstName: "Carlos",
    lastName: "Mendoza",
    companyName: null,
    email: "c.mendoza@example.com",
    homePhone: null,
    mobilePhone: "07577 889900",
    postcode: "KT2 6QN",
    addressLines: ["98 London Road", "Kingston upon Thames", "KT2 6QN"],
    marketingConsent: true,
    notes: "Hot lead — pinged us 3 times this week.",
    sourceOrigin: "hey_car",
    createdAt: hoursAgo(24 * 2),
    updatedAt: hoursAgo(2),
  },
];

// ============================================================
// ENQUIRIES (v4.2)
// ============================================================
//
// Two repeat customers (Mohammed Khan and Hassan Patel) get multiple
// enquiries so the future detail page can show the "previous enquiries"
// badge. Statuses span open / won / lost.
//
export const mockEnquiries: Enquiry[] = [
  // Mohammed Khan — 3 historical enquiries (repeat buyer)
  {
    id: "enquiry-1",
    companyId: "company-1",
    customerId: "customer-1",
    vehicleId: "vehicle-3",
    source: "autotrader_internet",
    type: "cash",
    status: "won",
    lostReason: null,
    salespersonId: "user-1",
    financeInterest: false,
    nextActionDueAt: null,
    notes: "Bought outright — original 2024 sale.",
    createdAt: hoursAgo(24 * 200),
    updatedAt: hoursAgo(24 * 195),
  },
  {
    id: "enquiry-2",
    companyId: "company-1",
    customerId: "customer-1",
    vehicleId: "vehicle-7",
    source: "existing_customer",
    type: "test_drive",
    status: "lost",
    lostReason: "vehicle_sold",
    salespersonId: "user-1",
    financeInterest: false,
    nextActionDueAt: null,
    notes: "Wanted the BMW but it sold before he could come down.",
    createdAt: hoursAgo(24 * 80),
    updatedAt: hoursAgo(24 * 78),
  },
  {
    id: "enquiry-3",
    companyId: "company-1",
    customerId: "customer-1",
    vehicleId: null,
    source: "phone",
    type: "hot_lead",
    status: "open",
    lostReason: null,
    salespersonId: "user-1",
    financeInterest: false,
    nextActionDueAt: hoursAgo(-48),
    notes: "Looking for an Audi Q3 — said budget around £18k.",
    createdAt: hoursAgo(24 * 2),
    updatedAt: hoursAgo(24 * 2),
  },
  // Hassan Patel — trade buyer, 2 enquiries
  {
    id: "enquiry-4",
    companyId: "company-1",
    customerId: "customer-3",
    vehicleId: "vehicle-1",
    source: "existing_customer",
    type: "trade",
    status: "won",
    lostReason: null,
    salespersonId: "user-1",
    financeInterest: false,
    nextActionDueAt: null,
    notes: "Trade — took 2 cars.",
    createdAt: hoursAgo(24 * 90),
    updatedAt: hoursAgo(24 * 88),
  },
  {
    id: "enquiry-5",
    companyId: "company-1",
    customerId: "customer-3",
    vehicleId: null,
    source: "existing_customer",
    type: "hot_lead",
    status: "open",
    lostReason: null,
    salespersonId: "user-1",
    financeInterest: false,
    nextActionDueAt: hoursAgo(-24),
    notes: "Checking for Q3s for stock — needs 3 by end of month.",
    createdAt: hoursAgo(24 * 4),
    updatedAt: hoursAgo(24 * 4),
  },
  // A couple of fresh enquiries scattered across other customers
  {
    id: "enquiry-6",
    companyId: "company-1",
    customerId: "customer-9",
    vehicleId: "vehicle-2",
    source: "instagram",
    type: "finance",
    status: "open",
    lostReason: null,
    salespersonId: "user-1",
    financeInterest: true,
    nextActionDueAt: hoursAgo(-72),
    notes: "Wants finance — said budget is £180/month.",
    createdAt: hoursAgo(8),
    updatedAt: hoursAgo(8),
  },
  {
    id: "enquiry-7",
    companyId: "company-1",
    customerId: "customer-15",
    vehicleId: "vehicle-4",
    source: "hey_car",
    type: "hot_lead",
    status: "open",
    lostReason: null,
    salespersonId: "user-1",
    financeInterest: false,
    nextActionDueAt: hoursAgo(-12),
    notes: "Hot lead — pinged us 3 times this week.",
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
  },
];

// ============================================================
// DVLA MOCK
// ============================================================

export const DVLA_MOCK: Record<string, Partial<Vehicle>> = {
  "GK66 6NX": { make: "NISSAN", model: "JUKE", year: 2016, colour: "Grey", fuelType: "diesel", engineSizeCC: 1461 },
  "YB19 XMD": { make: "FORD", model: "FIESTA", year: 2019, colour: "Blue", fuelType: "petrol", engineSizeCC: 998 },
  "DE71 FRG": { make: "RANGE ROVER", model: "EVOQUE", year: 2021, colour: "Black", fuelType: "diesel", engineSizeCC: 1999 },
  "FL22 HJK": { make: "MERCEDES", model: "C CLASS", year: 2022, colour: "Silver", fuelType: "diesel", engineSizeCC: 1950 },
  "LX68 CZK": { make: "AUDI", model: "A3", year: 2018, colour: "Silver", fuelType: "petrol", engineSizeCC: 1395 },
  "MV17 HFJ": { make: "AUDI", model: "Q2", year: 2017, colour: "Blue", fuelType: "petrol", engineSizeCC: 1395 },
  "HN20 BYE": { make: "TOYOTA", model: "YARIS", year: 2020, colour: "Silver", fuelType: "hybrid", engineSizeCC: 1490 },
  "KR71 FRP": { make: "AUDI", model: "Q3", year: 2021, colour: "White", fuelType: "petrol", engineSizeCC: 1498 },
  // Fresh test presets (UAT round) — reg unused in seeded vehicles so TC-P1-001 etc. can run as-written.
  "LR74 NJK": { make: "NISSAN", model: "JUKE", year: 2017, colour: "Silver", fuelType: "diesel", engineSizeCC: 1461 },
  "MN18 ABC": { make: "TOYOTA", model: "YARIS", year: 2019, colour: "Silver", fuelType: "hybrid", engineSizeCC: 1490 },
  "OP67 XYZ": { make: "FORD", model: "FOCUS", year: 2017, colour: "Black", fuelType: "petrol", engineSizeCC: 1499 },
  "QR22 STU": { make: "BMW", model: "1 SERIES", year: 2022, colour: "White", fuelType: "petrol", engineSizeCC: 1998 },
};
