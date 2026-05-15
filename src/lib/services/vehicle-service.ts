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
  sourceType:source_type,
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
  sourceType: "source_type",
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

  async getById(id: UUID): Promise<Vehicle | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("vehicles")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Vehicle | null;
    });
  },

  async getByRegistration(reg: string): Promise<Vehicle | null> {
    const supabase = createClient();
    // UK plates can sit in the column either with their canonical space
    // ("LF62 LGX") or without ("LF62LGX") depending on how the row was
    // inserted. PostgREST doesn't support SQL-expression filters like
    // `upper(replace(registration, ' ', ''))`, so we try both shapes via
    // an `or(ilike, ilike)` filter — case-insensitive, matches either form.
    const cleaned = reg.toUpperCase().replace(/\s+/g, "");
    const candidates = new Set<string>([cleaned, reg.trim().toUpperCase()]);
    if (cleaned.length === 7) {
      candidates.add(`${cleaned.slice(0, 4)} ${cleaned.slice(4)}`);
    }
    const orFilter = Array.from(candidates)
      .map((c) => `registration.ilike.${c}`)
      .join(",");
    const { data, error } = await supabase
      .from("vehicles")
      .select(SELECT)
      .or(orFilter)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as Vehicle | null;
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
    input: Omit<Vehicle, "id" | "createdAt" | "updatedAt" | "stockId">,
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
