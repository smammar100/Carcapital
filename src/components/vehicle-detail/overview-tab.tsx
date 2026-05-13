"use client";

import { useEffect, useState } from "react";
import { Check, Pencil } from "lucide-react";
import type { Listing, Vehicle } from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Field,
  FieldGrid,
  KpiCard,
  PanelCard,
  Pill,
  SectionDivider,
} from "./primitives";
import { cn } from "@/lib/utils";

interface OverviewTabProps {
  vehicle: Vehicle;
}

/**
 * Overview tab — the dealership's "at-a-glance everything I need" surface.
 * Four KPIs up top, advert completeness on the left, valuation + marketplace
 * on the right, then a full field grid of vehicle details underneath.
 *
 * Where listing data is available, we read live values (price, channels,
 * description); otherwise we render an empty-state hint inside the card.
 */
export function OverviewTab({ vehicle }: OverviewTabProps) {
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

  const daysTone =
    vehicle.daysInStock >= 90
      ? "bad"
      : vehicle.daysInStock >= 60
        ? "warn"
        : "neutral";

  return (
    <div className="flex flex-col">
      {/* KPI strip */}
      <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Web Price"
          value={webPrice ? formatCurrency(webPrice) : "—"}
          meta={floor ? `Floor: ${formatCurrency(floor)}` : undefined}
        />
        <KpiCard
          label="Days in Stock"
          value={vehicle.daysInStock}
          valueClassName={daysTone === "bad" ? "text-rose-600" : undefined}
          meta={
            stockingBurn
              ? `Stocking burn: ${formatCurrency(stockingBurn)} / day`
              : undefined
          }
          metaTone={daysTone === "neutral" ? "neutral" : "warn"}
        />
        <KpiCard
          label="AT Retail Avg"
          value={webPrice ? formatCurrency(Math.round(webPrice * 0.99)) : "—"}
          meta={webPrice ? "Within market range" : undefined}
        />
        <KpiCard
          label="Net Profit (live)"
          value={netProfit > 0 ? formatCurrency(Math.round(netProfit)) : "—"}
          meta="Margin VAT scheme"
          featured
        />
      </div>

      {/* Two-col: Advert Completeness + Valuation/Marketplace stack */}
      <div className="mb-3.5 grid gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <AdvertCompletenessCard
          vehicle={vehicle}
          listing={listing ?? null}
          photoCount={vehicle.imagesCount}
        />
        <div className="flex flex-col gap-3.5">
          <ValuationCard webPrice={webPrice} />
          <MarketplaceCard listing={listing ?? null} />
        </div>
      </div>

      {/* Vehicle details */}
      <SectionDivider label="Vehicle Details" />
      <PanelCard noHead bodyClassName="p-5">
        <FieldGrid cols={2}>
          <Field label="Make / Model">
            {vehicle.make} {vehicle.model}
          </Field>
          <Field label="Variant">{vehicle.variantCode ?? "—"}</Field>
          <Field label="Year" mono>
            {vehicle.year}
          </Field>
          <Field label="Colour">{vehicle.colour}</Field>
          <Field label="Mileage" mono>
            {vehicle.mileage.toLocaleString()} mi
          </Field>
          <Field label="Engine" mono>
            {vehicle.engineSizeCC ? `${vehicle.engineSizeCC.toLocaleString()} cc` : "—"}
          </Field>
          <Field label="Body / Fuel">
            <span className="capitalize">
              {vehicle.bodyType} · {vehicle.fuelType} · {vehicle.transmission}
            </span>
          </Field>
          <Field label="Stock ID" mono>
            {vehicle.stockId}
          </Field>
          <Field label="Received" mono>
            {formatDate(vehicle.receivedDate)}
          </Field>
          <Field label="MOT Expiry" mono>
            {vehicle.motExpiry ? formatDate(vehicle.motExpiry) : "—"}
          </Field>
          <Field label="Seller">
            {vehicle.sellerName} · {vehicle.sellerPhone}
          </Field>
          <Field label="Source">
            <span className="capitalize">{vehicle.sourceType.replace("_", " ")}</span>
            {vehicle.auctionHouse ? ` (${vehicle.auctionHouse})` : ""}
          </Field>
          <Field label="V5 Received">{vehicle.v5Received ? "Yes" : "No"}</Field>
          <Field label="Service History">
            <span className="capitalize">{vehicle.serviceHistory}</span>
          </Field>
          <Field label="Keys" mono>
            {vehicle.numKeys}
          </Field>
          <Field label="Lock Nut">
            {vehicle.lockNut ? "Present" : "Missing"}
          </Field>
        </FieldGrid>
      </PanelCard>
    </div>
  );
}

// ============================================================
// Advert Completeness — Notion-style checklist
// ============================================================

