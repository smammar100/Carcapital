import type {
  VehicleStatus,
  MaintenanceStatus,
  SalesStage,
  BodyType,
  FuelType,
  FinanceProvider,
  UserRole,
} from "./types";

export const VEHICLE_STATUSES: {
  value: VehicleStatus;
  label: string;
  color: string;
}[] = [
  { value: "received", label: "Received", color: "blue" },
  { value: "inspection_pending", label: "Inspection Pending", color: "yellow" },
  { value: "being_prepared", label: "Being Prepared", color: "orange" },
  { value: "photos_pending", label: "Photos Pending", color: "yellow" },
  { value: "photos_ready", label: "Photos Ready", color: "green" },
  { value: "ready", label: "Ready", color: "green" },
  { value: "listed", label: "Listed", color: "purple" },
  { value: "reserved", label: "Reserved", color: "pink" },
  { value: "sold", label: "Sold", color: "gray" },
  { value: "returned", label: "Returned", color: "red" },
];

export const MAINTENANCE_STATUSES: {
  value: MaintenanceStatus;
  label: string;
  subtitle: string;
}[] = [
  { value: "pending", label: "Pending", subtitle: "New stock, no maintenance" },
  { value: "in_progress", label: "In Progress", subtitle: "Working" },
  { value: "completed", label: "Completed", subtitle: "Done" },
  { value: "stalled", label: "Stalled", subtitle: "Halted, no resolution" },
];

export const SALES_STAGES: { value: SalesStage; label: string }[] = [
  { value: "new_lead", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "test_drive", label: "Test Drive" },
  { value: "offer_made", label: "Offer Made" },
  { value: "deposit_taken", label: "Deposit Taken" },
  { value: "collection_delivery", label: "Collection / Delivery" },
  { value: "completed_sale", label: "Completed Sale" },
  { value: "lost", label: "Lost" },
];

export const BODY_TYPES: BodyType[] = [
  "hatchback",
  "saloon",
  "suv",
  "mpv",
  "estate",
  "convertible",
  "coupe",
];

export const FUEL_TYPES: FuelType[] = ["petrol", "diesel", "hybrid", "electric"];

export const FINANCE_PROVIDERS: {
  value: FinanceProvider;
  label: string;
  loadingFee: number;
  dailyCharge: number;
  unloadingFee: number;
}[] = [
  {
    value: "none",
    label: "None / Self-funded",
    loadingFee: 0,
    dailyCharge: 0,
    unloadingFee: 0,
  },
  {
    value: "next_gear",
    label: "Next Gear Capital",
    loadingFee: 85,
    dailyCharge: 0.375,
    unloadingFee: 25,
  },
  {
    value: "close_brothers",
    label: "Close Brothers",
    loadingFee: 20,
    dailyCharge: 0.15,
    unloadingFee: 0,
  },
  {
    value: "bca",
    label: "BCA",
    loadingFee: 41,
    dailyCharge: 0.3,
    unloadingFee: 0,
  },
  {
    value: "infinit",
    label: "INFINIT",
    loadingFee: 0,
    dailyCharge: 0,
    unloadingFee: 0,
  },
];

export const AUCTION_HOUSES = [
  "BCA Auction",
  "Blackbushe",
  "Paddock Wood",
  "Manheim",
  "Other",
] as const;

export const DAYS_IN_STOCK_THRESHOLDS = {
  green: 30,
  amber: 60,
  red: 90,
};

export const VAT_RATE = 0.2;

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "inventory_manager", label: "Inventory Manager" },
  { value: "driver", label: "Driver" },
  { value: "inspector", label: "Inspector" },
  { value: "prep_lead", label: "Prep Lead" },
  { value: "sales", label: "Sales" },
];

