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
  Invoice,
  Lead,
  Listing,
  MaintenanceJob,
  Notification,
  SalesDeal,
  TodoItem,
  User,
  Vehicle,
  VehicleReturn,
  Vendor,
  Warranty,
  WarrantyClaim,
  WorkshopJob,
} from "./types";

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
  },
  {
    id: "company-2",
    name: "Car Giant",
    address: "44 Hythe Rd, London, NW10 6RS",
    vatNumber: "GB987654321",
    logoUrl: null,
    stockIdPrefix: "CG",
  },
];

// ============================================================
// USERS
// ============================================================

export const mockUsers: User[] = [
  {
    id: "user-1",
    companyId: "company-1",
    name: "Bass Bhai",
    email: "bass@carcapital.uk",
    role: "owner",
    avatarUrl: null,
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
    active: true,
    createdAt: "2024-05-01T09:00:00.000Z",
  },
  {
    id: "user-8",
    companyId: "company-2",
    name: "Tariq",
    email: "tariq@cargiant.uk",
    role: "admin",
    avatarUrl: null,
    active: true,
    createdAt: "2024-06-01T09:00:00.000Z",
  },
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
}

const VEHICLE_SEEDS: VehicleSeed[] = [
  { id: "vehicle-1", stockId: "CC-0001", registration: "LX68 CZK", make: "AUDI", model: "A3", variant: "1.4 TFSI CoD SE Sportback 5dr", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 147, source: "BCA Auction", buyingPrice: 8500, listingPrice: 12990, year: 2018, colour: "Silver", mileage: 42000 },
  { id: "vehicle-2", stockId: "CC-0002", registration: "SA17 WUV", make: "AUDI", model: "A3", variant: "1.4 TFSI CoD Sport Sportback 5dr", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 37, source: "BCA Auction", buyingPrice: 9200, listingPrice: 13490, year: 2017, colour: "White", mileage: 38500 },
  { id: "vehicle-3", stockId: "CC-0003", registration: "YN63 NFA", make: "AUDI", model: "A4", variant: "2.0 TFSI Black Edition Saloon 4dr", bodyType: "saloon", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 36, source: "Blackbushe", buyingPrice: 7800, listingPrice: 11990, year: 2014, colour: "Black", mileage: 78200 },
  { id: "vehicle-4", stockId: "CC-0004", registration: "GK66 6NX", make: "NISSAN", model: "JUKE", variant: "1.5 dCi Tekna 5dr", bodyType: "suv", fuelType: "diesel", transmission: "manual", status: "being_prepared", daysInStock: 12, source: "Private", buyingPrice: 4200, listingPrice: null, year: 2016, colour: "Grey", mileage: 95300 },
  { id: "vehicle-5", stockId: "CC-0005", registration: "MV17 HFJ", make: "AUDI", model: "Q2", variant: "1.4 TFSI CoD S line SUV 5dr", bodyType: "suv", fuelType: "petrol", transmission: "manual", status: "ready", daysInStock: 37, source: "BCA Auction", buyingPrice: 10500, listingPrice: 15490, year: 2017, colour: "Blue", mileage: 51200 },
  { id: "vehicle-6", stockId: "CC-0006", registration: "BW17 NLL", make: "AUDI", model: "RS7", variant: "4.0 TFSI V8 Performance Sportback 5dr", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 23, source: "Dealer", buyingPrice: 28000, listingPrice: 37990, year: 2017, colour: "Black", mileage: 62000 },
  { id: "vehicle-7", stockId: "CC-0007", registration: "LJ17 MKA", make: "BMW", model: "2 SERIES GRAN TOURER", variant: "2.0 218d SE Auto Euro 6 5dr", bodyType: "mpv", fuelType: "diesel", transmission: "automatic", status: "listed", daysInStock: 314, source: "BCA Auction", buyingPrice: 6200, listingPrice: 9990, year: 2017, colour: "Grey", mileage: 88000 },
  { id: "vehicle-8", stockId: "CC-0008", registration: "FL22 HJK", make: "MERCEDES", model: "C CLASS", variant: "C220d AMG Line Saloon 4dr", bodyType: "saloon", fuelType: "diesel", transmission: "automatic", status: "inspection_pending", daysInStock: 3, source: "Paddock Wood", buyingPrice: 13500, listingPrice: null, year: 2022, colour: "Silver", mileage: 28000 },
  { id: "vehicle-9", stockId: "CC-0009", registration: "PK63 XAW", make: "VAUXHALL", model: "ASTRA", variant: "1.6 CDTi ecoFLEX Tech Line 5dr", bodyType: "hatchback", fuelType: "diesel", transmission: "manual", status: "sold", daysInStock: 0, source: "BCA Auction", buyingPrice: 1850, listingPrice: 3490, year: 2013, colour: "Red", mileage: 110000 },
  { id: "vehicle-10", stockId: "CC-0010", registration: "WF58 KXY", make: "SMART", model: "FORTWO", variant: "1.0 Pure 3dr", bodyType: "hatchback", fuelType: "petrol", transmission: "automatic", status: "sold", daysInStock: 0, source: "BCA Auction", buyingPrice: 850, listingPrice: 2290, year: 2008, colour: "Yellow", mileage: 65000 },
  { id: "vehicle-11", stockId: "CC-0011", registration: "YB19 XMD", make: "FORD", model: "FIESTA", variant: "1.0 EcoBoost Zetec 5dr", bodyType: "hatchback", fuelType: "petrol", transmission: "manual", status: "received", daysInStock: 1, source: "Auction", buyingPrice: 5400, listingPrice: null, year: 2019, colour: "Blue", mileage: 31000 },
  { id: "vehicle-12", stockId: "CC-0012", registration: "KR71 FRP", make: "AUDI", model: "Q3", variant: "1.5 TFSI CoD 35 Technik SUV 5dr", bodyType: "suv", fuelType: "petrol", transmission: "automatic", status: "listed", daysInStock: 95, source: "BCA Auction", buyingPrice: 14200, listingPrice: 19990, year: 2021, colour: "White", mileage: 35000 },
  { id: "vehicle-13", stockId: "CC-0013", registration: "HN20 BYE", make: "TOYOTA", model: "YARIS", variant: "1.5 Hybrid Excel 5dr CVT", bodyType: "hatchback", fuelType: "hybrid", transmission: "automatic", status: "ready", daysInStock: 18, source: "Trade-in", buyingPrice: 9800, listingPrice: null, year: 2020, colour: "Silver", mileage: 22000 },
  { id: "vehicle-14", stockId: "CC-0014", registration: "LB64 ZHM", make: "AUDI", model: "A6 SALOON", variant: "2.0 TFSI S line Edition S Tronic 5dr", bodyType: "saloon", fuelType: "petrol", transmission: "automatic", status: "being_prepared", daysInStock: 63, source: "BCA Auction", buyingPrice: 11200, listingPrice: null, year: 2014, colour: "Black", mileage: 92000 },
  { id: "vehicle-15", stockId: "CC-0015", registration: "DE71 FRG", make: "RANGE ROVER", model: "EVOQUE", variant: "2.0 D165 S 5dr Auto", bodyType: "suv", fuelType: "diesel", transmission: "automatic", status: "received", daysInStock: 0, source: "Dealer", buyingPrice: 15850, listingPrice: null, year: 2021, colour: "Black", mileage: 38000 },
];

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
    sourceType: isAuction ? "auction" : s.source === "Trade-in" ? "trade_in" : s.source === "Private" ? "private" : "dealer",
    purchaseChannel: isAuction ? "supplier" : "vendor",
    localOrImport: "local",
    auctionHouse: isAuction ? s.source : null,
    ownedBy: "Car Capital UK",
    managedBy: "user-2",
    invoiceDate: daysAgo(s.daysInStock),
    v5Received: true,
    serviceHistory: "partial",
    numKeys: 2,
    lockNut: true,
    motExpiry: inDays(180),
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
    daysInStock: s.daysInStock,
    imagesCount: ["listed", "ready"].includes(s.status) ? 12 : 0,
    heroImageUrl: null,
    createdAt: `${daysAgo(s.daysInStock)}T09:00:00.000Z`,
    updatedAt: NOW,
  };
}

