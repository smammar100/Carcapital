import { mockInvoices, mockVehicles } from "@/lib/mock-data";
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePayment,
  InvoiceStatus,
  InvoiceType,
  UUID,
  VatScheme,
} from "@/lib/types";
import { VAT_RATE } from "@/lib/constants";
import { calculateVat } from "@/lib/vat";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";

interface CreateInput {
  companyId: UUID;
  type: InvoiceType;
  vehicleId: UUID | null;
  partyName: string;
  partyPhone: string | null;
  partyEmail: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  buyerEmail?: string | null;
  buyerAddress?: string | null;
  invoiceDate: string;
  dueDate: string | null;
  vatScheme: VatScheme;
  lineItems: Omit<InvoiceLineItem, "id" | "subtotal" | "vatAmount">[];
  payment?: Omit<InvoicePayment, "id" | "invoiceId" | "balanceDue"> | null;
  notes: string | null;
  attachmentUrl: string | null;
}

interface InvoiceTotals {
  lineItems: InvoiceLineItem[];
  subtotal: number;
  addonsTotal: number;
  discountTotal: number;
  vatAmount: number;
  total: number;
}

function nextInvoiceNumber(type: InvoiceType, companyId: UUID): string {
  const sameType = mockInvoices.filter(
    (i) => i.companyId === companyId && i.type === type,
  );
  const year = new Date().getFullYear();
  const count = sameType.length + 1;
  const prefix = type === "purchase" ? "PUR" : "INV";
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}

/**
 * Compute per-line subtotals + VAT amounts under the chosen scheme, plus the
 * invoice-level rollups (subtotal, addonsTotal, discountTotal, vatAmount,
 * total). Vehicle line gets the margin treatment when scheme === "margin"
 * and a vehicle cost is available.
 */
