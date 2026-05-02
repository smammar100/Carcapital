import { mockInvoices } from "@/lib/mock-data";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  InvoiceType,
  UUID,
} from "@/lib/types";
import { VAT_RATE } from "@/lib/constants";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";

interface CreateInput {
  companyId: UUID;
  type: InvoiceType;
  vehicleId: UUID | null;
  partyName: string;
  partyPhone: string | null;
  partyEmail: string | null;
  invoiceDate: string;
  dueDate: string | null;
  lineItems: Omit<InvoiceLineItem, "id">[];
  notes: string | null;
  attachmentUrl: string | null;
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

function totals(lines: { quantity: number; unitPrice: number; vatRate: number }[]) {
  let subtotal = 0;
  let vatAmount = 0;
  for (const li of lines) {
    const lineNet = li.quantity * li.unitPrice;
    subtotal += lineNet;
    vatAmount += lineNet * li.vatRate;
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    total: Math.round((subtotal + vatAmount) * 100) / 100,
  };
}

export const invoiceService = {
  async getAll(companyId: UUID): Promise<Invoice[]> {
    // TODO: Supabase: from('invoices').select('*, line_items(*)').eq('company_id', companyId)
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
    const lineItems: InvoiceLineItem[] = input.lineItems.map((li, i) => ({
      id: `${newId("li")}-${i}`,
      ...li,
    }));
    const t = totals(lineItems);
    const invoice: Invoice = {
      id: newId("inv"),
      companyId: input.companyId,
      type: input.type,
      vehicleId: input.vehicleId,
      partyName: input.partyName,
      partyPhone: input.partyPhone,
      partyEmail: input.partyEmail,
      invoiceNumber: nextInvoiceNumber(input.type, input.companyId),
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      lineItems,
      subtotal: t.subtotal,
      vatAmount: t.vatAmount,
      total: t.total,
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
