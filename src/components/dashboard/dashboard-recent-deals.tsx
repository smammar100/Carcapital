"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Filter, Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { SalesDeal, SalesStage, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

const STAGE_TONE: Partial<Record<SalesStage, string>> = {
  new_lead: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  contacted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  test_drive: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  offer_made: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  deposit_taken: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  collection_delivery: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed_sale: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  lost: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const STAGE_LABEL: Record<SalesStage, string> = {
  new_lead: "New Lead",
  contacted: "Contacted",
  test_drive: "Test Drive",
  offer_made: "Offer Made",
  deposit_taken: "Deposit Taken",
  collection_delivery: "Collection",
  completed_sale: "Completed",
  lost: "Lost",
};

export function DashboardRecentDeals() {
  const { company } = useAuth();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      salesService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([d, v]) => {
      setDeals(d);
      setVehicles(v);
    });
  }, [company]);

  const rows = useMemo(() => {
    if (!deals) return null;
    const byMostRecent = [...deals].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const filtered = query.trim()
      ? byMostRecent.filter((d) => {
          const v = vehicles.find((x) => x.id === d.vehicleId);
          const hay =
            `${d.customerName} ${v?.registration ?? ""} ${v?.make ?? ""} ${v?.model ?? ""}`.toLowerCase();
          return hay.includes(query.trim().toLowerCase());
        })
      : byMostRecent;
    return filtered.slice(0, 20);
  }, [deals, vehicles, query]);

  return (
    <Card className="flex flex-col gap-4 p-5" size="sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Recent Deals</h2>
          <Badge variant="secondary" className="text-[10px]">
            {rows?.length ?? "—"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reg or customer…"
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-10 py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">Vehicle</th>
              <th className="py-2 pr-2 font-medium">Customer</th>
              <th className="py-2 pr-2 font-medium">Stage</th>
              <th className="py-2 pr-2 text-right font-medium">Total</th>
              <th className="py-2 pr-2 text-right font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td colSpan={6} className="py-2">
                    <Skeleton className="h-7 w-full" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  No deals match.
                </td>
              </tr>
            ) : (
              rows.map((d, idx) => {
                const v = vehicles.find((x) => x.id === d.vehicleId);
                const total = d.agreedPrice ?? d.offerPrice;
                const dt =
                  d.completionDate ??
                  d.depositDate ??
                  d.collectionDate ??
                  d.updatedAt;
                return (
                  <tr
                    key={d.id}
                    className="border-b text-sm last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="py-2.5 pr-2 text-xs text-muted-foreground tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 pr-2">
                      {v ? (
                        <Link
                          href={`/vehicles/${v.id}`}
                          className="flex flex-col leading-tight hover:underline"
                        >
                          <span className="font-mono text-xs font-semibold uppercase">
                            {v.registration}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {v.make} {v.model}
                          </span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-2 text-sm">{d.customerName}</td>
                    <td className="py-2.5 pr-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_TONE[d.stage] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {STAGE_LABEL[d.stage]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-right font-medium tabular-nums">
                      {formatCurrency(total)}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-xs text-muted-foreground tabular-nums">
                      {formatDate(dt.slice(0, 10))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
