"use client";

import Link from "next/link";
import {
  type LucideIcon,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  label: string;
  icon: LucideIcon;
  current: string | null;
  previous: string;
  trendPct: number | null;
  trendLabel?: string;
  href: string;
  /** When true, a *down* trend is shown as positive (e.g. fewer returns is good). */
  invertTrend?: boolean;
}

export function DashboardStatCard({
  label,
  icon: Icon,
  current,
  previous,
  trendPct,
  trendLabel = "vs last month",
  href,
  invertTrend = false,
}: Props) {
  const positive =
    trendPct !== null && (invertTrend ? trendPct < 0 : trendPct > 0);
  const negative =
    trendPct !== null && (invertTrend ? trendPct > 0 : trendPct < 0);
  const TrendIcon =
    trendPct === null ? Minus : trendPct >= 0 ? TrendingUp : TrendingDown;

  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:shadow-sm"
    >
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{previous}</p>
      <div className="text-2xl font-semibold tracking-tight">
        {current === null ? <Skeleton className="h-9 w-32" /> : current}
      </div>
      <div
        className={cn(
          "flex items-center gap-1 text-xs",
          positive && "text-emerald-600 dark:text-emerald-400",
          negative && "text-red-600 dark:text-red-400",
          !positive && !negative && "text-muted-foreground",
        )}
      >
        <TrendIcon className="h-3 w-3" />
        <span>
          {trendPct === null
            ? "—"
            : `${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}%`}
        </span>
        <span className="text-muted-foreground">{trendLabel}</span>
      </div>
    </Link>
  );
}
