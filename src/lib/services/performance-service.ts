import { leadService } from "./lead-service";
import type { ListingChannel, UUID } from "@/lib/types";

const MARKETPLACE_CHANNELS: ListingChannel[] = [
  "website",
  "autotrader",
  "ebay",
  "facebook",
];
const TREND_DAYS = 30;

export interface VehicleEnquiry {
  /** All leads linked to this vehicle (any source). */
  total: number;
  /** Leads broken down by marketplace source (website/autotrader/ebay/facebook). */
  byChannel: Record<ListingChannel, number>;
}

export interface PerformanceStats {
  /** Enquiry counts keyed by vehicleId. */
  byVehicle: Record<string, VehicleEnquiry>;
  /** Daily lead counts for the last TREND_DAYS days (oldest → newest). */
  trend: number[];
  /** Total leads inside the trend window (for the chart label). */
  leadsTotal: number;
  /** Window length in days, so the UI label stays in sync with the data. */
  trendDays: number;
}

export const performanceService = {
  /**
   * Enquiry analytics for the advert Performance page.
   *
   * ── OPTION 2 (current implementation) ──
   * Derives every count LIVE from the `leads` table: single source of truth,
   * no denormalised column to drift, and real per-marketplace attribution via
   * `lead.source`. Cheap at current scale (hundreds of leads) and the leads
   * fetch is already cached by `leadService`.
   *
   * ── Switching to OPTION 1 (denormalised counts) for scale later ──
   * If the per-read aggregation ever becomes too heavy, reimplement THIS method
   * to read pre-aggregated values (e.g. `listings.enquiries_count` + a
   * per-channel rollup table maintained by a DB trigger) and return the SAME
   * `PerformanceStats` shape. The Performance page consumes only this return
   * value, so no UI changes are required — the swap is contained here.
   */
  async getStats(companyId: UUID): Promise<PerformanceStats> {
    const leads = await leadService.getAll(companyId);
    const byVehicle: Record<string, VehicleEnquiry> = {};
    const trend = new Array(TREND_DAYS).fill(0) as number[];
    let leadsTotal = 0;
    // Date.now() is fine here — this runs in a service (async), not during render.
    // Bucket by calendar day using UTC midnights so a DST transition can't skew
    // a lead into the wrong day (raw /86_400_000 drifts by an hour on the
    // change-over days). utcMidnight() floors a timestamp to 00:00 UTC.
    const utcMidnight = (ms: number) => {
      const d = new Date(ms);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    };
    const today = utcMidnight(Date.now());

    for (const lead of leads) {
      const dayIdx = Math.round(
        (today - utcMidnight(new Date(lead.createdAt).getTime())) /
          86_400_000,
      );
      if (dayIdx >= 0 && dayIdx < TREND_DAYS) {
        trend[TREND_DAYS - 1 - dayIdx] += 1;
        leadsTotal += 1;
      }

      if (!lead.vehicleId) continue;
      const v = (byVehicle[lead.vehicleId] ??= {
        total: 0,
        byChannel: { website: 0, autotrader: 0, ebay: 0, facebook: 0 },
      });
      v.total += 1;
      if ((MARKETPLACE_CHANNELS as string[]).includes(lead.source)) {
        v.byChannel[lead.source as ListingChannel] += 1;
      }
    }

    return { byVehicle, trend, leadsTotal, trendDays: TREND_DAYS };
  },
};
