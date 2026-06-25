import { createClient, type TableInsert, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { UUID, Vehicle, VehicleStatus } from "@/lib/types";
import { activityService } from "./activity-service";

const NS = "vehicles:";

const SELECT = `
  id,
  companyId:company_id,
  registration,
  stockId:stock_id,
  tagNumber:tag_number,
  make,
  model,
  variantName:variant_name,
  variantCode:variant_code,
  year,
  colour,
  mileage,
  vehicleType:vehicle_type,
  bodyType:body_type,
  fuelType:fuel_type,
  transmission,
  engineSizeCC:engine_size_cc,
  receivedDate:received_date,
  receivedBy:received_by,
  sellerName:seller_name,
  sellerPhone:seller_phone,
  purchaseSource:purchase_source,
  purchaseChannel:purchase_channel,
  localOrImport:local_or_import,
  auctionHouse:auction_house,
  ownedBy:owned_by,
  managedBy:managed_by,
  invoiceDate:invoice_date,
  v5Received:v5_received,
  serviceHistory:service_history,
  numKeys:num_keys,
  lockNut:lock_nut,
  motExpiry:mot_expiry,
  buyingPrice:buying_price,
  vatOnBuyingPrice:vat_on_buying_price,
  buyersFee:buyers_fee,
  inspectionCharge:inspection_charge,
  collectionFee:collection_fee,
  deliveryFee:delivery_fee,
  lateStorageFee:late_storage_fee,
  otherCharges:other_charges,
  totalBuyingPrice:total_buying_price,
  financeProvider:finance_provider,
  loadingFee:loading_fee,
  dailyChargeRate:daily_charge_rate,
  unloadingFee:unloading_fee,
  stockingCharges:stocking_charges,
  valueAddition:value_addition,
  warrantyCost:warranty_cost,
  landedCost:landed_cost,
  baseCost:base_cost,
  minimumSalePrice:minimum_sale_price,
  listingPrice:listing_price,
  sellingPrice:selling_price,
  dateSold:date_sold,
  sellingAgent:selling_agent,
  grossEarning:gross_earning,
  status,
  removedFromWebsiteAt:removed_from_website_at,
  daysInStock:days_in_stock,
  imagesCount:images_count,
  heroImageUrl:hero_image_url,
  customFields:custom_fields,
  legacyData:legacy_data,
  isDemo:is_demo,
  currentLocation:current_location,
  locationSince:location_since,
  outForTestDrive:out_for_test_drive,
  testDriveExpectedBackAt:test_drive_expected_back_at,
  co2Emissions:co2_emissions,
  euroStatus:euro_status,
  taxStatus:tax_status,
  taxDueDate:tax_due_date,
  motStatus:mot_status,
  wheelplan,
  automatedVehicle:automated_vehicle,
  dateOfLastV5CIssued:date_of_last_v5c_issued,
  firstRegisteredDate:first_registered_date,
  derivative,
  generation,
  trim,
  atDerivativeId:at_derivative_id,
  atRetailValuation:at_retail_valuation,
  atTradeValuation:at_trade_valuation,
  atPartExchangeValuation:at_part_exchange_valuation,
  atPrivateValuation:at_private_valuation,
  atPriceIndicator:at_price_indicator,
  atValuationAt:at_valuation_at,
  createdAt:created_at,
  updatedAt:updated_at
`;

// Map camelCase Vehicle keys to snake_case DB columns.
const CAMEL_TO_SNAKE: Record<string, string> = {
  companyId: "company_id",
  registration: "registration",
  stockId: "stock_id",
  tagNumber: "tag_number",
  make: "make",
  model: "model",
  variantName: "variant_name",
  variantCode: "variant_code",
  year: "year",
  colour: "colour",
  mileage: "mileage",
  vehicleType: "vehicle_type",
  bodyType: "body_type",
  fuelType: "fuel_type",
  transmission: "transmission",
  engineSizeCC: "engine_size_cc",
  receivedDate: "received_date",
  receivedBy: "received_by",
  sellerName: "seller_name",
  sellerPhone: "seller_phone",
  purchaseSource: "purchase_source",
  purchaseChannel: "purchase_channel",
  localOrImport: "local_or_import",
  auctionHouse: "auction_house",
  ownedBy: "owned_by",
  managedBy: "managed_by",
  invoiceDate: "invoice_date",
  v5Received: "v5_received",
  serviceHistory: "service_history",
  numKeys: "num_keys",
  lockNut: "lock_nut",
  motExpiry: "mot_expiry",
  buyingPrice: "buying_price",
  vatOnBuyingPrice: "vat_on_buying_price",
  buyersFee: "buyers_fee",
  inspectionCharge: "inspection_charge",
  collectionFee: "collection_fee",
  deliveryFee: "delivery_fee",
  lateStorageFee: "late_storage_fee",
  otherCharges: "other_charges",
  totalBuyingPrice: "total_buying_price",
  financeProvider: "finance_provider",
  loadingFee: "loading_fee",
  dailyChargeRate: "daily_charge_rate",
  unloadingFee: "unloading_fee",
  stockingCharges: "stocking_charges",
  valueAddition: "value_addition",
  warrantyCost: "warranty_cost",
  landedCost: "landed_cost",
  baseCost: "base_cost",
  minimumSalePrice: "minimum_sale_price",
  listingPrice: "listing_price",
  sellingPrice: "selling_price",
  dateSold: "date_sold",
  sellingAgent: "selling_agent",
  grossEarning: "gross_earning",
  status: "status",
  removedFromWebsiteAt: "removed_from_website_at",
  daysInStock: "days_in_stock",
  imagesCount: "images_count",
  heroImageUrl: "hero_image_url",
  customFields: "custom_fields",
  legacyData: "legacy_data",
  isDemo: "is_demo",
  currentLocation: "current_location",
  locationSince: "location_since",
  outForTestDrive: "out_for_test_drive",
  testDriveExpectedBackAt: "test_drive_expected_back_at",
  // Migration 0017 — DVLA + DVSA compliance fields
  co2Emissions: "co2_emissions",
  euroStatus: "euro_status",
  taxStatus: "tax_status",
  taxDueDate: "tax_due_date",
  motStatus: "mot_status",
  wheelplan: "wheelplan",
  automatedVehicle: "automated_vehicle",
  dateOfLastV5CIssued: "date_of_last_v5c_issued",
  firstRegisteredDate: "first_registered_date",
  // Migration 0018 — AutoTrader taxonomy + valuation
  derivative: "derivative",
  generation: "generation",
  trim: "trim",
  atDerivativeId: "at_derivative_id",
  atRetailValuation: "at_retail_valuation",
  atTradeValuation: "at_trade_valuation",
  atPartExchangeValuation: "at_part_exchange_valuation",
  atPrivateValuation: "at_private_valuation",
  atPriceIndicator: "at_price_indicator",
  atValuationAt: "at_valuation_at",
};

function vehicleToRow(
  input: Record<string, unknown>,
): TableUpdate<"vehicles"> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const col = CAMEL_TO_SNAKE[k];
    if (col) row[col] = v;
  }
  return row as TableUpdate<"vehicles">;
}