export const mockVehicles: Vehicle[] = VEHICLE_SEEDS.map(buildVehicle);

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
  { id: "warranty-1", companyId: "company-1", vehicleId: "vehicle-9", saleDealId: "deal-5", customerName: "Mary Johnson", customerPhone: "07700300002", customerEmail: "mj@example.com", type: "in_house", provider: null, coverageDetails: "3-month engine and gearbox cover", startDate: daysAgo(5), endDate: inDays(85), costToDealership: 0, costToCustomer: 0, status: "active", certificateGenerated: true, createdAt: daysAgo(5) + "T16:00:00.000Z" },
  { id: "warranty-2", companyId: "company-1", vehicleId: "vehicle-10", saleDealId: "deal-6", customerName: "Peter Hill", customerPhone: "07700300003", customerEmail: "ph@example.com", type: "in_house", provider: null, coverageDetails: "1-month basic cover", startDate: daysAgo(5), endDate: inDays(25), costToDealership: 0, costToCustomer: 0, status: "active", certificateGenerated: true, createdAt: daysAgo(5) + "T17:30:00.000Z" },
  { id: "warranty-3", companyId: "company-1", vehicleId: "vehicle-9", saleDealId: null, customerName: "Mary Johnson", customerPhone: "07700300002", customerEmail: "mj@example.com", type: "third_party", provider: "AA Warranty", coverageDetails: "12-month comprehensive — engine, gearbox, electrics", startDate: daysAgo(5), endDate: inDays(360), costToDealership: 250, costToCustomer: 350, status: "active", certificateGenerated: true, createdAt: daysAgo(5) + "T16:30:00.000Z" },
  { id: "warranty-4", companyId: "company-1", vehicleId: "vehicle-10", saleDealId: null, customerName: "Earlier Customer", customerPhone: "07700400001", customerEmail: null, type: "in_house", provider: null, coverageDetails: "Expired 3-month cover", startDate: daysAgo(120), endDate: daysAgo(30), costToDealership: 0, costToCustomer: 0, status: "expired", certificateGenerated: true, createdAt: daysAgo(120) + "T09:00:00.000Z" },
  { id: "warranty-5", companyId: "company-1", vehicleId: "vehicle-9", saleDealId: null, customerName: "Mary Johnson", customerPhone: "07700300002", customerEmail: "mj@example.com", type: "in_house", provider: null, coverageDetails: "Special goodwill cover — has open claim", startDate: daysAgo(20), endDate: inDays(70), costToDealership: 0, costToCustomer: 0, status: "claimed", certificateGenerated: true, createdAt: daysAgo(20) + "T09:00:00.000Z" },
];

