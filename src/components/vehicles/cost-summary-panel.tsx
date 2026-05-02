"use client";

import { Card } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";

interface Props {
  buyingPrice: number;
  feesAndCharges: number;
  stockingCharges: number;
  prepCosts: number;
  warranty: number;
  listingPrice: number | null;
  className?: string;
}

export function CostSummaryPanel({
  buyingPrice,
  feesAndCharges,
  stockingCharges,
  prepCosts,
  warranty,
  listingPrice,
  className,
}: Props) {
  const totalBuying = buyingPrice + feesAndCharges;
  const baseCost = totalBuying + stockingCharges + prepCosts + warranty;
  const profit = listingPrice !== null ? listingPrice - baseCost : null;
  return (
    <Card className={cn("p-4 text-sm", className)}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Cost summary
      </h3>
      <div className="space-y-1.5">
        <Row label="Buying Price" value={buyingPrice} />
        <Row label="+ Fees & Charges" value={feesAndCharges} />
        <Divider />
        <Row label="= Total Buying" value={totalBuying} bold />
        <Row label="+ Stocking" value={stockingCharges} />
        <Row label="+ Prep Costs" value={prepCosts} />
        <Row label="+ Warranty" value={warranty} />
        <Divider />
        <Row label="= Base Cost" value={baseCost} bold />
        <Row
          label="→ Listing Price"
          value={listingPrice}
          tone={listingPrice !== null && listingPrice > 0 ? "neutral" : "muted"}
        />
        <Row
          label="→ Est. Profit"
          value={profit}
          tone={
            profit === null
              ? "muted"
              : profit > 0
                ? "positive"
                : profit < 0
                  ? "negative"
                  : "neutral"
          }
          bold
        />
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: number | null;
  bold?: boolean;
  tone?: "positive" | "negative" | "muted" | "neutral";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span
        className={cn(
          "text-muted-foreground",
          bold && "font-medium text-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          bold && "font-semibold",
          tone === "positive" && "text-emerald-600",
          tone === "negative" && "text-rose-600",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border" />;
}
