"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { DepositMethod, Invoice } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import {
  invoiceReceiptService,
  type InvoiceReceipt,
} from "@/lib/services/invoice-receipt-service";
import { computeBalance, type BalanceState } from "@/lib/invoice-balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useAutoFocus } from "@/hooks/use-auto-focus";

const METHODS: [DepositMethod, string][] = [
  ["bank_transfer", "Bank Transfer"],
  ["cash", "Cash"],
  ["card", "Card"],
  ["cheque", "Cheque"],
  ["pdq", "PDQ"],
];

const methodLabel = (m: string | null): string =>
  METHODS.find(([v]) => v === m)?.[1] ?? "—";

interface Props {
  invoice: Invoice;
  /** Fired after a payment is recorded or removed, so the list can refresh. */
  onChanged?: () => void;
}

/**
 * Payments received against one invoice, with the running balance (GEN-73).
 *
 * The invoice only ever held a single deposit figure, so a second payment had
 * nowhere to go and the balance stayed at the full amount. Every payment is
 * now its own line; the deposit and finance terms still show, netted off
 * alongside them.
 */
export function InvoicePaymentsPanel({ invoice, onChanged }: Props) {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<InvoiceReceipt[] | null>(null);
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  // Desktop-only focus when the add-payment row opens — see useAutoFocus.
  const amountRef = useAutoFocus<HTMLInputElement>(adding);
  const [paidOn, setPaidOn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [method, setMethod] = useState<DepositMethod>("bank_transfer");
  const [saving, setSaving] = useState(false);
  const baseId = useId();
  const amountId = `${baseId}-amount`;
  const dateId = `${baseId}-date`;
  const methodId = `${baseId}-method`;

  useEffect(() => {
    void invoiceReceiptService
      .getForInvoice(invoice.id)
      .then(setReceipts)
      .catch(() => setReceipts([]));
  }, [invoice.id]);

  const balance: BalanceState = computeBalance({
    grandTotal: invoice.grandTotalInclAddons ?? invoice.total,
    deposit: invoice.depositAmount,
    finance: invoice.financeAmount,
    receipts: receipts ?? [],
  });

  async function handleAdd() {
    if (!user) return;
    const n = Number(amount.replace(/[£,\s]/g, ""));
    if (!(n > 0)) {
      toast.error("Enter a payment amount");
      return;
    }
    setSaving(true);
    try {
      const { balance: next } = await invoiceReceiptService.record(
        { invoiceId: invoice.id, amount: n, paidOn, method },
        user.id,
      );
      setReceipts(await invoiceReceiptService.getForInvoice(invoice.id));
      setAmount("");
      setAdding(false);
      toast.success(
        next.settled
          ? "Paid in full, invoice marked Paid"
          : `Payment recorded, ${formatCurrency(next.balanceDue)} still due`,
      );
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record payment");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(r: InvoiceReceipt) {
    if (!user) return;
    try {
      await invoiceReceiptService.remove(r.id, user.id);
      setReceipts(await invoiceReceiptService.getForInvoice(invoice.id));
      toast.success("Payment removed");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove payment");
    }
  }

  if (receipts === null) return <Skeleton className="mx-6 h-24" />;

  const entries = [
    ...(invoice.depositAmount > 0
      ? [
          {
            key: "deposit",
            label: "Deposit",
            date: invoice.depositReceivedDate,
            method: invoice.depositMethod,
            amount: invoice.depositAmount,
            removable: false,
          },
        ]
      : []),
    ...(invoice.financeAmount > 0
      ? [
          {
            key: "finance",
            label: invoice.financeProvider ?? "Finance",
            date: null,
            method: null,
            amount: invoice.financeAmount,
            removable: false,
          },
        ]
      : []),
    ...receipts.map((r) => ({
      key: r.id,
      label: "Payment",
      date: r.paidOn,
      method: r.method,
      amount: r.amount,
      removable: true,
      receipt: r,
    })),
  ];

  return (
    <div className="mx-6 mb-4 rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-sm font-semibold">
          Payments · {entries.length}
        </span>
        <span
          className={cn(
            "ml-auto text-sm font-semibold tabular-nums",
            balance.settled
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
          )}
        >
          {balance.settled
            ? "Paid in full"
            : `${formatCurrency(balance.balanceDue)} due`}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")}
        />
      </button>

      {open ? (
        <div className="border-t">
          {entries.length === 0 ? (
            <p className="px-3 py-2 text-xs italic text-muted-foreground">
              Nothing received yet.
            </p>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => (
                <li
                  key={e.key}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">{e.label}</span>
                  <span className="text-muted-foreground">
                    {e.date ? formatDate(e.date) : "—"}
                  </span>
                  <span className="text-muted-foreground">
                    · {methodLabel(e.method)}
                  </span>
                  <span className="ml-auto tabular-nums">
                    {formatCurrency(e.amount)}
                  </span>
                  {e.removable && "receipt" in e ? (
                    <button
                      type="button"
                      onClick={() => void handleRemove(e.receipt as InvoiceReceipt)}
                      aria-label="Remove payment"
                      className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  ) : (
                    <span className="size-6" />
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              Total {formatCurrency(balance.grandTotal)} · paid{" "}
              {formatCurrency(balance.paid)}
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                balance.overpaid && "text-amber-600 dark:text-amber-400",
              )}
            >
              {balance.overpaid
                ? `Overpaid by ${formatCurrency(balance.overpaidBy)}`
                : `Balance ${formatCurrency(balance.balanceDue)}`}
            </span>
          </div>

          {adding ? (
            <div className="flex flex-wrap items-end gap-2 border-t px-3 py-2">
              <div className="w-28">
                <Label htmlFor={amountId} className="text-xs">Amount</Label>
                <Input
                  id={amountId}
                  ref={amountRef}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAdd();
                    if (e.key === "Escape") setAdding(false);
                  }}
                  inputMode="decimal"
                  placeholder="£0.00"
                  className="h-8 text-right text-sm tabular-nums"
                />
              </div>
              <div className="w-36">
                <Label htmlFor={dateId} className="text-xs">Date</Label>
                <Input
                  id={dateId}
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-36">
                <Label htmlFor={methodId} className="text-xs">Method</Label>
                <Select
                  items={Object.fromEntries(METHODS)}
                  value={method}
                  onValueChange={(v) => setMethod(v as DepositMethod)}
                >
                  <SelectTrigger id={methodId} className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={saving}
                onClick={() => void handleAdd()}
              >
                {saving ? "Saving…" : "Record"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={saving}
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
          ) : balance.settled ? null : (
            <button
              type="button"
              onClick={() => {
                // Pre-fill with what's outstanding — settling in full is the
                // common case, and typing it again invites a typo.
                setAmount(String(balance.balanceDue));
                setAdding(true);
              }}
              className="flex w-full items-center gap-1 border-t px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <Plus className="size-3.5" /> Record a payment
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
