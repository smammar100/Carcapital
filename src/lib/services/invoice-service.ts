import { mockInvoices } from "@/lib/mock-data";
import type { Invoice, InvoiceType, UUID } from "@/lib/types";
import { delay } from "./_base";

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
};
