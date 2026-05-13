"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { warrantyService } from "@/lib/services/warranty-service";
import { claimService } from "@/lib/services/claim-service";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Live badges for the Warranties section in the sidebar.
 *
 * Each badge mounts its own data fetcher. Because every service method is
 * wrapped in the shared cache (`src/lib/cache.ts`), the three badges +
 * the corresponding warranty pages share a single round-trip per key.
 */

const BADGE_CLASS = "ml-auto h-5 min-w-[20px] px-1.5 text-[10px] font-medium";

function InHouseWarrantyBadge() {
  const { company } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!company) return;
    let cancel = false;
    void warrantyService
      .getTotalCountByType(company.id)
      .then(({ inHouse }) => {
        if (!cancel) setCount(inHouse);
      });
    return () => {
      cancel = true;
    };
  }, [company]);
  if (count == null || count === 0) return null;
  return (
    <Badge variant="secondary" className={BADGE_CLASS}>
      {count}
    </Badge>
  );
}

function ExternalWarrantyBadge() {
  const { company } = useAuth();
  const [state, setState] = useState<{ pending: number; total: number } | null>(
    null,
  );
  useEffect(() => {
    if (!company) return;
    let cancel = false;
    void Promise.all([
      warrantyService.getPendingPurchaseCount(company.id),
      warrantyService.getTotalCountByType(company.id),
    ]).then(([pending, totals]) => {
      if (!cancel) setState({ pending, total: totals.external });
    });
    return () => {
      cancel = true;
    };
  }, [company]);
  if (!state) return null;
  if (state.pending > 0) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          BADGE_CLASS,
          "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200",
        )}
      >
        {state.pending}
      </Badge>
    );
  }
  if (state.total === 0) return null;
  return (
    <Badge variant="secondary" className={BADGE_CLASS}>
      {state.total}
    </Badge>
  );
}

function ClaimsBadge() {
  const { company } = useAuth();
  const [state, setState] = useState<{ open: number; total: number } | null>(
    null,
  );
  useEffect(() => {
    if (!company) return;
    let cancel = false;
    void Promise.all([
      claimService.getOpenCount(company.id),
      claimService.getAll(company.id),
    ]).then(([open, all]) => {
      if (!cancel) setState({ open, total: all.length });
    });
    return () => {
      cancel = true;
    };
  }, [company]);
  if (!state) return null;
  if (state.open > 0) {
    return (
      <Badge variant="destructive" className={BADGE_CLASS}>
        {state.open}
      </Badge>
    );
  }
  if (state.total === 0) return null;
  return (
    <Badge variant="secondary" className={BADGE_CLASS}>
      {state.total}
    </Badge>
  );
}

/**
 * Map of nav href → badge component. The sidebar's NavRow looks up its own
 * href here and renders the badge inline when present.
 */
export const SIDEBAR_BADGES: Record<string, React.ComponentType> = {
  "/warranties/in-house": InHouseWarrantyBadge,
  "/warranties/external": ExternalWarrantyBadge,
  "/warranties/claims": ClaimsBadge,
};