export const mockClaims: WarrantyClaim[] = [
  { id: "claim-1", warrantyId: "warranty-5", vehicleId: "vehicle-9", companyId: "company-1", customerName: "Mary Johnson", issueDescription: "Gearbox slipping in second gear", isComplaint: false, estimatedCost: 800, actualCost: null, status: "open", resolution: null, createdAt: hoursAgo(36), resolvedAt: null },
  { id: "claim-2", warrantyId: "warranty-1", vehicleId: "vehicle-9", companyId: "company-1", customerName: "Mary Johnson", issueDescription: "Customer feels brakes are noisy and dealer should cover", isComplaint: true, estimatedCost: 200, actualCost: null, status: "under_review", resolution: null, createdAt: hoursAgo(20), resolvedAt: null },
  { id: "claim-3", warrantyId: "warranty-4", vehicleId: "vehicle-10", companyId: "company-1", customerName: "Earlier Customer", issueDescription: "Aircon not cooling", isComplaint: false, estimatedCost: 90, actualCost: 85, status: "resolved", resolution: "Re-gas under in-house warranty — completed and charged to dealership", createdAt: daysAgo(45) + "T09:00:00.000Z", resolvedAt: daysAgo(40) + "T10:00:00.000Z" },
];

// ============================================================
// INVOICES
// ============================================================