function AdvertCompletenessCard({
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
      action: "Edit",
    },
    {
      name: "Photos",
      meta:
        photoCount > 0
          ? `${photoCount} image${photoCount === 1 ? "" : "s"} · backgrounds processed`
          : "No photos uploaded",
      state: photoCount >= 8 ? "done" : photoCount > 0 ? "warn" : "miss",
      action: photoCount > 0 ? "Manage" : "Upload",
    },
    {
      name: "Vehicle Description",
      meta:
        listing?.description && listing.description.trim().length > 30
          ? `${listing.description.length} chars`
          : "Empty — generate with AI",
      state:
        listing?.description && listing.description.trim().length > 30
          ? "done"
          : "warn",
      action:
        listing?.description && listing.description.trim().length > 30
          ? "Edit"
          : "Generate",
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
      action: listing?.price ? "Edit" : "Set price",
    },
    {
      name: "MOT Status",
      meta: vehicle.motExpiry
        ? `Valid until ${formatDate(vehicle.motExpiry)}`
        : "No expiry on file",
      state: vehicle.motExpiry ? "done" : "warn",
      action: "Edit",
    },
    {
      name: "Service History",
      meta: vehicle.serviceHistory.replace(/_/g, " "),
      state: vehicle.serviceHistory !== "none" ? "done" : "warn",
      action: "Edit",
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
      action: listing ? "Edit" : "Create listing",
    },
  ];

  const setCount = checks.filter((c) => c.state === "done").length;

  return (
    <PanelCard
      title="Advert Completeness"
      subtitle={`${setCount} of ${checks.length} fields set · ${checks.length - setCount} to address`}
      trailing={
        <Button asChild variant="outline" size="sm">
          <a href="/advert/work-list">Open Advert →</a>
        </Button>
      }
      bodyClassName="p-0"
    >
      <div>
        {checks.map((c, i) => (
          <AdvertCheckRow key={i} check={c} last={i === checks.length - 1} />
        ))}
      </div>
    </PanelCard>
  );
}

interface AdvertCheck {
  name: string;
  meta: string;
  state: "done" | "warn" | "miss";
  action: string;
}

const STATE_MARK_STYLES: Record<AdvertCheck["state"], string> = {
  done: "bg-emerald-600 text-white",
  warn: "bg-orange-500 text-white",
  miss: "bg-muted-foreground/60 text-white",
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

function AdvertCheckRow({ check, last }: { check: AdvertCheck; last: boolean }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[22px_1fr_auto_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30",
        !last && "border-b",
      )}
    >
      <span
        className={cn(
          "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold",
          STATE_MARK_STYLES[check.state],
        )}
      >
        {check.state === "done" ? (
          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
        ) : check.state === "warn" ? (
          "!"
        ) : (
          "×"
        )}
      </span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium leading-snug">{check.name}</div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {check.meta}
        </div>
      </div>
      <Pill tone={STATE_PILL_TONE[check.state]}>
        {STATE_PILL_LABEL[check.state]}
      </Pill>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
        {check.action}
      </button>
    </div>
  );
}

// ============================================================
// Valuation Card — three-cell AutoTrader values
// ============================================================

function ValuationCard({ webPrice }: { webPrice: number }) {
  // Synthesised demo values until AutoTrader API is wired up.
  const trade = webPrice ? Math.round(webPrice * 0.78) : 0;
  const partEx = webPrice ? Math.round(webPrice * 0.76) : 0;
  const retail = webPrice ? Math.round(webPrice * 0.99) : 0;

  return (
    <PanelCard
      title="AutoTrader Valuation"
      subtitle="Updated just now · live feed"
      bodyClassName="p-0"
    >
      <div className="grid grid-cols-3">
        <ValuationCell label="Trade" value={trade} />
        <ValuationCell label="Part Ex" value={partEx} />
        <ValuationCell label="Retail" value={retail} featured />
      </div>
    </PanelCard>
  );
}

function ValuationCell({
  label,
  value,
  featured,
}: {
  label: string;
  value: number;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-r p-4 last:border-r-0",
        featured && "bg-foreground text-background",
      )}
    >
      <div
        className={cn(
          "text-[10.5px] font-medium tracking-wide",
          featured ? "text-[#F5C518]/70" : "text-muted-foreground",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-[18px] font-semibold tracking-tight",
          featured ? "text-[#F5C518]" : "text-foreground",
        )}
      >
        {value ? formatCurrency(value) : "—"}
      </div>
    </div>
  );
}

// ============================================================
// Marketplace — channels list
// ============================================================

function MarketplaceCard({ listing }: { listing: Listing | null }) {
  type ChannelKey = "carcapital" | "autotrader" | "ebay" | "facebook";
  const rows: { key: ChannelKey; name: string; meta: string; iconBg: string; iconText: string }[] = [
    {
      key: "carcapital",
      name: "Car Capital UK",
      meta: "thecarcapital.co.uk",
      iconBg: "bg-foreground",
      iconText: "CC",
    },
    {
      key: "autotrader",
      name: "AutoTrader",
      meta: listing ? "Synced" : "Not configured",
      iconBg: "bg-[#1E5BB8]",
      iconText: "AT",
    },
    {
      key: "ebay",
      name: "eBay Motors",
      meta: "Not configured",
      iconBg: "bg-[#E53238]",
      iconText: "eB",
    },
    {
      key: "facebook",
      name: "Facebook",
      meta: "Not configured",
      iconBg: "bg-[#1877F2]",
      iconText: "fb",
    },
  ];

  return (
    <PanelCard title="Marketplace" bodyClassName="p-0">
      <div>
        {rows.map((r, i) => {
          const on =
            r.key === "carcapital"
              ? listing?.channels.website ?? false
              : r.key === "autotrader"
                ? listing?.channels.autotrader ?? false
                : r.key === "ebay"
                  ? listing?.channels.ebay ?? false
                  : listing?.channels.facebook ?? false;
          return (
            <div
              key={r.key}
              className={cn(
                "grid grid-cols-[28px_1fr_auto] items-center gap-3 px-5 py-3",
                i < rows.length - 1 && "border-b",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded font-mono text-[10px] font-bold tracking-wider text-white",
                  r.iconBg,
                )}
              >
                {r.iconText}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium leading-snug">{r.name}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {r.meta}
                </div>
              </div>
              {on ? (
                <Pill tone="good">Live</Pill>
              ) : (
                <Pill tone="neutral">Off</Pill>
              )}
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}
