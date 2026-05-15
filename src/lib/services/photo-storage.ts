/**
 * Server-side helpers for storing AI-generated car images in Supabase Storage.
 *
 * Path convention: `vehicle-heroes/{companyId}/{vehicleId}/{fileBase}.png`.
 * Buckets are public-read, so the URL returned by `writeCarImage` can be
 * dropped straight into an `<img src>` without any further proxying.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "vehicle-heroes";

function objectPath(
  companyId: string,
  vehicleId: string,
  fileBase: string,
): string {
  return `${companyId}/${vehicleId}/${fileBase}.png`;
}

/**
 * Returns the public URL if the image exists in storage, else null.
 * We probe via a HEAD request because Supabase Storage's `list` is paginated
 * and slower for single-existence checks.
 */
export async function readCarImageUrl(
  companyId: string,
  vehicleId: string,
  fileBase: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const path = objectPath(companyId, vehicleId, fileBase);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`${companyId}/${vehicleId}`, {
      limit: 100,
      search: `${fileBase}.png`,
    });
  if (error) return null;
  if (!data?.some((f) => f.name === `${fileBase}.png`)) return null;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/**
 * Writes the buffer to Supabase Storage and returns the public URL.
 * Upserts so a regenerate overwrites the previous image at the same key.
 */
export async function writeCarImage(
  companyId: string,
  vehicleId: string,
  fileBase: string,
  buffer: Buffer,
): Promise<string> {
  const supabase = createAdminClient();
  const path = objectPath(companyId, vehicleId, fileBase);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
