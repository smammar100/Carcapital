"use client";

import { useEffect, useMemo, useState } from "react";
import type { LocationMovement, UUID, User, Vehicle, Vendor } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { locationService } from "@/lib/services/location-service";
import { vendorService } from "@/lib/services/vendor-service";
import { teamService } from "@/lib/services/team-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { LocationCard } from "./location-card";
import { MoveDialog } from "./move-dialog";
import { LocationHistoryDrawer } from "./location-history-drawer";

interface Props {
  vehicle: Vehicle;
}

/**
 * Right-column Location section for Vehicle Detail Overview tab.
 * Self-contained: owns the MoveDialog + LocationHistoryDrawer state,
 * loads vendors / users for the move-dialog lookups, and re-fetches the
 * recent-movements preview after a successful move.
 */
export function VehicleLocationSection({ vehicle: vehicleProp }: Props) {
  const { company, user } = useAuth();
  // Same pattern as LocationTab: hold the vehicle locally and re-fetch
  // after each move / mark-returned so the card stays in sync without
  // waiting on a parent re-render.
  const [vehicle, setVehicle] = useState<Vehicle>(vehicleProp);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [recent, setRecent] = useState<LocationMovement[] | undefined>(
    undefined,
  );
  const [moveOpen, setMoveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setVehicle(vehicleProp);
  }, [vehicleProp]);

  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    Promise.all([
      vendorService.getAll(company.id),
      teamService.getAll(company.id),
      locationService.getRecentMovements(vehicleProp.id, 3),
      vehicleService.getById(vehicleProp.id),
    ])
      .then(([v, u, r, fresh]) => {
        if (cancelled) return;
        setVendors(v);
        setUsers(u);
        setRecent(r);
        if (fresh) setVehicle(fresh);
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [company?.id, vehicleProp.id, refreshToken]);

  const vendorNames = useMemo<Record<UUID, string>>(
    () => Object.fromEntries(vendors.map((v) => [v.id, v.name])),
    [vendors],
  );
  const staffNames = useMemo<Record<UUID, string>>(
    () => Object.fromEntries(users.map((u) => [u.id, u.name])),
    [users],
  );

  if (!company?.id || !user?.id) return null;

  return (
    <>
      <LocationCard
        vehicle={vehicle}
        recentMovements={recent}
        vendorNames={vendorNames}
        staffNames={staffNames}
        onMove={() => setMoveOpen(true)}
        onViewHistory={() => setHistoryOpen(true)}
      />

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        vehicle={vehicle}
        vendors={vendors}
        users={users}
        actorId={user.id}
        companyId={company.id}
        onSuccess={() => setRefreshToken((t) => t + 1)}
      />

      <LocationHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        vehicle={vehicle}
        actorId={user.id}
        vendorNames={vendorNames}
        staffNames={staffNames}
        onChanged={() => setRefreshToken((t) => t + 1)}
      />
    </>
  );
}
