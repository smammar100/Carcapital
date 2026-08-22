"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { SalesDeal, SalesStage, Vehicle } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { cn, formatCurrency } from "@/lib/utils";
import { vehicleDetailHref } from "@/lib/vehicle-nav";

interface DealRow extends SalesDeal {
  vehicle: Vehicle | null;
  total: number | null;
  /** Realised margin. grossEarning when the books have it, else agreed price
   *  less base cost. Null when neither is known — shown as an em dash, never
   *  as a zero, because "no margin recorded" and "no margin" differ. */
  margin: number | null;
  days: number | null;
  date: string;
}

/** Stage badge colours, lifted from Dashboard Home.dc.html. Deal stage is a
 *  position in a sequence, so the set is wider than the three status hues. */
const STAGE: Record<SalesStage, { label: string; bg: string; fg: string }> = {
  new_lead: { label: "New lead", bg: "#E0F2FE", fg: "#0C4A6E" },
  contacted: { label: "Contacted", bg: "#E0F2FE", fg: "#0C4A6E" },
  test_drive: { label: "Test drive", bg: "#FEF9C3", fg: "#713F12" },
  offer_made: { label: "Offer made", bg: "#FEF9C3", fg: "#713F12" },
  deposit_taken: { label: "Deposit taken", bg: "#F3E8FF", fg: "#581C87" },
  collection_delivery: { label: "Collection", bg: "#F3E8FF", fg: "#581C87" },
  completed_sale: { label: "Completed", bg: "#D1FAE5", fg: "#064E3B" },
  lost: { label: "Lost", bg: "#FEE2E2", fg: "#7F1D1D" },
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function DashboardRecentDeals() {
  const { company } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

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

  const rows = useMemo<DealRow[] | null>(() => {
    if (!deals) return null;
    return [...deals]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map((d) => {
        const dt =
          d.completionDate ?? d.depositDate ?? d.collectionDate ?? d.updatedAt;
        const vehicle = vehicles.find((v) => v.id === d.vehicleId) ?? null;
        const total = d.agreedPrice ?? d.offerPrice;
        const margin =
          vehicle?.grossEarning ??
          (total !== null && vehicle ? total - vehicle.baseCost : null);
        return {
          ...d,
          vehicle,
          total,
          margin,
          days: vehicle?.daysInStock ?? null,
          date: dt.slice(0, 10),
        };
      });
  }, [deals, vehicles]);

  // Rule 3: the card's own header carries the comparison for the rows below.
  //
  // The design reads "6 this week", but the query is the six most recently
  // updated deals with no date window on it — so that label would be a claim
  // the data does not make. It says what is actually on screen instead.
  const shownTotal = (rows ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">
            Recent deals
          </h2>
          <span className="text-[12px] text-muted-text">
            {rows === null
              ? "—"
              : `${rows.length} most recent · ${formatCurrency(shownTotal)} agreed`}
          </span>
        </div>
        <Link
          className="text-[12px] text-accent-navy no-underline hover:underline"
          href="/sales/deals"
        >
          View all deals
        </Link>
      </div>

      {rows === null ? (
        <div className="p-4">
          <Skeleton className="h-64" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-6 py-10 text-center text-[13px] leading-[1.55] text-body-text">
          No deals have moved this week. A deal appears here as soon as a lead
          is contacted, a test drive is booked, or a deposit is taken.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              {/* One bottom border on the header; the rows below carry none —
                  they are separated by the alternating tone instead. */}
              <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-[0.05em] text-muted-text">
                <th className="py-2 pr-3 pl-4 font-medium">Vehicle</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 text-right font-medium">Days</th>
                <th className="px-3 py-2 text-right font-medium">Margin</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="py-2 pr-4 pl-3 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const stage = STAGE[r.stage];
                return (
                  <tr
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-line-soft",
                      i % 2 === 1 && "bg-surface",
                    )}
                    key={r.id}
                    onClick={() =>
                      r.vehicle &&
                      router.push(vehicleDetailHref(r.vehicle.id, pathname))
                    }
                  >
                    <td className="py-2 pr-3 pl-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {r.vehicle ? (
                          <VehicleImage
                            className="h-[33px] w-[44px] shrink-0 rounded-sm"
                            variant="thumb"
                            vehicle={r.vehicle}
                          />
                        ) : (
                          <span className="h-[33px] w-[44px] shrink-0 rounded-sm bg-page" />
                        )}
                        <div className="min-w-0 leading-[1.3]">
                          <div className="font-mono text-[12px] font-semibold">
                            {r.vehicle?.registration ?? "—"}
                          </div>
                          <div className="truncate text-[12px] text-muted-text">
                            {r.vehicle
                              ? `${r.vehicle.stockId} · ${r.vehicle.make} ${r.vehicle.model}`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{r.customerName}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex h-[18px] items-center whitespace-nowrap rounded-sm px-1.5 text-[12px] font-medium"
                        style={{ background: stage.bg, color: stage.fg }}
                      >
                        {stage.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-body-text tabular-nums">
                      {r.days === null ? "—" : `${r.days}d`}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.margin === null ? "—" : formatCurrency(r.margin)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {formatCurrency(r.total)}
                    </td>
                    {/* nowrap: the column is narrow enough that "09 Jul"
                        otherwise breaks onto two lines on every row (GEN-44) */}
                    <td className="whitespace-nowrap py-2.5 pr-4 pl-3 text-right text-muted-text tabular-nums">
                      {fmtDate(r.date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
