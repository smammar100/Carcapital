"use client";

import { DollarSign } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  Field,
  FieldGrid,
  InfoCard,
  PanelCard,
  Pill,
  SectionDivider,
} from "./primitives";
import { cn } from "@/lib/utils";

interface FinancialsTabProps {
  vehicle: Vehicle;
}

/**
 * Financials tab — the dealership's profit-and-loss surface for a single
 * vehicle. Lays out four sub-sections in the same order as the v5 demo:
 *   1. "Why this tab exists" info card
 *   2. Profit summary strip (purchase / retail / margin VAT / net)
 *   3. Purchase information card
 *   4. Dual ledger (expense vs additional revenue)
 *   5. VAT margin scheme calculator
 */
export function FinancialsTab({ vehicle }: FinancialsTabProps) {
  const purchase = vehicle.totalBuyingPrice;
  const retail = vehicle.listingPrice ?? 0;
  const gross = retail > 0 ? Math.max(0, retail - purchase) : 0;
  const marginVat = gross * (0.2 / 1.2);
  const net = gross - marginVat;

  // Build expense + revenue category rows from the vehicle's cost columns.
  // Each entry is a real Vehicle field today; "additional profit" rows are
  // placeholders until the v4.2 schema lands (markup, GAP, etc).
  const expenses: LedgerEntry[] = [
    { name: "Buying Price", amount: vehicle.buyingPrice },
    { name: "Buyer's Fee", amount: vehicle.buyersFee ?? 0 },
    { name: "Inspection Charge", amount: vehicle.inspectionCharge ?? 0 },
    { name: "Collection Fee", amount: vehicle.collectionFee ?? 0 },
    { name: "Delivery Fee", amount: vehicle.deliveryFee ?? 0 },
    { name: "Late Storage Fee", amount: vehicle.lateStorageFee ?? 0 },
    { name: "Loading Fee", amount: vehicle.loadingFee ?? 0 },
    { name: "Unloading Fee", amount: vehicle.unloadingFee ?? 0 },
    { name: "Stocking Charges", amount: vehicle.stockingCharges },
    { name: "Prep / Value Addition", amount: vehicle.valueAddition },
    { name: "Warranty Cost", amount: vehicle.warrantyCost ?? 0 },
    { name: "Other Charges", amount: vehicle.otherCharges ?? 0 },
  ];
  const expenseTotal = expenses.reduce((acc, e) => acc + e.amount, 0);

  const revenue: LedgerEntry[] = [
    { name: "Accessories", amount: 0 },
    { name: "Warranty (markup)", amount: 0 },
    { name: "Paint Protection", amount: 0 },
    { name: "Admin Fee", amount: 0 },
    { name: "GAP Insurance", amount: 0 },
    { name: "Service Plan", amount: 0 },
    { name: "Smart Insurance", amount: 0 },
    { name: "Finance Commission", amount: 0 },
    { name: "Bonus", amount: 0 },
    { name: "Discount", amount: 0 },
    { name: "Writedown", amount: 0 },
    { name: "Commission Adj.", amount: 0 },
  ];
  const revenueTotal = revenue.reduce((acc, r) => acc + r.amount, 0);

  return (
    <div className="flex flex-col">
      <InfoCard
        icon={<DollarSign className="h-4.5 w-4.5" />}
        title="Every penny in, every penny out"
      >
        UK used-car dealers don&apos;t just earn the gap between buying and
        selling — there&apos;s a whole second revenue stream from{" "}
        <strong>add-on products</strong> (warranty markup, GAP insurance, paint
        protection, finance commission, admin fees). This tab tracks both: the{" "}
        <strong>cost ledger</strong> on the left, and the{" "}
        <strong>revenue ledger</strong> on the right. The VAT calculation below
        uses HMRC&apos;s <strong>Margin Scheme</strong> — VAT is owed only on
        the profit margin, not the full sale price.
      </InfoCard>

      {/* Profit summary strip */}
      <div className="mb-3.5 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-4 sm:divide-x">
        <ProfitCell
          label="Purchase Price"
          value={purchase}
          formula={vehicle.sellerName ? `From ${vehicle.sellerName}` : undefined}
        />
        <ProfitCell
          label="Retail Price"
          value={retail}
          formula={retail ? "Web price" : "Not listed"}
        />
        <ProfitCell
          label="Margin VAT"
          value={marginVat}
          formula="gross × 0.20 / 1.20"
        />
        <ProfitCell
          label="Net Profit"
          value={net}
          formula="post-VAT"
          profit
        />
      </div>

      {/* Purchase information */}
      <PanelCard
        title="Purchase Information"
        subtitle={
          vehicle.invoiceDate
            ? `Invoice · ${formatDate(vehicle.invoiceDate)}`
            : "Invoice not recorded"
        }
        trailing={
          <Button variant="outline" size="sm">
            Print Invoice
          </Button>
        }
      >
        <FieldGrid cols={3}>
          <Field label="Supplier">{vehicle.sellerName}</Field>
          <Field label="VAT Scheme">Margin Based</Field>
          <Field label="Source">
            <span className="capitalize">
              {vehicle.sourceType.replace("_", " ")}
            </span>
          </Field>
          <Field label="Buying Price" mono>
            {formatCurrency(vehicle.buyingPrice)}
          </Field>
          <Field label="Total Buying" mono>
            {formatCurrency(vehicle.totalBuyingPrice)}
          </Field>
          <Field label="Stocking Provider">
            <span className="capitalize">
              {vehicle.financeProvider.replace("_", " ")}
            </span>
          </Field>
        </FieldGrid>
      </PanelCard>

      {/* Profit & loss section */}
      <SectionDivider label="Profit & Loss" />
      <div className="mb-3.5 grid gap-3.5 lg:grid-cols-2">
        <LedgerCard
          variant="expense"
          title="Expenses"
          subtitle="UK dealer cost taxonomy"
          rows={expenses}
          total={expenseTotal}
        />
        <LedgerCard
          variant="revenue"
          title="Additional Profit"
          subtitle="Markups, commissions, fees"
          rows={revenue}
          total={revenueTotal}
        />
      </div>

      {/* VAT margin scheme */}
      <PanelCard
        title="VAT Margin Scheme"
        subtitle="Under HMRC margin scheme, VAT applies only to gross profit"
        trailing={<Pill tone="info">Margin Scheme</Pill>}
      >
        <FieldGrid cols={4} className="gap-x-8 gap-y-3">
          <VatStat
            label="Gross Profit"
            value={gross}
            formula="retail − purchase"
            tone="good"
          />
          <VatStat
            label="Margin VAT"
            value={marginVat}
            formula="gross × 0.20 / 1.20"
          />
          <VatStat
            label="Car Margin"
            value={net}
            formula="gross − VAT"
            tone="good"
          />
          <VatStat
            label="Net Profit (SIV)"
            value={net + revenueTotal}
            formula="+ additional profit"
            tone="good"
          />
        </FieldGrid>
      </PanelCard>
    </div>
  );
}

