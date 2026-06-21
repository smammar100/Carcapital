"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { listingService } from "@/lib/services/listing-service";
import type { Listing, ListingChannel } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";

const CHANNEL_LABEL: Record<ListingChannel, string> = {
  website: "Website",
  autotrader: "AutoTrader",
  ebay: "eBay",
  facebook: "Facebook",
};

export default function PerformancePage() {
  const { company } = useAuth();
  const [listings, setListings] = useState<Listing[] | null>(null);

  useEffect(() => {
    if (!company) return;
    void listingService.getAll(company.id).then(setListings);
  }, [company]);

  const stats = useMemo(() => {
    if (!listings) return null;
    const counts: Record<ListingChannel, { live: number; enquiries: number }> = {
      website: { live: 0, enquiries: 0 },
      autotrader: { live: 0, enquiries: 0 },
      ebay: { live: 0, enquiries: 0 },
      facebook: { live: 0, enquiries: 0 },
    };
    for (const l of listings) {
      if (l.status !== "live") continue;
      for (const channel of Object.keys(counts) as ListingChannel[]) {
        if (l.channels[channel]) {
          counts[channel].live += 1;
          counts[channel].enquiries += l.enquiriesCount;
        }
      }
    }
    return counts;
  }, [listings]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="text-sm text-muted-foreground">
          How your adverts are doing: live-listing counts and buyer enquiries
          broken down by marketplace channel.
        </p>
      </div>

      {!stats ? (
        <Skeleton className="h-40" />
      ) : Object.values(stats).every((s) => s.live === 0) ? (
        <EmptyState
          icon={BarChart3}
          title="No live listings yet"
          description="Publish a vehicle from the Work List to start tracking performance."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(stats) as ListingChannel[]).map((channel) => {
            const s = stats[channel];
            return (
              <Card key={channel} className="flex flex-col gap-2 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {CHANNEL_LABEL[channel]}
                </div>
                <div className="text-2xl font-semibold tabular-nums">{s.live}</div>
                <div className="text-xs text-muted-foreground">live listings</div>
                <div className="mt-2 text-sm tabular-nums">
                  {s.enquiries} <span className="text-xs text-muted-foreground">enquiries</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
