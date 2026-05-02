import { mockListings } from "@/lib/mock-data";
import type {
  Listing,
  ListingChannel,
  ListingStatus,
  UUID,
} from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

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
    // TODO: Supabase: from('listings').select('*').eq('company_id', companyId)
    await delay();
    return mockListings
      .filter((l) => l.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getForVehicle(vehicleId: UUID): Promise<Listing | null> {
    // TODO: Supabase: ... .eq('vehicle_id', vehicleId).maybeSingle()
    await delay(150);
    return mockListings.find((l) => l.vehicleId === vehicleId) ?? null;
  },

  async create(input: CreateInput, actorId: UUID): Promise<Listing> {
    // TODO: Supabase: insert + log
    await delay();
    const listing: Listing = {
      id: newId("listing"),
      companyId: input.companyId,
      vehicleId: input.vehicleId,
      title: input.title,
      description: input.description,
      price: input.price,
      specialFeatures: input.specialFeatures,
      channels: input.channels,
      atPriceIndicator: input.atPriceIndicator,
      status: "draft",
      publishedAt: null,
      enquiriesCount: 0,
      createdAt: nowIso(),
    };
    mockListings.push(listing);
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
      // Move vehicle to listed status if currently ready
      if (v.status === "ready") {
        await vehicleService.changeStatus(v.id, "listed", actorId);
      }
    }
    return listing;
  },

  async publish(id: UUID, actorId: UUID): Promise<Listing> {
    // TODO: Supabase: update status='live', publishedAt
    await delay();
    const idx = mockListings.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error("Listing not found");
    mockListings[idx] = {
      ...mockListings[idx],
      status: "live",
      publishedAt: nowIso(),
    };
    const v = await vehicleService.getById(mockListings[idx].vehicleId);
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
    return mockListings[idx];
  },

  async toggleChannel(
    id: UUID,
    channel: ListingChannel,
  ): Promise<Listing> {
    // TODO: Supabase: update channels JSON column
    await delay(150);
    const idx = mockListings.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error("Listing not found");
    mockListings[idx] = {
      ...mockListings[idx],
      channels: {
        ...mockListings[idx].channels,
        [channel]: !mockListings[idx].channels[channel],
      },
    };
    return mockListings[idx];
  },

  async updateStatus(id: UUID, status: ListingStatus): Promise<Listing> {
    // TODO: Supabase: update
    await delay();
    const idx = mockListings.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error("Listing not found");
    mockListings[idx] = { ...mockListings[idx], status };
    return mockListings[idx];
  },
};