interface LedgerEntry {
  name: string;
  amount: number;
}

// ============================================================
// Profit summary cell
// ============================================================

function ProfitCell({
  label,
  value,
  formula,
  profit,
}: {
  label: string;
  value: number;
  formula?: string;
  profit?: boolean;
}) {
  return (
    <div className="px-2 sm:px-6 sm:first:pl-2 sm:last:pr-2">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-[24px] font-semibold leading-tight tracking-tight",
          profit ? "text-emerald-600" : "text-foreground",
        )}
      >
        {value > 0 ? formatCurrency(Math.round(value)) : "—"}
      </div>
      {formula && (
        <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">
          {formula}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Ledger card
// ============================================================

function LedgerCard({
  variant,
  title,
  subtitle,
  rows,
  total,
}: {
  variant: "expense" | "revenue";
  title: string;
  subtitle: string;
  rows: LedgerEntry[];
  total: number;
}) {
  const visibleRows = rows.slice(0, 12);
  const overflow = rows.length - visibleRows.length;
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div
        className={cn(
          "flex items-start justify-between gap-4 border-b px-5 py-4",
          variant === "expense" && "border-rose-200 bg-rose-50/60",
          variant === "revenue" && "border-emerald-200 bg-emerald-50/60",
        )}
      >
        <div>
          <div
            className={cn(
              "text-[14.5px] font-semibold tracking-tight",
              variant === "expense" && "text-rose-700",
              variant === "revenue" && "text-emerald-700",
            )}
          >
            {title}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {subtitle}
          </div>
        </div>
        <Pill tone={variant === "expense" ? "bad" : "good"}>
          {formatCurrency(total)}
        </Pill>
      </div>
      <div>
        {visibleRows.map((r, i) => (
          <LedgerRow key={r.name} entry={r} last={i === visibleRows.length - 1 && overflow === 0} />
        ))}
        {overflow > 0 && (
          <div className="px-5 py-3 text-center text-[12px] italic text-muted-foreground">
            + {overflow} more categories
          </div>
        )}
      </div>
      <div className="flex items-center justify-between bg-foreground px-5 py-3.5 text-background">
        <span className="text-[11px] font-medium tracking-wider text-[#F5C518]/70">
          {variant === "expense" ? "TOTAL EXPENSES" : "TOTAL ADDITIONAL"}
        </span>
        <span className="font-mono text-base font-semibold text-[#F5C518]">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

function LedgerRow({ entry, last }: { entry: LedgerEntry; last: boolean }) {
  const has = entry.amount > 0;
  return (
    <div
      className={cn(
        "grid grid-cols-[8px_1fr_auto] items-center gap-3 px-5 py-2.5 text-[13px] transition-colors hover:bg-muted/30",
        !last && "border-b",
      )}
    >
      <span
        className={cn(
          "ml-1.5 h-1.5 w-1.5 rounded-full",
          has ? "bg-foreground" : "bg-border",
        )}
      />
      <span className={cn(has ? "font-medium text-foreground" : "text-muted-foreground")}>
        {entry.name}
      </span>
      <span
        className={cn(
          "font-mono font-medium",
          has ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {formatCurrency(entry.amount, { showZero: true })}
      </span>
    </div>
  );
}

// ============================================================
// VAT stat cell
// ============================================================

function VatStat({
  label,
  value,
  formula,
  tone,
}: {
  label: string;
  value: number;
  formula?: string;
  tone?: "good";
}) {
  return (
    <div>
      <div className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-[18px] font-bold",
          tone === "good" ? "text-emerald-600" : "text-foreground",
        )}
      >
        {value > 0 ? formatCurrency(value) : "—"}
      </div>
      {formula && (
        <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">
          {formula}
        </div>
      )}
    </div>
  );
}
