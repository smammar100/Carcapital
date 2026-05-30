"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Coins,
  Globe,
  Pencil,
  PoundSterling,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Listing, Vehicle } from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import { dvlaService } from "@/lib/services/dvla-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { KpiCard, Panel, Pill } from "./primitives";
import { cn } from "@/lib/utils";
import { VehicleLocationSection } from "@/components/locations/vehicle-location-section";

interface OverviewTabProps {
  vehicle: Vehicle;
  /** Merge fresh fields into the page's Vehicle state (e.g. after a
   *  live AutoTrader valuation refresh). */
  onVehiclePatch?: (patch: Partial<Vehicle>) => void;
}

/**
 * Overview tab — the dealership's "at-a-glance everything I need" surface.
 * Four KPIs up top, advert completeness on the left, valuation + marketplace
 * on the right, then a full field grid of vehicle details underneath.
 */
export function OverviewTab({ vehicle, onVehiclePatch }: OverviewTabProps) {
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);

  useEffect(() => {
    void listingService.getForVehicle(vehicle.id).then(setListing);
  }, [vehicle.id]);

  const webPrice = listing?.price ?? vehicle.listingPrice ?? 0;
  const floor = vehicle.minimumSalePrice ?? 0;
  const stockingBurn = vehicle.dailyChargeRate ?? 0;
  const grossProfit =
    webPrice && vehicle.totalBuyingPrice
      ? Math.max(0, webPrice - vehicle.totalBuyingPrice)
      : 0;
  const marginVat = grossProfit > 0 ? grossProfit * (0.2 / 1.2) : 0;
  const netProfit = grossProfit - marginVat;

  const daysAccent =
    vehicle.daysInStock >= 90
      ? "destructive"
      : vehicle.daysInStock >= 60
        ? "amber"
        : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={PoundSterling}
          label="Web Price"
          value={webPrice ? formatCurrency(webPrice) : "—"}
          hint={floor ? `Floor: ${formatCurrency(floor)}` : undefined}
        />
        <KpiCard
          icon={Clock}
          label="Days in Stock"
          value={vehicle.daysInStock}
          hint={
            stockingBurn
              ? `Stocking burn: ${formatCurrency(stockingBurn)} / day`
              : undefined
          }
          accent={daysAccent}
        />
        <KpiCard
          icon={TrendingUp}
          label="AT Retail Avg"
          value={
            vehicle.atRetailValuation != null
              ? formatCurrency(vehicle.atRetailValuation)
              : "—"
          }
          hint={atRetailHint(webPrice, vehicle.atRetailValuation)}
        />
        <KpiCard
          icon={Coins}
          label="Net Profit (live)"
          value={netProfit > 0 ? formatCurrency(Math.round(netProfit)) : "—"}
          hint="Under HMRC margin scheme"
        />
      </div>

      {/* Two-col: Advert Completeness + Valuation/Marketplace stack */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <AdvertCompletenessPanel
          vehicle={vehicle}
          listing={listing ?? null}
          photoCount={vehicle.imagesCount}
        />
        <div className="flex flex-col gap-4">
          {/* AutoTrader Valuation leads the right column (more frequent
              glance value than the Location card per user feedback);
              Module A's LocationCard sits beneath it and the
              MarketplacePanel anchors the bottom. */}
          <ValuationPanel
            vehicle={vehicle}
            onVehiclePatch={onVehiclePatch}
          />
          <VehicleLocationSection vehicle={vehicle} />
          <MarketplacePanel listing={listing ?? null} />
        </div>
      </div>

    </div>
  );
}

// ============================================================
// Advert Completeness — checklist driven from Listing + Vehicle
// ============================================================

interface AdvertCheck {
  name: string;
  meta: string;
  state: "done" | "warn" | "miss";
}

