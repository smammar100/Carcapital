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
        tone="blue"
        label="Active warranties"
        value={totalActive}
        hint={`${state.activeInHouse} in-house · ${state.activeExternal} external`}
      />
      <KpiCard
        icon={Clock}
        tone="amber"
        label="Pending purchase"
        value={state.pendingPurchase}
        hint={pendingAccent ? "Action needed" : "All up to date"}
      />
      <KpiCard
        icon={ShieldAlert}
        tone="red"
        label="Open claims"
        value={state.openClaims}
        hint={claimsAccent ? "Awaiting resolution" : "All resolved"}
      />
      <KpiCard
        icon={AlertTriangle}
        tone="orange"
        label="Expiring soon"
        value={state.expiringSoon}
        hint="Active, ending within 30 days"
      />
    </div>
  );
}

type KpiTone = "blue" | "amber" | "red" | "orange";

// Each card owns a distinct accent colour so the four read as four separate
// signals at a glance (a left rail bar + matching icon) — never two-the-same.
const TONES: Record<KpiTone, { bar: string; icon: string }> = {
  blue: { bar: "bg-blue-500", icon: "text-blue-600 dark:text-blue-400" },
  amber: { bar: "bg-amber-500", icon: "text-amber-600 dark:text-amber-400" },
  red: { bar: "bg-red-500", icon: "text-red-600 dark:text-red-400" },
  orange: { bar: "bg-orange-500", icon: "text-orange-600 dark:text-orange-400" },
};

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  tone: KpiTone;
  label: string;
  value: number;
  hint?: string;
}

function KpiCard({ icon: Icon, tone, label, value, hint }: KpiCardProps) {
  const t = TONES[tone];
  return (
    <Card className="relative flex flex-col gap-1.5 overflow-hidden p-4 pl-5 transition-colors">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1.5", t.bar)}
      />
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", t.icon)} />
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
