"use client";

import { Paperclip } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface Props {
  buyingPrice: number;
  feesAndCharges: number;
  stockingCharges: number;
  prepCosts: number;
  warranty: number;
  listingPrice: number | null;
  className?: string;
  /** Optional subtitle (e.g. ISO date string). */
  subtitle?: string;
}

// Receipt outline: rounded top corners (4px, matching --radius), straight
// sides, zigzag torn-paper bottom. Top corners approximated with a 3-point
// quarter-arc so the rounding follows the global radius scale.
const TEAR =
  "polygon(0 4px, 1.17px 1.17px, 4px 0, calc(100% - 4px) 0, calc(100% - 1.17px) 1.17px, 100% 4px, 100% calc(100% - 8px), 95.65% 100%, 91.30% calc(100% - 8px), 86.96% 100%, 82.61% calc(100% - 8px), 78.26% 100%, 73.91% calc(100% - 8px), 69.57% 100%, 65.22% calc(100% - 8px), 60.87% 100%, 56.52% calc(100% - 8px), 52.17% 100%, 47.83% calc(100% - 8px), 43.48% 100%, 39.13% calc(100% - 8px), 34.78% 100%, 30.43% calc(100% - 8px), 26.09% 100%, 21.74% calc(100% - 8px), 17.39% 100%, 13.04% calc(100% - 8px), 8.70% 100%, 4.35% calc(100% - 8px), 0 100%)";

export function CostSummaryReceipt({
  buyingPrice,
  feesAndCharges,
  stockingCharges,
  prepCosts,
  warranty,
  listingPrice,
  className,
  subtitle,
}: Props) {
  const totalBuying = buyingPrice + feesAndCharges;
  const baseCost = totalBuying + stockingCharges + prepCosts + warranty;
  const profit = listingPrice !== null ? listingPrice - baseCost : null;

  return (
    <div
      className={cn("relative", className)}
      style={{
        // 1px ring at 5% foreground (matches `ring-1 ring-foreground/5` on the
        // shadcn Card) plus the maybe `shadow-md` recipe — both traced via
        // drop-shadow so they follow the clip-path zigzag instead of clipping
        // to a rectangle.
        filter:
          "drop-shadow(1px 0 0 rgba(23,23,23,0.05)) drop-shadow(-1px 0 0 rgba(23,23,23,0.05)) drop-shadow(0 1px 0 rgba(23,23,23,0.05)) drop-shadow(0 -1px 0 rgba(23,23,23,0.05)) drop-shadow(0 4px 8px rgba(11,11,11,0.06))",
      }}
    >
      {/* Paperclip — pinned to the right edge */}
      <div className="absolute -top-3 right-4 z-10 flex h-12 w-9 -rotate-12 items-center justify-center">
        <Paperclip
          className="h-9 w-9 text-muted-foreground/50"
          strokeWidth={1.25}
        />
      </div>

      {/* Receipt body — torn-paper bottom via clip-path */}
      <div
        className="relative bg-card px-5 pb-8 pt-7 text-sm leading-snug text-foreground"
        style={{ clipPath: TEAR }}
      >
        <div className="mb-3 text-left">
          <p className="text-base font-semibold tracking-tight">
            Cost Summary
          </p>
        </div>

        <div className="border-t border-dashed border-border" />

        <table className="w-full">
          <tbody>
            <Row label="Buying Price" value={buyingPrice} />
            <SubItem text="Negotiated purchase amount" />

            <Row label="+ Fees & Charges" value={feesAndCharges} />
            <SubItem text="Buyer / inspection / collection / delivery" />

            <Row label="+ Stocking" value={stockingCharges} />
            <Row label="+ Prep Costs" value={prepCosts} />
            <Row label="+ Warranty" value={warranty} />
          </tbody>
          <tfoot>
            <SectionDivider />
            <Row label="Total Buying" value={totalBuying} bold />
            <Row label="Base Cost" value={baseCost} bold />
            <SectionDivider />
            <Row
              label="→ Listing Price"
              value={listingPrice}
              tone={
                listingPrice !== null && listingPrice > 0 ? "neutral" : "muted"
              }
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
          </tfoot>
        </table>
      </div>
    </div>
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
    <tr>
      <th
        scope="row"
        className={cn(
          "py-1 pr-2 text-left align-baseline text-sm font-normal text-muted-foreground",
          bold && "font-semibold text-foreground",
        )}
      >
        {label}
      </th>
      <td
        className={cn(
          "py-1 text-right align-baseline text-sm tabular-nums text-foreground",
          bold && "font-semibold",
          tone === "positive" && "text-emerald-600",
          tone === "negative" && "text-rose-600",
          tone === "muted" && "text-muted-foreground/60",
        )}
      >
        {formatCurrency(value)}
      </td>
    </tr>
  );
}

function SubItem({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={2} className="pb-2 pl-3 align-baseline">
        <span className="text-xs text-muted-foreground">— {text}</span>
      </td>
    </tr>
  );
}

function SectionDivider() {
  return (
    <tr>
      <td colSpan={2} className="py-1">
        <div className="border-t border-dashed border-border" />
      </td>
    </tr>
  );
}
