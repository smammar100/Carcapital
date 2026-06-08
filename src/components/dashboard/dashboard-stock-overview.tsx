"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle, VehicleStatus } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Active stock broken into four pipeline buckets for the donut. */
const BUCKETS: { label: string; color: string; statuses: VehicleStatus[] }[] = [
  {
    label: "Ready to sell",
    color: "var(--n-color-status-success)",
    statuses: ["ready", "listed", "reserved"],
  },
  {
    label: "In preparation",
    color: "var(--n-color-status-warning)",
    statuses: ["being_prepared"],
  },
  {
    label: "Awaiting inspection",
    color: "var(--n-color-status-info)",
    statuses: ["received", "inspection_pending"],
  },
  {
    label: "Photography",
    color: "var(--n-color-accent)",
    statuses: ["photos_pending", "photos_ready"],
  },
];

export function DashboardStockOverview() {
  const { company } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);

  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then(setVehicles);
  }, [company]);

  const { segments, total } = useMemo(() => {
    const active = (vehicles ?? []).filter(
      (v) =>
        v.status !== "sold" &&
        v.status !== "returned" &&
        v.removedFromWebsiteAt === null,
    );
    const segments = BUCKETS.map((b) => ({
      ...b,
      value: active.filter((v) => b.statuses.includes(v.status)).length,
    }));
    return { segments, total: active.length };
  }, [vehicles]);

  const r = 42;
  const c = 2 * Math.PI * r;
  const loading = vehicles === null;

  return (
    <Card className="h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Stock overview</h2>
        <Link
          href="/vehicles"
          className="text-xs text-link underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center gap-6 p-6">
          <Skeleton className="aspect-square h-[200px] shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <div className="relative flex aspect-square h-full max-h-[230px] min-h-[150px] shrink-0 items-center justify-center self-center">
            <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
              <circle
                cx="55"
                cy="55"
                r={r}
                fill="none"
                stroke="var(--n-color-border)"
                strokeWidth="11"
              />
              {segments.map((s, i) => {
                const len = total ? (s.value / total) * c : 0;
                const start = segments
                  .slice(0, i)
                  .reduce(
                    (acc, x) => acc + (total ? (x.value / total) * c : 0),
                    0,
                  );
                return (
                  <circle
                    key={s.label}
                    cx="55"
                    cy="55"
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="11"
                    strokeDasharray={`${len} ${c - len}`}
                    strokeDashoffset={-start}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums">{total}</span>
              <span className="text-xs text-muted-foreground">in stock</span>
            </div>
          </div>
          <ul className="flex flex-1 flex-col gap-3">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="flex-1 text-muted-foreground">{s.label}</span>
                <span className="font-medium tabular-nums">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
