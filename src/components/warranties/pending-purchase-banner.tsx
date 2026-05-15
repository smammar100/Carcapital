"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { Warranty } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface PendingPurchaseBannerProps {
  warranties: Warranty[];
  onViewPendingOnly?: () => void;
  alreadyFiltered?: boolean;
}

/**
 * Shown above the External warranties table when any rows are still in
 * `purchase_status = 'pending'`. Surfaces the count, total owed to providers,
 * and any that have been pending longer than 60 days.
 */
export function PendingPurchaseBanner({
  warranties,
  onViewPendingOnly,
  alreadyFiltered,
}: PendingPurchaseBannerProps) {
  const summary = useMemo(() => {
    const pending = warranties.filter((w) => w.purchaseStatus === "pending");
    const totalOwed = pending.reduce((sum, w) => sum + (w.costToDealership ?? 0), 0);
    const now = Date.now();
    const overdueCutoff = 60 * 86_400_000;
    const overdue = pending.filter(
      (w) => now - new Date(w.createdAt).getTime() > overdueCutoff,
    ).length;
    return { count: pending.length, totalOwed, overdue };
  }, [warranties]);

  if (summary.count === 0) return null;

  const destructive = summary.overdue > 0;

  return (
    <Alert
      variant={destructive ? "destructive" : "default"}
      className={
        destructive
          ? undefined
          : "border-amber-400/60 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/5 dark:text-amber-100"
      }
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {summary.count} external warrant{summary.count === 1 ? "y" : "ies"} pending purchase
      </AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {formatCurrency(summary.totalOwed)} owed to providers
          {summary.overdue > 0 && (
            <>
              {" · "}
              <strong>{summary.overdue} overdue 60+ days</strong>
            </>
          )}
          .
        </span>
        {onViewPendingOnly && !alreadyFiltered && (
          <Button
            type="button"
            size="sm"
            variant={destructive ? "destructive" : "outline"}
            onClick={onViewPendingOnly}
          >
            View pending only
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
