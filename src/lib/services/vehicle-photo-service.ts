import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { UUID } from "@/lib/types";

/**
 * Real dealer-uploaded vehicle photos — distinct from the AI-generated angle
 * stand-ins on the Photos tab. Stored in the public `vehicle-photos` bucket
 * (path `<companyId>/<vehicleId>/<ts>_<name>`) with a row in `vehicle_photos`.
 * Tenancy is enforced by RLS (company-scoped policies already provisioned):
 *   - table:   vehicle_photos_all
 *   - storage: company_write_vehicle_photos
 * Because the bucket is public-read we persist the public URL directly, the
 * same convention as `vehicles.hero_image_url`.
 */

const BUCKET = "vehicle-photos";

const ALLOWED_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export interface VehiclePhoto {
  id: UUID;
  vehicleId: UUID;
  url: string;
  order: number;
  uploadedBy: UUID;
  uploadedAt: string;
}

type VehiclePhotoRow = Database["public"]["Tables"]["vehicle_photos"]["Row"];

function mapRow(r: VehiclePhotoRow): VehiclePhoto {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    url: r.url,
    order: r.order ?? 0,
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
  };
}

export const vehiclePhotoService = {
  /** All photos for a vehicle, ordered by `order` then upload time. */
  async list(vehicleId: UUID): Promise<VehiclePhoto[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vehicle_photos")
      .select("*")
      .eq("vehicle_id", vehicleId);
    if (error) throw error;
    return (data ?? [])
      .map(mapRow)
      .sort(
        (a, b) =>
          a.order - b.order || a.uploadedAt.localeCompare(b.uploadedAt),
      );
  },

  /**
   * Upload one image to Storage and record it in `vehicle_photos`.
   * Throws on disallowed MIME type or oversized file.
   */
  async upload(
    file: File,
    companyId: UUID,
    vehicleId: UUID,
    userId: UUID,
    order: number,
  ): Promise<VehiclePhoto> {
    if (!ALLOWED_MIME.has(file.type)) {
      throw new Error(`Unsupported file "${file.type}". Use JPG, PNG, or WebP.`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 15 MB.`,
      );
    }
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `${companyId}/${vehicleId}/${Date.now()}_${safeName}`;
    const supabase = createClient();

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = (pub as { publicUrl: string }).publicUrl;

    const { data, error } = await supabase
      .from("vehicle_photos")
      .insert({ vehicle_id: vehicleId, url, uploaded_by: userId, order })
      .select("*")
      .single();
    if (error) throw error;
    return mapRow(data);
  },

  /** Persist a new display order. Pass the photo ids in their desired order. */
  async reorder(orderedIds: UUID[]): Promise<void> {
    const supabase = createClient();
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from("vehicle_photos")
        .update({ order: i })
        .eq("id", orderedIds[i]);
      if (error) throw error;
    }
  },

  /** Delete the row + best-effort purge of the Storage object. */
  async remove(photo: VehiclePhoto): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("vehicle_photos")
      .delete()
      .eq("id", photo.id);
    if (error) throw error;

    const marker = `/${BUCKET}/`;
    const idx = photo.url.indexOf(marker);
    if (idx !== -1) {
      const objectPath = photo.url.slice(idx + marker.length);
      await supabase.storage
        .from(BUCKET)
        .remove([objectPath])
        .catch(() => {
          /* row is gone; orphaned object will be swept later. */
        });
    }
  },
};
