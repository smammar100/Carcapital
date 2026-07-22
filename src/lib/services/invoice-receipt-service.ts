import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { DepositMethod, Invoice, UUID } from "@/lib/types";
import {
  computeBalance,
  type BalanceState,
  type Receipt,
} from "@/lib/invoice-balance";
import { activityService } from "./activity-service";
import { invoiceService } from "./invoice-service";

const NS = "invoice-receipts:";

const SELECT = `
  id,
  invoiceId:invoice_id,
  companyId:company_id,
  amount,
  paidOn:paid_on,
  method,
  reference,
  notes,
  recordedBy:recorded_by,
  createdAt:created_at
`;

export interface InvoiceReceipt extends Receipt {
  invoiceId: UUID;
  companyId: UUID;
  notes: string | null;
  recordedBy: UUID | null;
  createdAt: string;
}

interface RecordInput {
  invoiceId: UUID;
  amount: number;
  paidOn?: string;
  method?: DepositMethod | null;
  reference?: string | null;
  notes?: string | null;
}

/**
 * Payments received against an invoice (GEN-73).
 *
 * An invoice used to hold one deposit figure and nothing else, so a second
 * payment had nowhere to go and the balance never moved. Each payment is now
 * its own row; the deposit and finance terms stay on the invoice itself and
 * are netted off alongside them.
 */
export const invoiceReceiptService = {
  async getForInvoice(invoiceId: UUID): Promise<InvoiceReceipt[]> {
    return withCache(`${NS}invoice:${invoiceId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoice_receipts")
        .select(SELECT)
        .eq("invoice_id", invoiceId)
        // Oldest first — a payment history reads as a story, not a stack.
        .order("paid_on", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceReceipt[];
    });
  },

  /** Current money position for an invoice: paid, outstanding, settled. */
  async getBalance(invoice: Invoice): Promise<BalanceState> {
    const receipts = await invoiceReceiptService.getForInvoice(invoice.id);
    return computeBalance({
      grandTotal: invoice.grandTotalInclAddons ?? invoice.total,
      deposit: invoice.depositAmount,
      finance: invoice.financeAmount,
      receipts,
    });
  },

  /**
   * Log a payment and return the resulting position.
   *
   * When it clears the balance the invoice flips to `paid`, which is what the
   * existing completion chain hangs off — so the last payment is what
   * completes the sale, rather than someone remembering to change a status.
   */
  async record(
    input: RecordInput,
    actorId: UUID,
  ): Promise<{ receipt: InvoiceReceipt; balance: BalanceState }> {
    if (!(input.amount > 0)) {
      throw new Error("Payment amount must be more than zero");
    }
    const invoice = await invoiceService.getById(input.invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "cancelled") {
      throw new Error("Can't record a payment against a cancelled invoice");
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("invoice_receipts")
      .insert({
        invoice_id: input.invoiceId,
        company_id: invoice.companyId,
        amount: input.amount,
        paid_on: input.paidOn ?? new Date().toISOString().slice(0, 10),
        method: input.method ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        recorded_by: actorId,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const receipt = data as unknown as InvoiceReceipt;
    invalidate(NS);

    const balance = await invoiceReceiptService.getBalance(invoice);

    await activityService.log({
      companyId: invoice.companyId,
      userId: actorId,
      vehicleId: invoice.vehicleId,
      actionType: "invoice_paid",
      description: balance.settled
        ? `${invoice.invoiceNumber} paid in full`
        : `Payment received on ${invoice.invoiceNumber}, ${balance.balanceDue.toFixed(2)} still due`,
      metadata: {
        invoiceId: invoice.id,
        receiptId: receipt.id,
        amount: input.amount,
        balanceDue: balance.balanceDue,
        settled: balance.settled,
      },
    });

    // Clearing the balance is what marks the invoice paid — and `markPaid` is
    // what the sale-completion chain already listens to.
    if (balance.settled && invoice.status !== "paid") {
      await invoiceService.updateStatus(invoice.id, "paid", actorId);
    }

    return { receipt, balance };
  },

  /** Remove a payment logged in error. */
  async remove(id: UUID, actorId: UUID): Promise<void> {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("invoice_receipts")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();
    const receipt = existing as unknown as InvoiceReceipt | null;

    const { error } = await supabase
      .from("invoice_receipts")
      .delete()
      .eq("id", id);
    if (error) throw error;
    invalidate(NS);

    if (!receipt) return;
    const invoice = await invoiceService.getById(receipt.invoiceId);
    if (!invoice) return;
    await activityService.log({
      companyId: invoice.companyId,
      userId: actorId,
      vehicleId: invoice.vehicleId,
      actionType: "invoice_paid",
      description: `Payment of ${receipt.amount} removed from ${invoice.invoiceNumber}`,
      metadata: { invoiceId: invoice.id, receiptId: id, reversed: true },
    });
  },
};