function computeTotals(
  rawLines: Omit<InvoiceLineItem, "id" | "subtotal" | "vatAmount">[],
  vatScheme: VatScheme,
  vehicleId: UUID | null,
): InvoiceTotals {
  const vehicle = vehicleId ? mockVehicles.find((v) => v.id === vehicleId) : null;
  const vehicleCost = vehicle?.totalBuyingPrice ?? vehicle?.buyingPrice ?? 0;

  const lineItems: InvoiceLineItem[] = rawLines.map((li, i) => {
    const subtotal = Math.round(li.quantity * li.unitPrice * 100) / 100;
    const { vatAmount } = calculateVat({
      scheme: vatScheme,
      lineNet: subtotal,
      isVehicleLine: li.lineType === "vehicle",
      vehicleCost,
    });
    return {
      ...li,
      id: `${newId("li")}-${i}`,
      subtotal,
      vatAmount,
    };
  });

  let subtotal = 0;
  let addonsTotal = 0;
  let discountTotal = 0;
  let vatAmount = 0;
  for (const li of lineItems) {
    subtotal += li.subtotal;
    if (li.lineType === "addon") addonsTotal += li.subtotal;
    if (li.lineType === "discount") discountTotal += li.subtotal;
    vatAmount += li.vatAmount;
  }
  const total = subtotal + vatAmount;
  return {
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
    addonsTotal: Math.round(addonsTotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export const invoiceService = {
  async getAll(companyId: UUID): Promise<Invoice[]> {
    // TODO: Supabase: from('invoices').select('*, line_items(*), payment(*)').eq('company_id', companyId)
    await delay();
    return mockInvoices
      .filter((i) => i.companyId === companyId)
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  },

  async getByType(companyId: UUID, type: InvoiceType): Promise<Invoice[]> {
    // TODO: Supabase: ... .eq('type', type)
    await delay();
    return mockInvoices.filter(
      (i) => i.companyId === companyId && i.type === type,
    );
  },

  async getById(id: UUID): Promise<Invoice | null> {
    // TODO: Supabase: ... .eq('id', id).single()
    await delay(150);
    return mockInvoices.find((i) => i.id === id) ?? null;
  },

  async create(input: CreateInput, actorId: UUID): Promise<Invoice> {
    // TODO: Supabase: insert + log
    await delay();
    const totals = computeTotals(input.lineItems, input.vatScheme, input.vehicleId);
    const id = newId("inv");
    let payment: InvoicePayment | null = null;
    if (input.payment) {
      const balanceDue =
        Math.round(
          (totals.total - input.payment.depositAmount - input.payment.financeAmount) *
            100,
        ) / 100;
      payment = {
        id: newId("pay"),
        invoiceId: id,
        depositAmount: input.payment.depositAmount,
        depositMethod: input.payment.depositMethod,
        financeAmount: input.payment.financeAmount,
        financeProvider: input.payment.financeProvider,
        balanceDue,
        balanceDueBy: input.payment.balanceDueBy,
      };
    }
    const invoice: Invoice = {
      id,
      companyId: input.companyId,
      type: input.type,
      vehicleId: input.vehicleId,
      partyName: input.partyName,
      partyPhone: input.partyPhone,
      partyEmail: input.partyEmail,
      buyerName: input.buyerName ?? (input.type === "sale" ? input.partyName : null),
      buyerPhone: input.buyerPhone ?? (input.type === "sale" ? input.partyPhone : null),
      buyerEmail: input.buyerEmail ?? (input.type === "sale" ? input.partyEmail : null),
      buyerAddress: input.buyerAddress ?? null,
      invoiceNumber: nextInvoiceNumber(input.type, input.companyId),
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      vatScheme: input.vatScheme,
      lineItems: totals.lineItems,
      subtotal: totals.subtotal,
      addonsTotal: totals.addonsTotal,
      discountTotal: totals.discountTotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      payment,
      status: "draft",
      notes: input.notes,
      attachmentUrl: input.attachmentUrl,
      createdAt: nowIso(),
    };
    mockInvoices.push(invoice);
    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: input.vehicleId,
      actionType: "invoice_created",
      description: `Invoice ${invoice.invoiceNumber} (${input.type}) created — ${input.partyName}`,
      metadata: { invoiceId: invoice.id, total: invoice.total },
    });
    return invoice;
  },

  async updateStatus(
    id: UUID,
    status: InvoiceStatus,
    actorId: UUID,
  ): Promise<Invoice> {
    // TODO: Supabase: update
    await delay();
    const idx = mockInvoices.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error("Invoice not found");
    mockInvoices[idx] = { ...mockInvoices[idx], status };
    if (status === "sent") {
      await activityService.log({
        companyId: mockInvoices[idx].companyId,
        userId: actorId,
        vehicleId: mockInvoices[idx].vehicleId,
        actionType: "invoice_sent",
        description: `${mockInvoices[idx].invoiceNumber} sent to ${mockInvoices[idx].partyName}`,
        metadata: { invoiceId: id },
      });
    } else if (status === "paid") {
      await activityService.log({
        companyId: mockInvoices[idx].companyId,
        userId: actorId,
        vehicleId: mockInvoices[idx].vehicleId,
        actionType: "invoice_paid",
        description: `${mockInvoices[idx].invoiceNumber} marked paid`,
        metadata: { invoiceId: id },
      });
    }
    return mockInvoices[idx];
  },

  async vatSummary(
    companyId: UUID,
    fromDate?: string,
    toDate?: string,
  ): Promise<{ inputVat: number; outputVat: number; net: number }> {
    // TODO: Supabase: SELECT type, SUM(vat_amount) GROUP BY type
    await delay(100);
    const inRange = (d: string) =>
      (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    let inputVat = 0;
    let outputVat = 0;
    for (const i of mockInvoices) {
      if (i.companyId !== companyId) continue;
      if (!inRange(i.invoiceDate)) continue;
      if (i.type === "purchase") inputVat += i.vatAmount;
      else outputVat += i.vatAmount;
    }
    return {
      inputVat: Math.round(inputVat * 100) / 100,
      outputVat: Math.round(outputVat * 100) / 100,
      net: Math.round((outputVat - inputVat) * 100) / 100,
    };
  },
};

export const VAT = VAT_RATE;
