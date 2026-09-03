/**
 * One-shot migration: upload the 15 baked-in seed images from
 * `public/cars/seed/vehicle-N.png` to the `vehicle-heroes` Supabase Storage
 * bucket, then update each vehicle row's `hero_image_url` to the public URL.
 *
 * Idempotent: if a vehicle's hero_image_url is already an https:// URL, skip.
 * Run via:
 *   npx tsx --env-file=.env.local scripts/migrate-seed-images.ts
 */
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "vehicle-heroes";
const SEED_DIR = path.resolve("public/cars/seed");

async function main() {
  // Find every vehicle still pointing at a static seed path.
  const { data: rows, error } = await supabase
    .from("vehicles")
    .select("id, company_id, stock_id, hero_image_url")
    .like("hero_image_url", "/cars/seed/%");
  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log("ℹ️  No vehicles with static seed paths. Nothing to migrate.");
    return;
  }

  console.log(`→ Migrating ${rows.length} hero images to Supabase Storage…`);

  let uploaded = 0;
  const skipped = 0;
  let failed = 0;
  for (const v of rows as Array<{
    id: string;
    company_id: string;
    stock_id: string;
    hero_image_url: string;
  }>) {
    // hero_image_url like "/cars/seed/vehicle-1.png" — pull just the filename.
    const filename = v.hero_image_url.split("/").pop();
    if (!filename) {
      console.warn(`  ⚠ ${v.stock_id}: couldn't parse filename`);
      failed += 1;
      continue;
    }
    const src = path.join(SEED_DIR, filename);
    let buf: Buffer;
    try {
      buf = await fs.readFile(src);
    } catch {
      console.warn(`  ⚠ ${v.stock_id}: missing file ${src}`);
      failed += 1;
      continue;
    }

    const objectPath = `${v.company_id}/${v.id}/hero.png`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buf, {
        contentType: "image/png",
        upsert: true,
      });
    if (upErr) {
      console.warn(`  ✗ ${v.stock_id}: upload failed — ${upErr.message}`);
      failed += 1;
      continue;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    const newUrl = pub.publicUrl;

    const { error: updErr } = await supabase
      .from("vehicles")
      .update({ hero_image_url: newUrl })
      .eq("id", v.id);
    if (updErr) {
      console.warn(
        `  ✗ ${v.stock_id}: uploaded but failed to update row — ${updErr.message}`,
      );
      failed += 1;
      continue;
    }

    console.log(`  ✓ ${v.stock_id} → ${objectPath}`);
    uploaded += 1;
  }

  console.log("\nDone:");
  console.log(`  uploaded: ${uploaded}`);
  console.log(`  skipped:  ${skipped}`);
  console.log(`  failed:   ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Migration failed:", err);
    process.exit(1);
  });