export const mockInvoices: Invoice[] = [
  // Purchase invoices (4 from BCA)
  { id: "inv-1", companyId: "company-1", type: "purchase", vehicleId: "vehicle-1", partyName: "BCA Auction", partyPhone: "01234567890", partyEmail: "accounts@bca.co.uk", invoiceNumber: "BCA-2025-12-001", invoiceDate: daysAgo(147), dueDate: daysAgo(140), lineItems: [{ id: "li-1", description: "AUDI A3 LX68 CZK", quantity: 1, unitPrice: 8500, vatRate: 0 }, { id: "li-2", description: "Buyer's fee", quantity: 1, unitPrice: 200, vatRate: 0.2 }], subtotal: 8700, vatAmount: 40, total: 8740, status: "paid", notes: null, attachmentUrl: null, createdAt: daysAgo(147) + "T09:00:00.000Z" },
  { id: "inv-2", companyId: "company-1", type: "purchase", vehicleId: "vehicle-7", partyName: "BCA Auction", partyPhone: "01234567890", partyEmail: "accounts@bca.co.uk", invoiceNumber: "BCA-2025-06-099", invoiceDate: daysAgo(314), dueDate: daysAgo(307), lineItems: [{ id: "li-3", description: "BMW 2 SERIES LJ17 MKA", quantity: 1, unitPrice: 6200, vatRate: 0 }, { id: "li-4", description: "Buyer's fee", quantity: 1, unitPrice: 200, vatRate: 0.2 }], subtotal: 6400, vatAmount: 40, total: 6440, status: "paid", notes: null, attachmentUrl: null, createdAt: daysAgo(314) + "T09:00:00.000Z" },
  { id: "inv-3", companyId: "company-1", type: "purchase", vehicleId: "vehicle-12", partyName: "BCA Auction", partyPhone: "01234567890", partyEmail: "accounts@bca.co.uk", invoiceNumber: "BCA-2026-01-244", invoiceDate: daysAgo(95), dueDate: daysAgo(88), lineItems: [{ id: "li-5", description: "AUDI Q3 KR71 FRP", quantity: 1, unitPrice: 14200, vatRate: 0 }], subtotal: 14200, vatAmount: 0, total: 14200, status: "paid", notes: null, attachmentUrl: null, createdAt: daysAgo(95) + "T09:00:00.000Z" },
  { id: "inv-4", companyId: "company-1", type: "purchase", vehicleId: "vehicle-15", partyName: "BCA Auction", partyPhone: "01234567890", partyEmail: "accounts@bca.co.uk", invoiceNumber: "BCA-2026-04-077", invoiceDate: daysAgo(1), dueDate: inDays(7), lineItems: [{ id: "li-6", description: "RANGE ROVER EVOQUE DE71 FRG", quantity: 1, unitPrice: 15850, vatRate: 0 }], subtotal: 15850, vatAmount: 0, total: 15850, status: "sent", notes: null, attachmentUrl: null, createdAt: daysAgo(1) + "T09:00:00.000Z" },
  // Sale invoices (4)
  { id: "inv-5", companyId: "company-1", type: "sale", vehicleId: "vehicle-9", partyName: "Mary Johnson", partyPhone: "07700300002", partyEmail: "mj@example.com", invoiceNumber: "INV-2026-0001", invoiceDate: daysAgo(5), dueDate: daysAgo(5), lineItems: [{ id: "li-7", description: "VAUXHALL ASTRA PK63 XAW", quantity: 1, unitPrice: 3300, vatRate: 0 }], subtotal: 3300, vatAmount: 0, total: 3300, status: "paid", notes: null, attachmentUrl: null, createdAt: daysAgo(5) + "T16:00:00.000Z" },
  { id: "inv-6", companyId: "company-1", type: "sale", vehicleId: "vehicle-10", partyName: "Peter Hill", partyPhone: "07700300003", partyEmail: "ph@example.com", invoiceNumber: "INV-2026-0002", invoiceDate: daysAgo(5), dueDate: daysAgo(5), lineItems: [{ id: "li-8", description: "SMART FORTWO WF58 KXY", quantity: 1, unitPrice: 2175, vatRate: 0 }], subtotal: 2175, vatAmount: 0, total: 2175, status: "paid", notes: null, attachmentUrl: null, createdAt: daysAgo(5) + "T17:00:00.000Z" },
  { id: "inv-7", companyId: "company-1", type: "sale", vehicleId: "vehicle-9", partyName: "Mary Johnson", partyPhone: "07700300002", partyEmail: "mj@example.com", invoiceNumber: "INV-2026-0003", invoiceDate: daysAgo(5), dueDate: inDays(3), lineItems: [{ id: "li-9", description: "AA Warranty 12-month", quantity: 1, unitPrice: 350, vatRate: 0.2 }], subtotal: 350, vatAmount: 70, total: 420, status: "sent", notes: null, attachmentUrl: null, createdAt: daysAgo(5) + "T16:30:00.000Z" },
  { id: "inv-8", companyId: "company-1", type: "sale", vehicleId: null, partyName: "Walk-in Customer", partyPhone: null, partyEmail: null, invoiceNumber: "INV-2026-0004", invoiceDate: daysAgo(2), dueDate: daysAgo(2), lineItems: [{ id: "li-10", description: "Workshop service — full service", quantity: 1, unitPrice: 175, vatRate: 0.2 }], subtotal: 175, vatAmount: 35, total: 210, status: "paid", notes: null, attachmentUrl: null, createdAt: daysAgo(2) + "T13:00:00.000Z" },
];

