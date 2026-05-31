"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  VEHICLE_LOCATIONS,
  VEHICLE_LOCATION_LABELS,
  type UUID,
  type User,
  type Vehicle,
  type VehicleLocation,
  type Vendor,
} from "@/lib/types";
import { locationService } from "@/lib/services/location-service";
import { vendorService } from "@/lib/services/vendor-service";
import { teamService } from "@/lib/services/team-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { cn } from "@/lib/utils";
import { LocationTab } from "@/components/locations/location-tab";
import { MoveDialog } from "@/components/locations/move-dialog";

const TAB_PARAM = "tab";

function isValidTab(s: string | null): s is VehicleLocation {
  return s != null && (VEHICLE_LOCATIONS as string[]).includes(s);
}

/**
 * /admin/locations — Module A (Spec v3.0 · Phase 2).
 *
 * 4-tab page (Forecourt / Yard / Garage / Staff) backed by
 * `vehicles.current_location`. Tab state syncs via the URL search-param
 * `?tab=…`. Each tab renders a `LocationTab` table; a row's Move action
 * opens the shared `MoveDialog`. Capability `locations:move` gates the
 * Move action (Super User bypasses via `isSuperUser`).
 */
export default function LocationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get(TAB_PARAM);
  const activeTab: VehicleLocation = isValidTab(tabParam)
    ? tabParam
    : "forecourt";

  const { company, user } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const companyId = company?.id;
  const actorId = user?.id;

  const [counts, setCounts] = useState<Record<VehicleLocation, number> | null>(
    null,
  );
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [moveTarget, setMoveTarget] = useState<Vehicle | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const canMove = isSuperUser || can("locations:move");

  // Load shared lookups + tab counts once per company.
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    Promise.all([
      locationService.getCounts(companyId),
      vendorService.getAll(companyId),
      teamService.getAll(companyId),
    ])
      .then(([c, v, u]) => {
        if (cancelled) return;
        setCounts(c);
        setVendors(v);
        setUsers(u);
      })
      .catch(() => {
        if (!cancelled) {
          setCounts({ forecourt: 0, yard: 0, garage: 0, staff: 0 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, refreshToken]);

  const setTab = useCallback(
    (loc: VehicleLocation) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set(TAB_PARAM, loc);
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleRequestMove = useCallback(
    async (vehicleId: UUID) => {
      // Pull the full vehicle so the dialog can show identity + current
      // location accurately (the LocationTab row carries only a slice).
      const v = await vehicleService.getById(vehicleId);
      if (v) setMoveTarget(v);
    },
    [],
  );

  const handleMoveSuccess = useCallback(() => {
    setRefreshToken((t) => t + 1);
  }, []);

  const totalActive = useMemo(() => {
    if (!counts) return 0;
    return counts.forecourt + counts.yard + counts.garage + counts.staff;
  }, [counts]);

  if (!companyId || !actorId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading session…</div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MapPin className="size-5" /> Locations
          </h1>
          <p className="text-sm text-muted-foreground">
            Every car has exactly one location. Click a tab to view what&apos;s where.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {counts ? `${totalActive} total active` : ""}
        </div>
      </header>

      {/* Tab row with live counts */}
      <div className="flex flex-wrap items-end gap-1 border-b">
        {VEHICLE_LOCATIONS.map((loc) => {
          const active = loc === activeTab;
          const count = counts?.[loc] ?? null;
          return (
            <button
              key={loc}
              type="button"
              onClick={() => setTab(loc)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={active}
            >
              <span>{VEHICLE_LOCATION_LABELS[loc]}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                  active ? "bg-foreground/10" : "bg-muted",
                )}
              >
                {count ?? "·"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab pane */}
      <LocationTab
        location={activeTab}
        companyId={companyId}
        vendors={vendors}
        users={users}
        refreshToken={refreshToken}
        onRequestMove={canMove ? handleRequestMove : () => {}}
      />

      {/* Move dialog */}
      {moveTarget ? (
        <MoveDialog
          open={!!moveTarget}
          onOpenChange={(open) => {
            if (!open) setMoveTarget(null);
          }}
          vehicle={moveTarget}
          vendors={vendors}
          users={users}
          actorId={actorId}
          companyId={companyId}
          onSuccess={handleMoveSuccess}
        />
      ) : null}
    </div>
  );
}
