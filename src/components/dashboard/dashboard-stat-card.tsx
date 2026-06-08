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
  const hasTrend = trendPct !== null;
  const positive = hasTrend && (invertTrend ? trendPct < 0 : trendPct > 0);
  const negative = hasTrend && (invertTrend ? trendPct > 0 : trendPct < 0);
  const TrendIcon = !hasTrend ? Minus : trendPct >= 0 ? TrendingUp : TrendingDown;

  return (
    <Link
      href={href}
      className="group flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-ring hover:bg-accent/30"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      </div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums">
        {current === null ? <Skeleton className="h-8 w-20" /> : current}
      </div>
      {hasTrend ? (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            positive && "text-success-foreground",
            negative && "text-destructive-foreground",
            !positive && !negative && "text-muted-foreground",
          )}
        >
          <TrendIcon className="h-3 w-3" />
          <span>
            {trendPct >= 0 ? "+" : ""}
            {trendPct.toFixed(1)}%
          </span>
          <span className="font-normal text-muted-foreground">{trendLabel}</span>
        </div>
      ) : previous ? (
        <p className="text-xs text-muted-foreground">{previous}</p>
      ) : null}
    </Link>
  );
}
