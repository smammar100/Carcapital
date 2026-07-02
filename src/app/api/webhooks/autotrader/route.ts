/**
 * AutoTrader advertiser-update notification receiver.
 *
 * POST /api/webhooks/autotrader
 *
 * Authenticated by HASH (not a user session) — AutoTrader signs the body with
 * a shared secret (AUTOTRADER_WEBHOOK_SECRET). Go-Live requires:
 *   - verify the hash and return 2XX when it matches;
 *   - identify the notification type ADVERTISER;
 *   - update advertiser details in our system when one is updated.
 *
 * We read the RAW body first (hash is computed over the exact bytes), verify,
 * then process. Non-ADVERTISER types are acknowledged (200) but ignored.
 */

import { NextResponse } from "next/server";
import {
  NOTIFICATION_HASH_HEADER,
  verifyNotificationHash,
} from "@/lib/autotrader/verify-notification";
import { normalizeAdvertiser } from "@/lib/services/autotrader-service";
import { upsertNotifiedAdvertiser } from "@/lib/services/advertiser-service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

interface AdvertiserNotification {
  notificationType?: string;
  advertiser?: unknown;
  advertiserId?: string;
}

export async function POST(request: Request) {
  const secret = process.env.AUTOTRADER_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration — refuse rather than accept unverifiable notifications.
    logger.error("autotrader-webhook", "AUTOTRADER_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // Raw body is required for hash verification — do not parse first.
  const rawBody = await request.text();
  const providedHash = request.headers.get(NOTIFICATION_HASH_HEADER);
  const cfRayId = request.headers.get("cf-ray");

  if (!verifyNotificationHash(rawBody, providedHash, secret)) {
    logger.warn("autotrader-webhook", "hash mismatch", { cfRay: cfRayId });
    return NextResponse.json({ error: "invalid_hash" }, { status: 401 });
  }

  let payload: AdvertiserNotification;
  try {
    payload = JSON.parse(rawBody) as AdvertiserNotification;
  } catch {
    // Hash matched but body isn't JSON — ack so AutoTrader doesn't retry, but
    // flag it: a valid signer sent us garbage.
    logger.warn("autotrader-webhook", "valid hash but non-JSON body", {
      cfRay: cfRayId,
    });
    return NextResponse.json({ received: true, processed: false });
  }

  // Only ADVERTISER notifications carry advertiser data we mirror.
  if (payload.notificationType !== "ADVERTISER") {
    return NextResponse.json({
      received: true,
      processed: false,
      notificationType: payload.notificationType ?? null,
    });
  }

  try {
    const advertiser = normalizeAdvertiser(
      payload.advertiser ?? { advertiserId: payload.advertiserId },
    );
    if (!advertiser.advertiserId) {
      return NextResponse.json({ received: true, processed: false });
    }
    await upsertNotifiedAdvertiser(advertiser, new Date().toISOString());
    return NextResponse.json({
      received: true,
      processed: true,
      advertiserId: advertiser.advertiserId,
    });
  } catch (e) {
    // Hash was valid; the failure is on our side. 500 so AutoTrader retries.
    logger.error("autotrader-webhook", "processing failed", {
      cfRay: cfRayId,
      error: e instanceof Error ? e : String(e),
    });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
