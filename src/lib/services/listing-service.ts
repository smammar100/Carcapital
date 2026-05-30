import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type {
  Listing,
  ListingChannel,
  ListingStatus,
  UUID,
} from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

const NS = "listings:";

const SELECT = `
  id,
  companyId:company_id,
  vehicleId:vehicle_id,
  title,
  description,
  price,
  specialFeatures:special_features,
  channels,
  atPriceIndicator:at_price_indicator,
  status,
  publishedAt:published_at,
  enquiriesCount:enquiries_count,
  atStockId:at_stock_id,
  atAdvertisingStatus:at_advertising_status,
  atLastSyncedAt:at_last_synced_at,
  atLastError:at_last_error,
  createdAt:created_at
`;

interface CreateInput {
  companyId: UUID;
  vehicleId: UUID;
  title: string;
  description: string;
  price: number;
  specialFeatures: string;
  channels: Record<ListingChannel, boolean>;
  atPriceIndicator: Listing["atPriceIndicator"];
}

export const listingService = {
  async getAll(companyId: UUID): Promise<Listing[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("listings")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Listing[];
    });
  },

  async getForVehicle(vehicleId: UUID): Promise<Listing | null> {
    return withCache(`${NS}vehicle:${vehicleId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("listings")
        .select(SELECT)
        .eq("vehicle_id", vehicleId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Listing | null;
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<Listing> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("listings")
      .insert({
        company_id: input.companyId,
        vehicle_id: input.vehicleId,
        title: input.title,
        description: input.description,
        price: input.price,
        special_features: input.specialFeatures,
        channels: input.channels,
        at_price_indicator: input.atPriceIndicator,
        status: "draft",
        enquiries_count: 0,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const listing = data as unknown as Listing;
    invalidate(NS);
    const v = await vehicleService.getById(input.vehicleId);
    if (v) {
      await activityService.log({
        companyId: input.companyId,
        userId: actorId,
        vehicleId: v.id,
        actionType: "listing_created",
        description: `Listing created for ${v.registration}`,
        metadata: { listingId: listing.id },
      });
      if (v.status === "ready") {
        await vehicleService.changeStatus(v.id, "listed", actorId);
      }
    }
    return listing;
  },

  async publish(id: UUID, actorId: UUID): Promise<Listing> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("listings")
      .update({ status: "live", published_at: new Date().toISOString() })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const listing = data as unknown as Listing;
    invalidate(NS);
    const v = await vehicleService.getById(listing.vehicleId);
    if (v) {
      await activityService.log({
        companyId: v.companyId,
        userId: actorId,
        vehicleId: v.id,
        actionType: "listing_published",
        description: `${v.make} ${v.model} ${v.registration} published`,
        metadata: { listingId: id },
      });
    }
    return listing;
  },

  async toggleChannel(id: UUID, channel: ListingChannel): Promise<Listing> {
    const supabase = createClient();
    const { data: row } = await supabase
      .from("listings")
      .select("channels")
      .eq("id", id)
      .single();
    if (!row) throw new Error("Listing not found");
    const channels = (row as { channels: Record<ListingChannel, boolean> })
      .channels;
    channels[channel] = !channels[channel];
    const { data, error } = await supabase
      .from("listings")
      .update({ channels })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as Listing;
  },

  async updateStatus(id: UUID, status: ListingStatus): Promise<Listing> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("listings")
      .update({ status })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as Listing;
  },
};
