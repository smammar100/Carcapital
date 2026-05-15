"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { warrantyService } from "@/lib/services/warranty-service";
import { claimService } from "@/lib/services/claim-service";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KpiState {
  activeInHouse: number;
  activeExternal: number;
  pendingPurchase: number;
  openClaims: number;
  expiringSoon: number;
}

/**
 * Four-card metrics row shared across the three warranty views.
 * The Pending Purchase card switches to an accent border when > 0 — the
 * brief calls this out as a deliberate nudge for the team.
 */
export function KpiStrip({ refreshKey = 0 }: { refreshKey?: number }) {
  const { company } = useAuth();
  const [state, setState] = useState<KpiState | null>(null);

  useEffect(() => {
    if (!company) return;
    let cancel = false;
    void Promise.all([
      warrantyService.getActiveCount(company.id),
      warrantyService.getPendingPurchaseCount(company.id),
      claimService.getOpenCount(company.id),
      warrantyService.getExpiringSoon(company.id, 30),
    ]).then(([active, pending, openClaims, expiring]) => {
      if (cancel) return;
      setState({
        activeInHouse: active.inHouse,
        activeExternal: active.external,
        pendingPurchase: pending,
        openClaims,
        expiringSoon: expiring.length,
      });
    });
    return () => {
      cancel = true;
    };
  }, [company, refreshKey]);

  if (!state) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const totalActive = state.activeInHouse + state.activeExternal;
  const pendingAccent = state.pendingPurchase > 0;
  const claimsAccent = state.openClaims > 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={ShieldCheck}
        label="Active warranties"
        value={totalActive}
        hint={`${state.activeInHouse} in-house · ${state.activeExternal} external`}
      />
      <KpiCard
        icon={Clock}
        label="Pending purchase"
        value={state.pendingPurchase}
        hint={pendingAccent ? "Action needed" : "All up to date"}
        accent={pendingAccent ? "amber" : undefined}
      />
      <KpiCard
        icon={ShieldAlert}
        label="Open claims"
        value={state.openClaims}
        hint={claimsAccent ? "Awaiting resolution" : "All resolved"}
        accent={claimsAccent ? "destructive" : undefined}
      />
      <KpiCard
        icon={AlertTriangle}
        label="Expiring soon"
        value={state.expiringSoon}
        hint="Active, ending within 30 days"
      />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint?: string;
  accent?: "amber" | "destructive";
}

function KpiCard({ icon: Icon, label, value, hint, accent }: KpiCardProps) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-2 p-4 transition-colors",
        accent === "amber" &&
          "border-amber-400/60 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/5",
        accent === "destructive" &&
          "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon
          className={cn(
            "h-4 w-4",
            accent === "amber" && "text-amber-600",
            accent === "destructive" && "text-destructive",
            !accent && "text-muted-foreground",
          )}
        />
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && (
        <div className="text-xs text-muted-foreground">{hint}</div>
      )}
    </Card>
  );
}
