"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  companyInvoiceFields,
  downloadBlob,
  openBlobInNewTab,
  pdfService,
} from "@/lib/services/pdf-service";
import { toast } from "@/lib/toast";
import { InvoicePaymentsPanel } from "./invoice-payments-panel";
import type { Company, Invoice, Vehicle } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * In-app invoice detail modal (line items + totals + Download PDF / Print).
 * Extracted from the Invoicing page so it can open in place wherever an invoice
 * is surfaced — e.g. Closed Deals — instead of navigating away (GEN-42).
 * Open when `invoice` is non-null.
 */
export function InvoiceDetailDialog({
  invoice,
  company,
  vehicle,
  onOpenChange,
  onChanged,
}: {
  invoice: Invoice | null;
  company: Company | null;
  /** Optional linked vehicle so the PDF can render Make/Model/VRM. */
  vehicle?: Vehicle | null;
  onOpenChange: (open: boolean) => void;
  /** Fired when a payment changes the invoice, so the list can re-read it. */
  onChanged?: () => void;
}) {
  async function build(): Promise<Blob | null> {
    if (!company || !invoice) return null;
    return pdfService.generateInvoice({
      invoice,
      vehicle: vehicle ?? null,
      ...companyInvoiceFields(company),
    });
  }
  async function download(): Promise<void> {
    try {
      const blob = await build();
      if (blob && invoice) downloadBlob(blob, `${invoice.invoiceNumber}.pdf`);
    } catch {
      toast.error("Couldn't generate the invoice PDF.");
    }
  }
  async function print(): Promise<void> {
    try {
      const blob = await build();
      if (blob) openBlobInNewTab(blob);
    } catch {
      toast.error("Couldn't open the invoice for printing.");
    }
  }

  return (
    <Dialog open={invoice !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {invoice && (
          <>
            <DialogHeader>
              <DialogTitle>{invoice.invoiceNumber}</DialogTitle>
              <DialogDescription>
                {invoice.partyName} · {formatDate(invoice.invoiceDate)}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto px-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-2 font-medium">Description</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Qty</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Unit</th>
                    <th className="py-1.5 pr-2 text-right font-medium">VAT</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((li) => (
                    <tr key={li.id} className="border-b last:border-b-0">
                      <td className="py-1.5 pr-2">{li.description}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {li.quantity}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {formatCurrency(li.unitPrice)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {formatCurrency(li.vatAmount)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {formatCurrency(li.total + li.vatAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-1 px-6 pb-6 text-right text-sm tabular-nums">
              <div>Subtotal: {formatCurrency(invoice.subtotal)}</div>
              <div>VAT: {formatCurrency(invoice.vatAmount)}</div>
              <div className="text-base font-semibold">
                Total: {formatCurrency(invoice.total)}
              </div>
            </div>
            {/* Payments + running balance (GEN-73). Sale invoices only —
                purchase and refund invoices aren't collected against here. */}
            {invoice.type === "sale" ? (
              <InvoicePaymentsPanel invoice={invoice} onChanged={onChanged} />
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => void download()}>
                Download PDF
              </Button>
              <Button onClick={() => void print()}>Print</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