export const vehicleService = {
  async getAll(companyId: UUID): Promise<Vehicle[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("vehicles")
        .select(SELECT)
        .eq("company_id", companyId);
      if (error) throw error;
      return (data ?? []) as unknown as Vehicle[];
    });
  },

  // SECURITY: `companyId` is optional and defaults to RLS-only scoping for
  // backward compatibility with existing callers. Pass it where the caller
  // knows the tenant to add an explicit company filter as defense-in-depth.
  async getById(id: UUID, companyId?: UUID): Promise<Vehicle | null> {
    return withCache(`${NS}by-id:${id}:${companyId ?? "*"}`, async () => {
      const supabase = createClient();
      let q = supabase.from("vehicles").select(SELECT).eq("id", id);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data as unknown as Vehicle | null;
    });
  },

  // SECURITY: see getById — optional explicit company scoping.
  async getByRegistration(reg: string, companyId?: UUID): Promise<Vehicle | null> {
    const supabase = createClient();
    // UK plates can sit in the column either with their canonical space
    // ("LF62 LGX") or without ("LF62LGX") depending on how the row was
    // inserted. Match either form via a single `.eq()` against the most
    // likely shape, then fall back to the other if no row comes back.
    // We tried `.or(ilike, …)`, `.in([...])`, and `.maybeSingle()` —
    // all of those silently HUNG in supabase-js's PostgREST builder for
    // some query shapes (promise never settles, no error logged). The
    // simplest plain `.eq().limit(1)` shape always resolves.
    const cleaned = reg.toUpperCase().replace(/\s+/g, "");
    const candidates: string[] = [cleaned];
    if (cleaned.length === 7) {
      candidates.unshift(`${cleaned.slice(0, 4)} ${cleaned.slice(4)}`);
    }
    const trimmed = reg.trim().toUpperCase();
    if (!candidates.includes(trimmed)) candidates.unshift(trimmed);

    for (const candidate of candidates) {
      let q = supabase
        .from("vehicles")
        .select(SELECT)
        .eq("registration", candidate);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q.limit(1);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (row) return row as unknown as Vehicle;
    }
    return null;
  },

  async getByStatus(
    companyId: UUID,
    status: VehicleStatus,
  ): Promise<Vehicle[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select(SELECT)
      .eq("company_id", companyId)
      .eq("status", status);
    if (error) throw error;
    return (data ?? []) as unknown as Vehicle[];
  },

  async getRecent(companyId: UUID, days: number): Promise<Vehicle[]> {
    const supabase = createClient();
    const cutoff = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data, error } = await supabase
      .from("vehicles")
      .select(SELECT)
      .eq("company_id", companyId)
      .gte("received_date", cutoff);
    if (error) throw error;
    return (data ?? []) as unknown as Vehicle[];
  },

  async getSoldRecently(companyId: UUID, days: number): Promise<Vehicle[]> {
    const supabase = createClient();
    const cutoff = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data, error } = await supabase
      .from("vehicles")
      .select(SELECT)
      .eq("company_id", companyId)
      .eq("status", "sold")
      .gte("date_sold", cutoff);
    if (error) throw error;
    return (data ?? []) as unknown as Vehicle[];
  },

  async create(
    // Location fields (Module A · migration 0010) have DB defaults; let
    // callers omit them and rely on the server-side default of
    // `current_location='forecourt'`, `location_since=now()`,
    // `out_for_test_drive=false`. Same for the import-only `legacyData`
    // and the demo flag.
    input: Omit<
      Vehicle,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "stockId"
      | "currentLocation"
      | "locationSince"
      | "outForTestDrive"
      | "testDriveExpectedBackAt"
      | "legacyData"
      | "isDemo"
    >,
    actorId: UUID,
  ): Promise<Vehicle> {
    const supabase = createClient();
    // 1. Reserve a stock ID atomically via RPC.
    const { data: stockId, error: rpcErr } = await supabase.rpc(
      "next_stock_seq",
      { p_company_id: input.companyId },
    );
    if (rpcErr) throw rpcErr;

    // 2. Insert the vehicle row.
    const insertRow = {
      ...vehicleToRow(input as unknown as Record<string, unknown>),
      stock_id: stockId,
    } as TableInsert<"vehicles">;
    const { data, error } = await supabase
      .from("vehicles")
      .insert(insertRow)
      .select(SELECT)
      .single();
    if (error) throw error;
    const vehicle = data as unknown as Vehicle;
    invalidate(NS);

    // 3. Auto-create the new-stock maintenance job + activity entries.
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const { data: job } = await supabase
      .from("maintenance_jobs")
      .insert({
        company_id: vehicle.companyId,
        vehicle_id: vehicle.id,
        description: "New stock — needs inspection + readiness",
        estimated_duration_hours: 2,
        due_date: dueDate.toISOString().slice(0, 10),
        status: "pending",
      })
      .select("id")
      .single();

    await Promise.all([
      activityService.log({
        companyId: vehicle.companyId,
        userId: actorId,
        vehicleId: vehicle.id,
        actionType: "vehicle_arrived",
        description: `${vehicle.make} ${vehicle.model} (${vehicle.registration}) received`,
        metadata: { stockId: vehicle.stockId },
      }),
      activityService.log({
        companyId: vehicle.companyId,
        userId: actorId,
        vehicleId: vehicle.id,
        actionType: "maintenance_job_created",
        description: `New stock maintenance job created for ${vehicle.registration}`,
        metadata: { jobId: job?.id },
      }),
    ]);

    return vehicle;
  },

  async update(
    id: UUID,
    patch: Partial<Vehicle>,
    actorId: UUID,
  ): Promise<Vehicle> {
    const supabase = createClient();
    const updates = vehicleToRow(patch as unknown as Record<string, unknown>);
    const { data, error } = await supabase
      .from("vehicles")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const vehicle = data as unknown as Vehicle;
    invalidate(NS);
    await activityService.log({
      companyId: vehicle.companyId,
      userId: actorId,
      vehicleId: id,
      actionType: "cost_updated",
      description: `${vehicle.registration} updated`,
      metadata: {},
    });
    return vehicle;
  },

  /**
   * Persist AutoTrader valuation + taxonomy fields after a live refresh on
   * the Vehicle Detail Overview. No activity-log entry (valuations refresh
   * often — keeps the audit trail clean) and no actor needed. RLS-scoped
   * via the user's session, so no service-role key required.
   */
  async updateValuation(id: UUID, patch: Partial<Vehicle>): Promise<void> {
    const supabase = createClient();
    const updates = vehicleToRow(patch as unknown as Record<string, unknown>);
    const { error } = await supabase.from("vehicles").update(updates).eq("id", id);
    if (error) throw error;
    invalidate(NS);
  },

  async changeStatus(
    id: UUID,
    newStatus: VehicleStatus,
    actorId: UUID,
  ): Promise<Vehicle> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .update({ status: newStatus })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const vehicle = data as unknown as Vehicle;
    invalidate(NS);
    await activityService.log({
      companyId: vehicle.companyId,
      userId: actorId,
      vehicleId: id,
      actionType: "vehicle_status_changed",
      description: `${vehicle.registration} → ${newStatus}`,
      metadata: { newStatus },
    });
    return vehicle;
  },

  async removeFromWebsite(id: UUID, actorId: UUID): Promise<Vehicle> {
    // Status is intentionally left unchanged here. Removal only applies to
    // already-sold vehicles, and every live-stock / stock-overview query
    // already combines its status filter with `removedFromWebsiteAt === null`
    // (see dashboard-kpi-row, dashboard-stock-overview, advert/work-list).
    // The timestamp approach is therefore internally consistent; mutating the
    // status would risk losing the "sold" state and is avoided.
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .update({ removed_from_website_at: new Date().toISOString() })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const vehicle = data as unknown as Vehicle;
    invalidate(NS);
    await activityService.log({
      companyId: vehicle.companyId,
      userId: actorId,
      vehicleId: id,
      actionType: "vehicle_status_changed",
      description: `${vehicle.registration} removed from website (still on Master Sheet)`,
      metadata: { event: "removed_from_website" },
    });
    return vehicle;
  },

  async setHeroImageUrl(id: UUID, url: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("vehicles")
      .update({ hero_image_url: url })
      .eq("id", id);
    if (error) throw error;
    invalidate(NS);
  },
};
