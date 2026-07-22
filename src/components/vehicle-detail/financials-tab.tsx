"use client";

import { useEffect, useState } from "react";
import { ChevronRight, DollarSign } from "lucide-react";
import type { Invoice, Listing, Vehicle } from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import { invoiceService } from "@/lib/services/invoice-service";
import { paidAddonsTotal } from "@/lib/invoice-calc";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Field, FieldGrid, Panel, Pill } from "./primitives";
import { ExternalInvoicesSection } from "./external-invoices-section";

interface FinancialsTabProps {
  vehicle: Vehicle;
}

interface LedgerEntry {
  name: string;
  amount: number;
}

/**
 * Financials tab — Variation B ("money-in vs money-out"). The full cost
 * ledger and the full revenue ledger sit side-by-side and meet at a
 * centred "= Net profit" result, followed by the AutoTrader market
 * position, purchase information, external invoices, and the HMRC
 * margin-scheme breakdown. HMRC margin-scheme aware throughout.
 */
export function FinancialsTab({ vehicle }: FinancialsTabProps) {
  // Web price source aligned with the Overview tab: prefer the live listing
  // price, fall back to the vehicle record so both surfaces show the same
  // revenue for the same car.
  const [listing, setListing] = useState<Listing | null>(null);
  useEffect(() => {
    let active = true;
    void listingService
      .getForVehicle(vehicle.id)
      .then((l) => active && setListing(l))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [vehicle.id]);

  // The vehicle's real add-on revenue lives on its sale invoice. Fetch it so the
  // revenue ledger and the SIV figure reflect actual paid add-ons rather than 0.
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  useEffect(() => {
    let active = true;
    void invoiceService
      .getByVehicle(vehicle.companyId, vehicle.id, "sale")
      .then((rows) => active && setInvoice(rows[0] ?? null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [vehicle.companyId, vehicle.id]);

  const retail = listing?.price ?? vehicle.listingPrice ?? 0;

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

  // Add-on revenue lines (markups / commissions / fees) come from the vehicle's
  // sale invoice. When an invoice exists we list its real paid add-on lines; the
  // total is the canonical paidAddonsTotal so the SIV figure stays consistent.
  // With no invoice yet we fall back to the capture taxonomy shown at 0.
  const paidAddonLines = (invoice?.lineItems ?? []).filter(
    (l) => l.type === "addon_paid",
  );
  const addons: LedgerEntry[] =
    paidAddonLines.length > 0
      ? paidAddonLines.map((l) => ({
          name: l.description || "Add-on",
          amount: l.total,
        }))
      : [
          "Accessories", "Warranty (markup)", "Paint Protection", "Admin Fee",
          "GAP Insurance", "Service Plan", "Smart Insurance", "Finance Commission",
          "Bonus", "Discount", "Writedown", "Commission Adj.",
        ].map((name) => ({ name, amount: 0 }));
  // Canonical paid add-on revenue from the invoice (falls back to 0 gracefully).
  const addonTotal = invoice
    ? paidAddonsTotal(invoice.lineItems)
    : 0;

  const revenue: LedgerEntry[] = [
    { name: "Retail (web price)", amount: retail },
    ...addons,
  ];
  const revenueTotal = retail + addonTotal;

  // Both halves of the screen must agree: net = money in − money out, using the
  // SAME full-cost figure the expense ledger displays (which already includes
  // stocking charges, prep/value-addition and warranty cost — the canonical
  // baseCost that matches the Master Sheet). Gross is the pre-VAT margin.
  const gross = revenueTotal > 0 ? Math.max(0, revenueTotal - expenseTotal) : 0;
  const marginVat = gross * (0.2 / 1.2);
  const net = gross - marginVat;

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <DollarSign className="size-3.5 shrink-0" />
        Every cost and every add-on revenue for this car. VAT uses HMRC&apos;s{" "}
        <strong className="font-medium text-foreground">Margin Scheme</strong>:
        owed only on the profit margin, not the full sale price.
      </p>

      {/* Money out ↔ money in */}
      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <LedgerCard
          title="Money out · Expenses"
          subtitle="UK dealer cost taxonomy"
          rows={expenses}
          total={expenseTotal}
          tone="bad"
        />
        <div className="hidden items-center justify-center lg:flex">
          <span className="grid size-12 place-items-center rounded-full border bg-card text-muted-foreground">
            <ChevronRight className="size-5" />
          </span>
        </div>
        <LedgerCard
          title="Money in · Revenue"
          subtitle={`Retail ${formatCurrency(retail)} + add-ons`}
          rows={revenue}
          total={revenueTotal}
          tone="good"
        />
      </div>

      {/* Net result */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center dark:border-emerald-900/40 dark:bg-emerald-500/5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Net profit after margin VAT
        </div>
        <div className="mt-1 text-3xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          {net > 0 ? formatCurrency(Math.round(net)) : "—"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Gross {formatCurrency(gross)} − margin VAT {formatCurrency(marginVat)}
        </div>
      </div>

      {/* AutoTrader market value */}
      {vehicle.atRetailValuation != null && (
        <AutoTraderCard vehicle={vehicle} retail={retail} />
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

      {/* External invoices (Module D) — live data + add dialogs */}
      <ExternalInvoicesSection vehicleId={vehicle.id} />

      {/* VAT margin scheme */}
      <Panel
        title="VAT Margin Scheme"
        subtitle="Under HMRC margin scheme, VAT applies only to gross profit"
        action={<Pill tone="info">Margin Scheme</Pill>}
      >
        <FieldGrid cols={4}>
          <VatStat label="Gross Profit" value={gross} formula="revenue − total cost" tone="good" />
          <VatStat label="Margin VAT" value={marginVat} formula="gross × 0.20 / 1.20" />
          <VatStat label="Car Margin" value={net} formula="gross − VAT" tone="good" />
          <VatStat label="Net Profit (SIV)" value={net + addonTotal} formula="+ add-on profit" tone="good" />
        </FieldGrid>
      </Panel>
    </div>
  );
}

function LedgerCard({
  title,
  subtitle,
  rows,
  total,
  tone,
}: {
  title: string;
  subtitle: string;
  rows: LedgerEntry[];
  total: number;
  tone: "bad" | "good";
}) {
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      action={<Pill tone={tone}>{formatCurrency(total)}</Pill>}
      flush
    >
      <div className="divide-y border-t">
        {rows.map((r) => {
          const has = r.amount > 0;
          return (
            <div
              key={r.name}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    has ? "bg-foreground" : "bg-muted-foreground/40",
                  )}
                />
                <span className={cn(has ? "font-medium" : "text-muted-foreground")}>
                  {r.name}
                </span>
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  has ? "font-medium" : "text-muted-foreground",
                )}
              >
                {formatCurrency(r.amount)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {tone === "bad" ? "Total expenses" : "Total revenue"}
        </span>
        <span className="text-base font-semibold tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
    </Panel>
  );
}

function AutoTraderCard({
  vehicle,
  retail,
}: {
  vehicle: Vehicle;
  retail: number;
}) {
  const atRetail = vehicle.atRetailValuation ?? 0;
  const atTrade = vehicle.atTradeValuation ?? 0;
  const ratio = retail > 0 && atRetail > 0 ? retail / atRetail : null;
  const showBar = retail > 0 && atRetail > atTrade;
  const pos = showBar
    ? Math.max(0, Math.min(1, (retail - atTrade) / (atRetail - atTrade))) * 100
    : 0;

  return (
    <Panel
      title="AutoTrader market value"
      subtitle={`${retail > 0 ? `Your price ${formatCurrency(retail)} · ` : ""}${
        vehicle.atValuationAt
          ? `valued ${formatDate(vehicle.atValuationAt)}`
          : "captured at intake"
      } · ${vehicle.mileage.toLocaleString()} mi`}
      action={
        ratio != null ? (
          <Pill tone={ratio <= 0.97 ? "good" : ratio <= 1.03 ? "info" : "warn"}>
            {ratio <= 0.97
              ? "Priced to sell"
              : ratio <= 1.03
                ? "At market"
                : "Above market"}
          </Pill>
        ) : null
      }
    >
      {showBar && (
        <div className="relative mb-3 mt-1 h-2 rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-rose-400">
          <div
            className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-background bg-foreground shadow"
            style={{ left: `${pos}%` }}
          />
        </div>
      )}
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
          "mt-1 text-base font-semibold tabular-nums",
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
