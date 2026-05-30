/**
 * AutoTrader stock publish — POST /api/autotrader/stock.
 *
 * Gated behind an explicit confirm in the Work List UI + the
 * `listing:publish_autotrader` capability. Creates a NOT_PUBLISHED advert on
 * the sandbox advertiser and stores the returned Stock ID on the listing.
 *
 * Body: { vehicleId, listingId }
 * Reads both rows server-side (service role), builds the stock payload via
 * autotrader-stock-mapper, POSTs to AutoTrader, then persists the result
 * (at_stock_id / at_advertising_status / at_last_synced_at) or the error
 * (at_last_error) back to the listing.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AutotraderError,
  createStock,
  autotraderAdvertiserId,
} from "@/lib/services/autotrader-service";
import { buildStockCreateBody } from "@/lib/services/autotrader-stock-mapper";
import type { Vehicle, Listing } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: { vehicleId?: string; listingId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { vehicleId, listingId } = payload;
  if (!vehicleId || !listingId) {
    return NextResponse.json(
      { error: "vehicleId_and_listingId_required" },
      { status: 400 },
    );
  }

  if (!autotraderAdvertiserId() || !process.env.AUTOTRADER_KEY) {
    return NextResponse.json(
      { error: "autotrader_not_configured" },
      { status: 502 },
    );
  }

  // Cast to `any`: the generated database.types.ts doesn't yet include the
  // 0018/0019 columns (at_derivative_id, at_stock_id, …). Same pattern as
  // external-invoice-service.ts until `supabase gen types` is re-run.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Load vehicle + listing.
  const [{ data: vRow, error: vErr }, { data: lRow, error: lErr }] =
    await Promise.all([
      supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle(),
      supabase.from("listings").select("*").eq("id", listingId).maybeSingle(),
    ]);
  if (vErr || lErr) {
    return NextResponse.json({ error: "db_read_failed" }, { status: 500 });
  }
  if (!vRow || !lRow) {
    return NextResponse.json({ error: "vehicle_or_listing_not_found" }, { status: 404 });
  }
  // Defense: the listing must belong to the vehicle + same company.
  if (lRow.vehicle_id !== vehicleId || lRow.company_id !== vRow.company_id) {
    return NextResponse.json({ error: "vehicle_listing_mismatch" }, { status: 400 });
  }

  // Map snake_case rows → the camelCase shape the mapper expects (only the
  // fields it reads).
  const vehicle = {
    registration: vRow.registration,
    stockId: vRow.stock_id,
    mileage: vRow.mileage,
    make: vRow.make,
    model: vRow.model,
    vehicleType: vRow.vehicle_type,
    fuelType: vRow.fuel_type,
    bodyType: vRow.body_type,
    transmission: vRow.transmission,
    generation: vRow.generation ?? null,
    derivative: vRow.derivative ?? null,
    atDerivativeId: vRow.at_derivative_id ?? null,
    imagesCount: vRow.images_count ?? 0,
    heroImageUrl: vRow.hero_image_url ?? null,
  } as unknown as Vehicle;
  const listing = {
    price: lRow.price,
    description: lRow.description,
    specialFeatures: lRow.special_features,
  } as unknown as Listing;

  const { body, warnings } = buildStockCreateBody({ vehicle, listing });

  try {
    const result = await createStock(body);
    await supabase
      .from("listings")
      .update({
        at_stock_id: result.stockId,
        at_advertising_status: result.advertisingStatus,
        at_last_synced_at: new Date().toISOString(),
        at_last_error: null,
      })
      .eq("id", listingId);

    return NextResponse.json({
      stockId: result.stockId,
      advertisingStatus: result.advertisingStatus,
      warnings,
    });
  } catch (e) {
    const message =
      e instanceof AutotraderError ? `${e.code}: ${e.message}` : String(e);
    // Persist the failure so the Work List can show "AT: error".
    await supabase
      .from("listings")
      .update({
        at_last_error: message.slice(0, 500),
        at_last_synced_at: new Date().toISOString(),
      })
      .eq("id", listingId);
    console.warn(`[autotrader-stock] publish failed for listing ${listingId}: ${message}`);
    return NextResponse.json(
      { error: "publish_failed", detail: message, warnings },
      { status: 502 },
    );
  }
}
