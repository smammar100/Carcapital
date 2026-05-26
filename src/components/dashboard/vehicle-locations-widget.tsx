"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  VEHICLE_LOCATIONS,
  VEHICLE_LOCATION_LABELS,
  type UUID,
  type VehicleLocation,
} from "@/lib/types";
import { locationService } from "@/lib/services/location-service";

interface Props {
  /** When omitted, the widget pulls companyId from `useAuth()`. */
  companyId?: UUID;
  className?: string;
}

/**
 * Dashboard widget — 4 location counts (Spec v3.0 · Module A · Chunk 2.7).
 * Each row is a Link that drops the user onto `/admin/locations?tab=…`.
 */
export function VehicleLocationsWidget({ companyId, className }: Props) {
  const { company } = useAuth();
  const resolvedCompanyId = companyId ?? company?.id ?? null;
  const [counts, setCounts] = useState<Record<VehicleLocation, number> | null>(
    null,
  );

  useEffect(() => {
    if (!resolvedCompanyId) return;
    let cancelled = false;
    locationService
      .getCounts(resolvedCompanyId)
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .catch(() => {
        if (!cancelled) setCounts({ forecourt: 0, yard: 0, garage: 0, staff: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedCompanyId]);

  const total = counts
    ? counts.forecourt + counts.yard + counts.garage + counts.staff
    : null;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 text-sm shadow-sm",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <MapPin className="size-3.5" /> Vehicle locations
      </div>

      {counts === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <ul className="space-y-1">
          {VEHICLE_LOCATIONS.map((loc) => (
            <li key={loc}>
              <Link
                href={`/admin/locations?tab=${loc}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
              >
                <span>{VEHICLE_LOCATION_LABELS[loc]}</span>
                <span className="font-mono tabular-nums">{counts[loc]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
        Total:{" "}
        <span className="font-medium text-foreground">{total ?? "·"}</span>{" "}
        active vehicle{total === 1 ? "" : "s"}
      </div>
    </div>
  );
}
