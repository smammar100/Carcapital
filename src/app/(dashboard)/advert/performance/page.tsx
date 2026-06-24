"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BadgePoundSterling,
  Gauge,
  Megaphone,
  MessageSquare,
  Trophy,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { listingService } from "@/lib/services/listing-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import {
  performanceService,
  type PerformanceStats,
} from "@/lib/services/performance-service";
import type { Listing, ListingChannel, Vehicle } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { AtIndicatorCell } from "@/components/data-grid";
import { cn, formatCurrency } from "@/lib/utils";

const STALE_DAYS = 75; // days in stock past which a live advert needs attention

const CHANNELS: {
  key: ListingChannel;
  label: string;
  bar: string;
  dot: string;
}[] = [
  { key: "website", label: "Website", bar: "bg-sky-500", dot: "bg-sky-500" },
  { key: "autotrader", label: "AutoTrader", bar: "bg-violet-500", dot: "bg-violet-500" },
  { key: "ebay", label: "eBay", bar: "bg-amber-500", dot: "bg-amber-500" },
  { key: "facebook", label: "Facebook", bar: "bg-blue-600", dot: "bg-blue-600" },
];

interface LiveRow extends Listing {
  vehicle: Vehicle | null;
  enq: number; // total enquiries for this advert's vehicle (from leads)
}

