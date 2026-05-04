"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { leadService } from "@/lib/services/lead-service";
import type { Lead, LeadSource } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChannelRow {
  source: LeadSource;
  label: string;
  letter: string;
  count: number;
  trendPct: number | null;
}

const SOURCE_LABEL: Record<LeadSource, string> = {
  website: "Website",
  autotrader: "AutoTrader",
  walk_in: "Walk-in",
  phone: "Phone",
  ebay: "eBay",
  facebook: "Facebook",
  referral: "Referral",
  other: "Other",
};

const GROUPS: { key: string; label: string; sources: LeadSource[] }[] = [
  {
    key: "online",
    label: "Online",
    sources: ["website", "autotrader", "ebay", "facebook"],
  },
  { key: "in_store", label: "In-Store", sources: ["walk_in"] },
  { key: "marketplace", label: "Direct", sources: ["phone", "referral", "other"] },
];

function inMonth(iso: string, year: number, month: number): boolean {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function DashboardLeadSources() {
  const { company } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    if (!company) return;
    void leadService.getAll(company.id).then(setLeads);
  }, [company]);

  const { rows, total, groupSegments } = useMemo(() => {
    if (!leads)
      return {
        rows: null as ChannelRow[] | null,
        total: 0,
        groupSegments: [] as { label: string; pct: number; count: number }[],
      };

    const now = new Date();
    const thisMonth = { y: now.getFullYear(), m: now.getMonth() };
    const prev = new Date(thisMonth.y, thisMonth.m - 1, 1);
    const prevMonth = { y: prev.getFullYear(), m: prev.getMonth() };

    const counts = new Map<LeadSource, { thisM: number; prevM: number }>();
    for (const l of leads) {
      const c =
        counts.get(l.source) ?? { thisM: 0, prevM: 0 };
      if (inMonth(l.createdAt, thisMonth.y, thisMonth.m)) c.thisM += 1;
      if (inMonth(l.createdAt, prevMonth.y, prevMonth.m)) c.prevM += 1;
      counts.set(l.source, c);
    }

    const list: ChannelRow[] = [];
    for (const [source, c] of counts.entries()) {
      const total = c.thisM;
      const trendPct =
        c.prevM === 0
          ? c.thisM === 0
            ? null
            : 100
          : ((c.thisM - c.prevM) / c.prevM) * 100;
      list.push({
        source,
        label: SOURCE_LABEL[source],
        letter: SOURCE_LABEL[source].charAt(0),
        count: total,
        trendPct,
      });
    }

    list.sort((a, b) => b.count - a.count);
    const top = list.slice(0, 4);
    const totalThis = list.reduce((s, r) => s + r.count, 0);

    const groupSegments = GROUPS.map((g) => {
      const count = g.sources.reduce(
        (sum, s) => sum + (counts.get(s)?.thisM ?? 0),
        0,
      );
      return {
        label: g.label,
        count,
        pct: totalThis === 0 ? 0 : (count / totalThis) * 100,
      };
    });

    return { rows: top, total: totalThis, groupSegments };
  }, [leads]);

  return (
    <Card className="flex flex-col gap-4 p-5" size="sm">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>Lead Sources</span>
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold tracking-tight">
          {rows === null ? <Skeleton className="h-9 w-16" /> : total}
        </div>
        <p className="text-xs text-muted-foreground">total leads this month</p>
      </div>

      {rows === null ? (
        <Skeleton className="h-3 w-full" />
      ) : (
        <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full bg-muted">
          {groupSegments.map((g, i) => (
            <div
              key={g.label}
              style={{ width: `${g.pct}%` }}
              className={cn(
                "h-full",
                i === 0 && "bg-foreground",
                i === 1 && "bg-foreground/60",
                i === 2 && "bg-foreground/30",
              )}
            />
          ))}
        </div>
      )}

      {rows !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {groupSegments.map((g, i) => (
            <span key={g.label} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  i === 0 && "bg-foreground",
                  i === 1 && "bg-foreground/60",
                  i === 2 && "bg-foreground/30",
                )}
              />
              {g.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b pb-1.5 text-xs text-muted-foreground">
          <span>Channels</span>
          <div className="flex gap-6">
            <span>Number</span>
            <span>Total</span>
          </div>
        </div>

        {rows === null ? (
          <div className="flex flex-col gap-2 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No leads this month
          </p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => {
              const TrendIcon =
                r.trendPct === null
                  ? Minus
                  : r.trendPct >= 0
                    ? TrendingUp
                    : TrendingDown;
              const positive = r.trendPct !== null && r.trendPct > 0;
              const negative = r.trendPct !== null && r.trendPct < 0;
              return (
                <li
                  key={r.source}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[11px] font-medium text-muted-foreground">
                      {r.letter}
                    </span>
                    <span className="font-medium">{r.label}</span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="tabular-nums">{r.count}</span>
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-xs tabular-nums",
                        positive && "text-emerald-600 dark:text-emerald-400",
                        negative && "text-red-600 dark:text-red-400",
                        !positive && !negative && "text-muted-foreground",
                      )}
                    >
                      <TrendIcon className="h-3 w-3" />
                      {r.trendPct === null
                        ? "—"
                        : `${r.trendPct >= 0 ? "+" : ""}${r.trendPct.toFixed(1)}%`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
