"use client";

import { use, useEffect, useState } from "react";
import { vehicleService } from "@/lib/services/vehicle-service";
import { listingService } from "@/lib/services/listing-service";
import { vehiclePhotoService } from "@/lib/services/vehicle-photo-service";
import type { Listing, Vehicle } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { AdvertEditor } from "@/components/advert/advert-editor";

/**
 * Per-vehicle Advert tool — `/vehicles/[id]/advert`. Owns data hydration
 * (vehicle + its listing + first photo) then hands off to `AdvertEditor`,
 * the guided advert builder with live preview.
 */
export default function VehicleAdvertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [photos, setPhotos] = useState<{ count: number; url: string | null }>({
    count: 0,
    url: null,
  });

  useEffect(() => {
    void vehicleService.getById(id).then(setVehicle);
    void listingService.getForVehicle(id).then(setListing);
    void vehiclePhotoService
      .list(id)
      .then((p) => setPhotos({ count: p.length, url: p[0]?.url ?? null }))
      .catch(() => {});
  }, [id]);

  if (vehicle === undefined || listing === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[28rem] w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (vehicle === null) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Vehicle not found.</div>
    );
  }

  return (
    <AdvertEditor
      vehicle={vehicle}
      listing={listing}
      photoCount={Math.max(vehicle.imagesCount, photos.count)}
      photoUrl={photos.url}
    />
  );
}
