"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { Warranty } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface PendingPurchaseBannerProps {
  warranties: Warranty[];
}

// Plain helper (not a hook) so the time read stays out of render — mirrors the
// date helpers in warranty-table.tsx.
function summarisePending(warranties: Warranty[]): {
  count: number;
  totalOwed: number;
  overdue: number;
} {
  const pending = warranties.filter((w) => w.purchaseStatus === "pending");
  const totalOwed = pending.reduce((sum, w) => sum + (w.costToDealership ?? 0), 0);
  const now = Date.now();
  const overdueCutoff = 60 * 86_400_000;
  const overdue = pending.filter(
    (w) => now - new Date(w.createdAt).getTime() > overdueCutoff,
  ).length;
  return { count: pending.length, totalOwed, overdue };
}

/**
 * Shown above the External warranties table when any rows are still in
 * `purchase_status = 'pending'`. A soft-red, segmented info ribbon that
 * surfaces the count, total owed to providers, and any pending longer than
 * 60 days. Purely informational — the filter chips below cover navigation.
 */
export function PendingPurchaseBanner({
  warranties,
}: PendingPurchaseBannerProps) {
  const summary = useMemo(() => summarisePending(warranties), [warranties]);

  if (summary.count === 0) return null;

  const divider = (
    <span aria-hidden className="h-4 w-px bg-red-200 dark:bg-red-500/30" />
  );

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      <span className="inline-flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        Pending purchase
      </span>
      {divider}
      <span>
        <strong className="font-semibold">{summary.count}</strong> warrant
        {summary.count === 1 ? "y" : "ies"}
      </span>
      {divider}
      <span>
        <strong className="font-semibold">
          {formatCurrency(summary.totalOwed)}
        </strong>{" "}
        owed to providers
      </span>
      {summary.overdue > 0 && (
        <>
          {divider}
          <span>
            <strong className="font-semibold">{summary.overdue}</strong> overdue
            60+ days
          </span>
        </>
      )}
    </div>
  );
}
