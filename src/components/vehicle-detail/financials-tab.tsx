"use client";

import { DollarSign } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Field,
  FieldGrid,
  InfoCard,
  Panel,
  Pill,
  SectionDivider,
} from "./primitives";
import { ExternalInvoicesSection } from "./external-invoices-section";
import { cn } from "@/lib/utils";

interface FinancialsTabProps {
  vehicle: Vehicle;
}

/**
 * Financials tab — the dealership's profit-and-loss surface for a single
 * vehicle. Lays out four sub-sections:
 *   1. "Why this tab exists" info card
 *   2. Profit summary strip (purchase / retail / margin VAT / net)
 *   3. Purchase information card
 *   4. Dual ledger (expense vs additional revenue) — coloured headers, neutral bodies
 *   5. VAT margin scheme calculator
 */
export function FinancialsTab({ vehicle }: FinancialsTabProps) {
  const purchase = vehicle.totalBuyingPrice;
  const retail = vehicle.listingPrice ?? 0;
  const gross = retail > 0 ? Math.max(0, retail - purchase) : 0;
  const marginVat = gross * (0.2 / 1.2);
  const net = gross - marginVat;

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
    <div className="flex flex-col gap-4">
      <InfoCard
        icon={<DollarSign className="h-4 w-4" />}
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
      <Card size="sm">
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:divide-x">
            <ProfitCell
              label="Purchase Price"
              value={purchase}
              hint={
                vehicle.sellerName ? `From ${vehicle.sellerName}` : undefined
              }
            />
            <ProfitCell
              label="Retail Price"
              value={retail}
              hint={retail ? "Web price" : "Not listed"}
            />
            <ProfitCell
              label="Margin VAT"
              value={marginVat}
              hint="gross × 0.20 / 1.20"
            />
            <ProfitCell
              label="Net Profit"
              value={net}
              hint="post-VAT"
              tone="good"
            />
          </div>
        </CardContent>
      </Card>

      {/* AutoTrader market value — reference row (migration 0018). Only shows
          when a valuation was captured at intake. Compares our retail price
          to AutoTrader's retail valuation so the operator can sanity-check. */}
      {vehicle.atRetailValuation != null && (
        <Panel
          title="AutoTrader market value"
          subtitle={`${retail > 0 ? `Your price ${formatCurrency(retail)} · ` : ""}${
            vehicle.atValuationAt
              ? `valued ${formatDate(vehicle.atValuationAt)}`
              : "captured at intake"
          } · ${vehicle.mileage.toLocaleString()} mi`}
          action={
            retail > 0 ? (
              <Pill
                tone={
                  retail <= vehicle.atRetailValuation * 0.97
                    ? "good"
                    : retail <= vehicle.atRetailValuation * 1.03
                      ? "info"
                      : "warn"
                }
              >
                {retail <= vehicle.atRetailValuation * 0.97
                  ? "Priced to sell"
                  : retail <= vehicle.atRetailValuation * 1.03
                    ? "At market"
                    : "Above market"}
              </Pill>
            ) : null
          }
        >
          <FieldGrid cols={4}>
            <Field label="Retail" numeric>
              {formatCurrency(vehicle.atRetailValuation)}
            </Field>
            <Field label="Trade" numeric>
              {vehicle.atTradeValuation != null
                ? formatCurrency(vehicle.atTradeValuation)
                : "—"}
            </Field>
            <Field label="Part-exchange" numeric>
              {vehicle.atPartExchangeValuation != null
                ? formatCurrency(vehicle.atPartExchangeValuation)
                : "—"}
            </Field>
            <Field label="Private" numeric>
              {vehicle.atPrivateValuation != null
                ? formatCurrency(vehicle.atPrivateValuation)
                : "—"}
            </Field>
          </FieldGrid>
        </Panel>
      )}

      {/* Purchase information */}
      <Panel
        title="Purchase Information"
        subtitle={
          vehicle.invoiceDate
            ? `Invoice · ${formatDate(vehicle.invoiceDate)}`
            : "Invoice not recorded"
        }
        action={
          <Button variant="outline" size="sm">
            Print Invoice
          </Button>
        }
      >
        <FieldGrid cols={3}>
          <Field label="Supplier">{vehicle.sellerName}</Field>
          <Field label="VAT Scheme">Margin Based</Field>
          <Field label="Purchase Source">
            <span className="capitalize">
              {vehicle.purchaseSource.replace("_", " ")}
            </span>
          </Field>
          <Field label="Buying Price" numeric>
            {formatCurrency(vehicle.buyingPrice)}
          </Field>
          <Field label="Total Buying" numeric>
            {formatCurrency(vehicle.totalBuyingPrice)}
          </Field>
          <Field label="Stocking Provider">
            <span className="capitalize">
              {vehicle.financeProvider.replace("_", " ")}
            </span>
          </Field>
        </FieldGrid>
      </Panel>

      {/* Profit & loss */}
      <div>
        <SectionDivider label="Profit & Loss" />
        <div className="grid gap-4 lg:grid-cols-2">
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
      </div>

      {/* External invoices (Module D) — purchase-side + external-job spend */}
      <ExternalInvoicesSection vehicleId={vehicle.id} />

      {/* VAT margin scheme */}
      <Panel
        title="VAT Margin Scheme"
        subtitle="Under HMRC margin scheme, VAT applies only to gross profit"
        action={<Pill tone="info">Margin Scheme</Pill>}
      >
        <FieldGrid cols={4}>
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
      </Panel>
    </div>
  );
}

interface LedgerEntry {
  name: string;
  amount: number;
}

function ProfitCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "good";
}) {
  return (
    <div className="px-2 sm:px-4 sm:first:pl-0 sm:last:pr-0">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {value > 0 ? formatCurrency(Math.round(value)) : "—"}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

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
  const tone: React.ComponentProps<typeof Pill>["tone"] =
    variant === "expense" ? "bad" : "good";
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      action={<Pill tone={tone}>{formatCurrency(total)}</Pill>}
      flush
    >
      <div className="divide-y">
        {visibleRows.map((r) => (
          <LedgerRow key={r.name} entry={r} />
        ))}
        {overflow > 0 && (
          <div className="px-4 py-3 text-center text-xs italic text-muted-foreground">
            + {overflow} more categories
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {variant === "expense" ? "Total expenses" : "Total additional"}
        </span>
        <span className="text-base font-semibold tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
    </Panel>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const has = entry.amount > 0;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            has ? "bg-foreground" : "bg-muted-foreground/40",
          )}
        />
        <span className={cn(has ? "font-medium" : "text-muted-foreground")}>
          {entry.name}
        </span>
      </div>
      <span
        className={cn(
          "tabular-nums",
          has ? "font-medium" : "text-muted-foreground",
        )}
      >
        {formatCurrency(entry.amount)}
      </span>
    </div>
  );
}

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
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "good" && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {value > 0 ? formatCurrency(value) : "—"}
      </div>
      {formula && (
        <div className="mt-1 text-xs text-muted-foreground">{formula}</div>
      )}
    </div>
  );
}