/* --------------------------------------------------------------- primitives */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {sub ? <span className="text-2xs text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Dependency-free area chart for the leads-over-time trend. */
function AreaChart({ data, h = 180 }: { data: number[]; h?: number }) {
  const w = 600;
  const max = Math.max(...data, 1);
  const pad = 6;
  const pt = (v: number, i: number): [number, number] => [
    (i / Math.max(data.length - 1, 1)) * w,
    h - pad - (v / max) * (h - pad * 2),
  ];
  const line = data.map((v, i) => pt(v, i).join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full text-primary"
      style={{ height: h }}
    >
      <defs>
        <linearGradient id="perfArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#perfArea)" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------- page */

export default function PerformancePage() {
  const { company } = useAuth();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      listingService.getAll(company.id),
      vehicleService.getAll(company.id),
      performanceService.getStats(company.id),
    ]).then(([l, v, s]) => {
      setListings(l);
      setVehicles(v);
      setStats(s);
    });
  }, [company]);

  // Live adverts, each annotated with its vehicle + live enquiry count (leads).
  const live = useMemo<LiveRow[] | null>(() => {
    if (!listings || !stats) return null;
    return listings
      .filter((l) => l.status === "live")
      .map((l) => ({
        ...l,
        vehicle: vehicles.find((v) => v.id === l.vehicleId) ?? null,
        enq: l.vehicleId ? (stats.byVehicle[l.vehicleId]?.total ?? 0) : 0,
      }));
  }, [listings, vehicles, stats]);

  const kpis = useMemo(() => {
    if (!live) return null;
    const totalEnq = live.reduce((s, l) => s + l.enq, 0);
    const stockValue = live.reduce((s, l) => s + l.price, 0);
    return {
      totalEnq,
      liveCount: live.length,
      perListing: live.length ? (totalEnq / live.length).toFixed(1) : "0",
      stockValue,
    };
  }, [live]);

  // Per-channel: real marketplace attribution (lead.source) over live adverts.
  const channelStats = useMemo(() => {
    if (!live || !stats) return null;
    return CHANNELS.map((c) => {
      const enquiries = live.reduce(
        (s, l) =>
          s + (l.vehicleId ? (stats.byVehicle[l.vehicleId]?.byChannel[c.key] ?? 0) : 0),
        0,
      );
      const onChannel = live.filter((l) => l.channels[c.key]);
      const top = [...live]
        .filter((l) => l.vehicle)
        .sort(
          (a, b) =>
            (stats.byVehicle[b.vehicleId ?? ""]?.byChannel[c.key] ?? 0) -
            (stats.byVehicle[a.vehicleId ?? ""]?.byChannel[c.key] ?? 0),
        )[0];
      const topEnq = top?.vehicleId
        ? (stats.byVehicle[top.vehicleId]?.byChannel[c.key] ?? 0)
        : 0;
      return { ...c, enquiries, liveCount: onChannel.length, top, topEnq };
    });
  }, [live, stats]);
  const maxChannelEnq = useMemo(
    () => Math.max(1, ...(channelStats?.map((c) => c.enquiries) ?? [1])),
    [channelStats],
  );

  const topAdverts = useMemo(
    () => (live ? [...live].sort((a, b) => b.enq - a.enq).slice(0, 5) : []),
    [live],
  );
  const needsAttention = useMemo(
    () =>
      live
        ? live.filter((l) => l.enq === 0 || (l.vehicle?.daysInStock ?? 0) > STALE_DAYS)
        : [],
    [live],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="text-sm text-muted-foreground">
          How your adverts are doing across every marketplace channel —
          enquiries, channel reach and the listings that need attention.
        </p>
      </div>

      {!live || !kpis || !channelStats || !stats ? (
        <Skeleton className="h-96" />
      ) : live.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No live listings yet"
          description="Publish a vehicle from the Work List to start tracking performance."
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={MessageSquare} label="Total enquiries" value={String(kpis.totalEnq)} sub="across live adverts" />
            <StatCard icon={Megaphone} label="Live listings" value={String(kpis.liveCount)} sub="currently advertised" />
            <StatCard icon={Gauge} label="Enquiries / listing" value={kpis.perListing} sub="average" />
            <StatCard icon={BadgePoundSterling} label="Live stock value" value={formatCurrency(kpis.stockValue)} sub="total advertised price" />
          </div>

          {/* Trend hero — real leads-per-day */}
          <Panel
            title="Enquiries over time"
            action={
              <span className="text-2xs text-muted-foreground">
                last {stats.trendDays} days · {stats.leadsTotal} lead{stats.leadsTotal === 1 ? "" : "s"}
              </span>
            }
          >
            {stats.leadsTotal === 0 ? (
              <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                No leads recorded in the last {stats.trendDays} days.
              </div>
            ) : (
              <AreaChart data={stats.trend} />
            )}
          </Panel>

          {/* Channel scorecards — real per-marketplace attribution */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {channelStats.map((c) => (
              <div key={c.key} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn("size-2.5 rounded-full", c.dot)} />
                  {c.label}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-semibold tabular-nums">{c.enquiries}</div>
                    <div className="text-2xs text-muted-foreground">enquiries</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums">{c.liveCount}</div>
                    <div className="text-2xs text-muted-foreground">live</div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-2xs text-muted-foreground">
                    <span>Share of enquiries</span>
                    <span>{Math.round((c.enquiries / maxChannelEnq) * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", c.bar)}
                      style={{ width: `${(c.enquiries / maxChannelEnq) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 border-t pt-2 text-2xs text-muted-foreground">
                  <Trophy className="size-3.5 shrink-0 text-amber-500" />
                  {c.top && c.top.vehicle && c.topEnq > 0 ? (
                    <>
                      Top:&nbsp;
                      <RegPlate registration={c.top.vehicle.registration} size="sm" />
                      <span className="shrink-0">· {c.topEnq} enq</span>
                    </>
                  ) : (
                    <span>No enquiries on this channel yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Leaderboards */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Top performing adverts" action={<Trophy className="size-4 text-amber-500" />}>
              <div className="flex flex-col">
                {topAdverts.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-3 border-b py-2 last:border-0">
                    <span className="w-4 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    {l.vehicle ? (
                      <RegPlate registration={l.vehicle.registration} size="sm" />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {l.title}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
                      <MessageSquare className="size-3 text-muted-foreground" />
                      {l.enq}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Needs attention" action={<TriangleAlert className="size-4 text-rose-500" />}>
              {needsAttention.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Every live advert is fresh and getting enquiries. 🎉
                </div>
              ) : (
                <div className="flex flex-col">
                  {needsAttention.map((l) => {
                    const days = l.vehicle?.daysInStock ?? 0;
                    const noEnq = l.enq === 0;
                    return (
                      <div key={l.id} className="flex items-center gap-3 border-b py-2 last:border-0">
                        {l.vehicle ? (
                          <RegPlate registration={l.vehicle.registration} size="sm" />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {l.title}
                        </span>
                        <span className="shrink-0">
                          <AtIndicatorCell indicator={l.atPriceIndicator} />
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium",
                            noEnq
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
                          )}
                        >
                          {noEnq ? "No enquiries" : `${days}d stale`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