// ============================================================
// VEHICLE RETURNS
// ============================================================

export const mockReturns: VehicleReturn[] = [
  { id: "return-1", companyId: "company-1", vehicleId: "vehicle-10", saleDealId: null, customerName: "Earlier Customer", customerPhone: "07700400001", returnDate: daysAgo(60), reason: "Repeated electrical faults outside warranty cover", resolutionPath: "g_trader", resolutionNotes: "Returned to G-Trader for resolution; full credit received", refundAmount: 2200, status: "resolved", createdAt: daysAgo(60) + "T09:00:00.000Z", resolvedAt: daysAgo(45) + "T15:00:00.000Z" },
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
// NOTIFICATIONS — 5 unread for user-1 (Bass Bhai)
// ============================================================

export const mockNotifications: Notification[] = [
  { id: "notif-1", companyId: "company-1", userId: "user-1", type: "warning", title: "Stuck stock alert", body: "BMW 2 SERIES (LJ17 MKA) has been in stock 314 days", link: "/vehicles/vehicle-7", read: false, createdAt: hoursAgo(1) },
  { id: "notif-2", companyId: "company-1", userId: "user-1", type: "urgent", title: "Open warranty claim", body: "Mary Johnson — gearbox slipping on PK63 XAW", link: "/warranties", read: false, createdAt: hoursAgo(36) },
  { id: "notif-3", companyId: "company-1", userId: "user-1", type: "info", title: "New stock arrived", body: "RANGE ROVER EVOQUE (DE71 FRG) received and pending inspection", link: "/vehicles/vehicle-15", read: false, createdAt: hoursAgo(2) },
  { id: "notif-4", companyId: "company-1", userId: "user-1", type: "success", title: "Sale completed", body: "PK63 XAW sold to Mary Johnson — £3,300 (deposit £500)", link: "/sales", read: false, createdAt: daysAgo(5) + "T16:00:00.000Z" },
  { id: "notif-5", companyId: "company-1", userId: "user-1", type: "info", title: "4 new leads in 24h", body: "James, Aisha, Robert, Michelle — all need follow-up", link: "/leads", read: false, createdAt: hoursAgo(4) },
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
};