export const INSPECTION_ITEMS: {
  number: number;
  item: string;
  statusOptions: string[];
}[] = [
  {
    number: 1,
    item: "MOT Expiry",
    statusOptions: ["Valid", "Expiring Soon", "Expired", "N/A"],
  },
  {
    number: 2,
    item: "Oil Condition",
    statusOptions: ["Good", "Fair", "Poor", "Needs Replacing"],
  },
  {
    number: 3,
    item: "Coolant / Other Fluids",
    statusOptions: ["Good", "Low", "Contaminated"],
  },
  {
    number: 4,
    item: "General Body Work",
    statusOptions: ["Good", "Minor Damage", "Major Damage"],
  },
  {
    number: 5,
    item: "Tyres Condition",
    statusOptions: ["Good", "Fair", "Replace"],
  },
  {
    number: 6,
    item: "Spare Wheel",
    statusOptions: ["Present", "Missing", "Space Saver"],
  },
  { number: 7, item: "Lock Nut", statusOptions: ["Present", "Missing"] },
  { number: 8, item: "Key Battery", statusOptions: ["Good", "Low", "Dead"] },
  {
    number: 9,
    item: "Ignition / Battery",
    statusOptions: ["Good", "Weak", "Needs Replacing"],
  },
  { number: 10, item: "Warning Lights", statusOptions: ["None", "Active"] },
  {
    number: 11,
    item: "Speedo / Odo (mph)",
    statusOptions: ["Working", "Faulty"],
  },
  { number: 12, item: "Engine Noise", statusOptions: ["Normal", "Abnormal"] },
  {
    number: 13,
    item: "Under Body Noise",
    statusOptions: ["Normal", "Abnormal"],
  },
  {
    number: 14,
    item: "Gearbox Observe",
    statusOptions: ["Smooth", "Rough", "Slipping"],
  },
  {
    number: 15,
    item: "Wipers",
    statusOptions: ["Working", "Faulty", "Needs Replacing"],
  },
  {
    number: 16,
    item: "Exterior Lights",
    statusOptions: ["All Working", "Faulty"],
  },
  {
    number: 17,
    item: "Radio / Nav",
    statusOptions: ["Working", "Faulty", "Missing"],
  },
  { number: 18, item: "AirCon Working", statusOptions: ["Yes", "No", "Weak"] },
  {
    number: 19,
    item: "Interior Condition",
    statusOptions: ["Good", "Fair", "Poor"],
  },
  { number: 20, item: "Test Drive", statusOptions: ["Pass", "Fail", "Pending"] },
];

export const NEGATIVE_INSPECTION_STATUSES = new Set([
  "Expired",
  "Poor",
  "Needs Replacing",
  "Contaminated",
  "Major Damage",
  "Replace",
  "Missing",
  "Dead",
  "Weak",
  "Active",
  "Faulty",
  "Abnormal",
  "Rough",
  "Slipping",
  "Fair",
  "No",
  "Fail",
]);

export const AUTHORITY_MATRIX: {
  action: string;
  roles: Partial<Record<UserRole, boolean>>;
}[] = [
  {
    action: "Add Vehicle",
    roles: {
      owner: true,
      admin: true,
      inventory_manager: true,
      driver: true,
    },
  },
  {
    action: "Edit Costs",
    roles: { owner: true, admin: true, inventory_manager: true },
  },
  {
    action: "Run Inspection",
    roles: { owner: true, admin: true, inspector: true },
  },
  {
    action: "Create Listing",
    roles: { owner: true, admin: true, inventory_manager: true },
  },
  {
    action: "Book Appointment",
    roles: { owner: true, admin: true, sales: true },
  },
  {
    action: "Move Sales Stage",
    roles: { owner: true, admin: true, sales: true },
  },
  {
    action: "Create Invoice",
    roles: { owner: true, admin: true, sales: true },
  },
  {
    action: "Create Warranty",
    roles: { owner: true, admin: true, sales: true },
  },
  { action: "Process Return", roles: { owner: true, admin: true } },
  {
    action: "View Financials",
    roles: { owner: true, admin: true, inventory_manager: true },
  },
  { action: "Manage Users", roles: { owner: true, admin: true } },
];
