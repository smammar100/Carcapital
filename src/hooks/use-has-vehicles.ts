"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";

/**
 * Is there a single vehicle on the system yet?
 *
 * `null` means "not known yet" — callers should render neither branch rather
 * than guessing. Both guesses look broken: assume empty and a real dealership
 * sees the first-run screen flash before its dashboard; assume stocked and a
 * brand-new one watches zeroed tiles resolve into a welcome.
 *
 * Safe to call from more than one component. `vehicleService.getAll` is cached
 * per company, so the dashboard page and the layout that hides the nav around
 * it share one request rather than racing two.
 */
export function useHasVehicles(): boolean | null {
  const { company } = useAuth();
  const [hasVehicles, setHasVehicles] = useState<boolean | null>(null);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    void vehicleService
      .getAll(company.id)
      .then((v) => {
        if (!cancelled) setHasVehicles(v.length > 0);
      })
      // A failed count must not strand the user on a first-run screen or hide
      // their nav — fall back to the normal app, which handles its own empty
      // states.
      .catch(() => {
        if (!cancelled) setHasVehicles(true);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  return hasVehicles;
}

/**
 * True only on the dashboard, and only while the system holds no vehicles —
 * the one screen that drops the nav rail and suppresses the guided tour.
 *
 * Kept here, next to the fetch, so the layout and the page cannot drift on
 * what "the welcome screen" means and end up hiding the rail on a page that
 * is not showing it.
 */
export function useIsWelcomeScreen(pathname: string): boolean {
  // The hook is called FIRST and unconditionally. Folding it into the
  // `pathname === "/dashboard" && ...` expression would short-circuit it away
  // on every other route, changing the hook order between renders.
  const hasVehicles = useHasVehicles();
  return pathname === "/dashboard" && hasVehicles === false;
}