function AdvertCompletenessPanel({
  vehicle,
  listing,
  photoCount,
}: {
  vehicle: Vehicle;
  listing: Listing | null;
  photoCount: number;
}) {
  const checks: AdvertCheck[] = [
    {
      name: "Make / Model / Derivative",
      meta: `${vehicle.make} ${vehicle.model} · ${vehicle.variantCode ?? "no derivative"}`,
      state: vehicle.variantCode ? "done" : "warn",
    },
    {
      name: "Photos",
      meta:
        photoCount > 0
          ? `${photoCount} image${photoCount === 1 ? "" : "s"}`
          : "No photos uploaded",
      state: photoCount >= 8 ? "done" : photoCount > 0 ? "warn" : "miss",
    },
    {
      name: "Vehicle Description",
      meta:
        listing?.description && listing.description.trim().length > 30
          ? `${listing.description.length.toLocaleString()} chars`
          : "Empty — generate with AI",
      state:
        listing?.description && listing.description.trim().length > 30
          ? "done"
          : "warn",
    },
    {
      name: "Pricing & Floor",
      meta:
        listing?.price && vehicle.minimumSalePrice
          ? `${formatCurrency(listing.price)} · Floor ${formatCurrency(vehicle.minimumSalePrice)}`
          : listing?.price
            ? formatCurrency(listing.price)
            : "Price not set",
      state: listing?.price ? "done" : "miss",
    },
    {
      name: "MOT Status",
      meta: vehicle.motExpiry
        ? `Valid until ${formatDate(vehicle.motExpiry)}`
        : "No expiry on file",
      state: vehicle.motExpiry ? "done" : "warn",
    },
    {
      name: "Service History",
      meta: vehicle.serviceHistory.replace(/_/g, " "),
      state: vehicle.serviceHistory !== "none" ? "done" : "warn",
    },
    {
      name: "Channels",
      meta: listing
        ? Object.entries(listing.channels)
            .filter(([, on]) => on)
            .map(([k]) => k)
            .join(", ") || "None enabled"
        : "Listing not created",
      state: listing
        ? Object.values(listing.channels).some(Boolean)
          ? "done"
          : "warn"
        : "miss",
    },
  ];

  const setCount = checks.filter((c) => c.state === "done").length;

  return (
    <Panel
      title="Advert Completeness"
      subtitle={`${setCount} of ${checks.length} fields set · ${checks.length - setCount} to address`}
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/advert/work-list">Open Advert →</Link>
        </Button>
      }
      flush
    >
      <div className="divide-y">
        {checks.map((c, i) => (
          <AdvertCheckRow key={i} check={c} />
        ))}
      </div>
    </Panel>
  );
}

const STATE_MARK_STYLES: Record<AdvertCheck["state"], string> = {
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  miss: "bg-muted text-muted-foreground",
};

const STATE_PILL_TONE: Record<AdvertCheck["state"], React.ComponentProps<typeof Pill>["tone"]> = {
  done: "good",
  warn: "warn",
  miss: "bad",
};

const STATE_PILL_LABEL: Record<AdvertCheck["state"], string> = {
  done: "Set",
  warn: "Needs work",
  miss: "Missing",
};

function AdvertCheckRow({ check }: { check: AdvertCheck }) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-3 px-6 py-3">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full",
          STATE_MARK_STYLES[check.state],
        )}
      >
        {check.state === "done" ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : check.state === "warn" ? (
          <AlertCircle className="h-3 w-3" />
        ) : (
          <X className="h-3 w-3" strokeWidth={3} />
        )}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium leading-snug">{check.name}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {check.meta}
        </div>
      </div>
      <Pill tone={STATE_PILL_TONE[check.state]}>
        {STATE_PILL_LABEL[check.state]}
      </Pill>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
        <Pencil className="mr-1 h-3 w-3" />
        Edit
      </Button>
    </div>
  );
}

// ============================================================
// Valuation panel
// ============================================================

/** Hint under the AT Retail Avg KPI: how our web price sits vs market. */
function atRetailHint(
  webPrice: number,
  retail: number | null | undefined,
): string | undefined {
  if (retail == null) return undefined;
  if (!webPrice) return "Live market retail";
  const ratio = webPrice / retail;
  if (ratio <= 0.97) return "Priced below market";
  if (ratio <= 1.03) return "Within market range";
  return "Above market";
}

/** Relative "Updated …" label from an ISO timestamp. */
function updatedLabel(iso: string | null | undefined): string {
  if (!iso) return "Not yet valued";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  return `Updated ${formatDate(iso)}`;
}

