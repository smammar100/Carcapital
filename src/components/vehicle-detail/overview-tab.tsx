"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  ClipboardCheck,
  Clock,
  Coins,
  Globe,
  Pencil,
  PoundSterling,
  RefreshCw,
  Rocket,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import type { Listing, Vehicle } from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import { dvlaService } from "@/lib/services/dvla-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { KpiCard, Panel, Pill } from "./primitives";
import { cn } from "@/lib/utils";
import { VehicleLocationSection } from "@/components/locations/vehicle-location-section";
import {
  computeAdvertChecks,
  type AdvertCheck,
} from "@/lib/advert-completeness";

interface OverviewTabProps {
  vehicle: Vehicle;
  /** Merge fresh fields into the page's Vehicle state (e.g. after a
   *  live AutoTrader valuation refresh). */
  onVehiclePatch?: (patch: Partial<Vehicle>) => void;
  /** Jump to a detail tab (empty-state CTAs route the first actions). */
  onNavigate?: (tab: string) => void;
}

/**
 * Overview tab — the dealership's "at-a-glance everything I need" surface.
 * Four KPIs up top, advert completeness on the left, valuation + marketplace
 * on the right, then a full field grid of vehicle details underneath.
 */
export function OverviewTab({ vehicle, onVehiclePatch, onNavigate }: OverviewTabProps) {
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);

  useEffect(() => {
    void listingService.getForVehicle(vehicle.id).then(setListing);
  }, [vehicle.id]);

  const webPrice = listing?.price ?? vehicle.listingPrice ?? 0;

  // A brand-new vehicle has nothing to glance at yet (no valuation, no price,
  // no photos). Rather than a wall of "—" cards, guide the first action.
  const isNew =
    listing !== undefined &&
    vehicle.atRetailValuation == null &&
    webPrice <= 0 &&
    (vehicle.imagesCount ?? 0) === 0;
  if (isNew) {
    return <EmptyOverview vehicleId={vehicle.id} onNavigate={onNavigate} />;
  }
  const floor = vehicle.minimumSalePrice ?? 0;
  const stockingBurn = vehicle.dailyChargeRate ?? 0;
  // Canonical cost = total buying + stocking + prep/value-addition + warranty
  // (matches the Master Sheet profit column and the Financials expense ledger).
  const baseCost =
    vehicle.totalBuyingPrice +
    vehicle.stockingCharges +
    vehicle.valueAddition +
    (vehicle.warrantyCost ?? 0);
  const grossProfit =
    webPrice && baseCost ? Math.max(0, webPrice - baseCost) : 0;
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
            webPrice={webPrice}
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
// Empty state — a brand-new vehicle with nothing set up yet
// ============================================================

function EmptyOverview({
  vehicleId,
  onNavigate,
}: {
  vehicleId: string;
  onNavigate?: (tab: string) => void;
}) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Rocket className="h-7 w-7" />
      </span>
      <div className="mt-4 text-lg font-semibold">
        New to stock — let&apos;s get it sale-ready
      </div>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        There&apos;s no advert, valuation or pricing yet. The first step is a
        quick inspection — everything else follows from what it finds.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" onClick={() => onNavigate?.("inspection")}>
          <ClipboardCheck className="mr-1.5 h-4 w-4" />
          Start Inspection
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate?.("photos")}>
          <Camera className="mr-1.5 h-4 w-4" />
          Add Photos
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/vehicles/${vehicleId}/advert`}>
            <PoundSterling className="mr-1.5 h-4 w-4" />
            Set Price
          </Link>
        </Button>
      </div>
      <div className="mt-6 text-2xs text-muted-foreground">
        Then: prep &amp; repairs → photos → price → advert → list
      </div>
    </div>
  );
}

// ============================================================
// Advert Completeness — checklist driven from Listing + Vehicle
// ============================================================

function AdvertCompletenessPanel({
  vehicle,
  listing,
  photoCount,
}: {
  vehicle: Vehicle;
  listing: Listing | null;
  photoCount: number;
}) {
  const checks = computeAdvertChecks(vehicle, listing, photoCount);
  const setCount = checks.filter((c) => c.state === "done").length;

  return (
    <Panel
      title="Advert Completeness"
      subtitle={`${setCount} of ${checks.length} fields set · ${checks.length - setCount} to address`}
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={`/vehicles/${vehicle.id}/advert`}>Open Advert →</Link>
        </Button>
      }
      flush
    >
      <div className="px-4 pb-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${(setCount / checks.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="divide-y border-t">
        {checks.map((c) => (
          <AdvertCheckRow key={c.key} check={c} vehicleId={vehicle.id} />
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

const EDIT_ANCHOR: Record<string, string> = {
  taxonomy: "taxonomy",
  description: "description",
  pricing: "channels",
  channels: "channels",
  photos: "website",
};

function editHref(vehicleId: string, key: string): string {
  const anchor = EDIT_ANCHOR[key];
  return anchor
    ? `/vehicles/${vehicleId}/advert#${anchor}`
    : `/vehicles/${vehicleId}/advert`;
}

function AdvertCheckRow({
  check,
  vehicleId,
}: {
  check: AdvertCheck;
  vehicleId: string;
}) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-3 px-4 py-3">
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
      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
        <Link href={editHref(vehicleId, check.key)}>
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Link>
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
  webPrice,
  onVehiclePatch,
}: {
  vehicle: Vehicle;
  webPrice: number;
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
                ? "above_average"
                : "high";
      const patch: Partial<Vehicle> = {
        atRetailValuation: data.retailValuation ?? null,
        atTradeValuation: data.tradeValuation ?? null,
        atPartExchangeValuation: data.partExchangeValuation ?? null,
        atPrivateValuation: data.privateValuation ?? null,
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
      <PriceMeter
        webPrice={webPrice}
        trade={vehicle.atTradeValuation ?? null}
        retail={vehicle.atRetailValuation ?? null}
      />
    </Panel>
  );
}

/**
 * Price-vs-market meter folded into the valuation card — shows where our web
 * price sits on the Trade→Retail band with a marker + a tone-coded verdict
 * chip. Hidden until we have both AutoTrader bounds and a web price.
 */
function PriceMeter({
  webPrice,
  trade,
  retail,
}: {
  webPrice: number;
  trade: number | null;
  retail: number | null;
}) {
  if (!webPrice || trade == null || retail == null || retail <= trade) {
    return null;
  }
  const pos = Math.max(0, Math.min(1, (webPrice - trade) / (retail - trade))) * 100;
  const ratio = webPrice / retail;
  const verdict =
    ratio <= 0.97
      ? { label: "Below market", cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" }
      : ratio <= 1.03
        ? { label: "Within market", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" }
        : { label: "Above market", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };

  return (
    <div className="border-t px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your price vs market
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-2xs font-medium",
            verdict.cls,
          )}
        >
          {verdict.label}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-rose-400">
        <div
          className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-background bg-foreground shadow"
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-2xs tabular-nums text-muted-foreground">
        <span>Trade {formatCurrency(trade)}</span>
        <span className="font-semibold text-foreground">
          You {formatCurrency(webPrice)}
        </span>
        <span>Retail {formatCurrency(retail)}</span>
      </div>
    </div>
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
    <div className="px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-base font-semibold tabular-nums",
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
              className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-4 py-3"
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded font-mono text-2xs font-bold tracking-wider",
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