function ValuationPanel({
  vehicle,
  onVehiclePatch,
}: {
  vehicle: Vehicle;
  onVehiclePatch?: (patch: Partial<Vehicle>) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const hasValuation = vehicle.atRetailValuation != null;

  /**
   * Pull a live AutoTrader valuation for this vehicle and persist it.
   * Client-orchestrated: /api/vehicle/lookup returns valuations server-side
   * (creds stay there), then we persist via the RLS-scoped vehicle service
   * — no admin/service-role key needed.
   */
  async function refresh() {
    setRefreshing(true);
    try {
      const data = await dvlaService.lookup(vehicle.registration, {
        mileage: vehicle.mileage,
        force: true,
      });
      if (!data || data.retailValuation == null) {
        toast.error(
          "AutoTrader returned no valuation for this registration.",
        );
        return;
      }
      const ratio =
        vehicle.listingPrice && data.retailValuation
          ? vehicle.listingPrice / data.retailValuation
          : null;
      const atPriceIndicator =
        ratio == null
          ? null
          : ratio <= 0.96
            ? "great"
            : ratio <= 1.0
              ? "good"
              : ratio <= 1.05
                ? "fair"
                : "high";
      const patch: Partial<Vehicle> = {
        atRetailValuation: data.retailValuation ?? null,
        atTradeValuation: data.tradeValuation ?? null,
        atPartExchangeValuation: data.partExchangeValuation ?? null,
        atValuationAt: new Date().toISOString(),
        atPriceIndicator,
        derivative: data.derivative ?? null,
        generation: data.generation ?? null,
        trim: data.trim ?? null,
        atDerivativeId: data.atDerivativeId ?? null,
      };
      await vehicleService.updateValuation(vehicle.id, patch);
      onVehiclePatch?.(patch);
      toast.success(
        `AutoTrader valuation updated — retail ${formatCurrency(data.retailValuation)}`,
      );
    } catch (e) {
      toast.error(`Valuation refresh failed: ${String(e)}`);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Panel
      title="AutoTrader Valuation"
      subtitle={
        hasValuation
          ? `${updatedLabel(vehicle.atValuationAt)} · live feed`
          : "Not yet valued — refresh to pull live"
      }
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <RefreshCw
            className={cn("mr-1 size-3.5", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      }
      flush
    >
      <div className="grid grid-cols-3 divide-x">
        <ValuationCell label="Trade" value={vehicle.atTradeValuation ?? 0} />
        <ValuationCell
          label="Part Ex"
          value={vehicle.atPartExchangeValuation ?? 0}
        />
        <ValuationCell
          label="Retail"
          value={vehicle.atRetailValuation ?? 0}
          highlight
        />
      </div>
    </Panel>
  );
}

function ValuationCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="px-5 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          highlight && "text-foreground",
        )}
      >
        {value ? formatCurrency(value) : "—"}
      </div>
    </div>
  );
}

// ============================================================
// Marketplace panel
// ============================================================

function MarketplacePanel({ listing }: { listing: Listing | null }) {
  type ChannelKey = "carcapital" | "autotrader" | "ebay" | "facebook";
  const rows: { key: ChannelKey; name: string; meta: string; iconBg: string; iconText: string }[] = [
    {
      key: "carcapital",
      name: "Car Capital UK",
      meta: "thecarcapital.co.uk",
      iconBg: "bg-foreground text-background",
      iconText: "CC",
    },
    {
      key: "autotrader",
      name: "AutoTrader",
      meta: listing ? "Synced" : "Not configured",
      iconBg: "bg-blue-700 text-white",
      iconText: "AT",
    },
    {
      key: "ebay",
      name: "eBay Motors",
      meta: "Not configured",
      iconBg: "bg-rose-600 text-white",
      iconText: "eB",
    },
    {
      key: "facebook",
      name: "Facebook",
      meta: "Not configured",
      iconBg: "bg-blue-600 text-white",
      iconText: "fb",
    },
  ];

  const isOn = (key: ChannelKey) => {
    if (!listing) return false;
    return key === "carcapital"
      ? listing.channels.website
      : key === "autotrader"
        ? listing.channels.autotrader
        : key === "ebay"
          ? listing.channels.ebay
          : listing.channels.facebook;
  };

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Marketplace
        </span>
      }
      flush
    >
      <div className="divide-y">
        {rows.map((r) => {
          const on = isOn(r.key);
          return (
            <div
              key={r.key}
              className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-6 py-3"
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded font-mono text-[10px] font-bold tracking-wider",
                  r.iconBg,
                )}
              >
                {r.iconText}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium leading-snug">{r.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {r.meta}
                </div>
              </div>
              {on ? <Pill tone="good">Live</Pill> : <Pill tone="neutral">Off</Pill>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
