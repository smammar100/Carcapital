import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
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
import { activityService } from "./activity-service";

const NS = "invoices:";

const INVOICE_SELECT = `
  id,
  companyId:company_id,
  type,
  vehicleId:vehicle_id,
  partyName:party_name,
  partyPhone:party_phone,
  partyEmail:party_email,
  buyerName:buyer_name,
  buyerPhone:buyer_phone,
  buyerEmail:buyer_email,
  buyerAddress:buyer_address,
  invoiceNumber:invoice_number,
  invoiceDate:invoice_date,
  dueDate:due_date,
  vatScheme:vat_scheme,
  subtotal,
  addonsTotal:addons_total,
  discountTotal:discount_total,
  vatAmount:vat_amount,
  total,
  status,
  notes,
  attachmentUrl:attachment_url,
  createdAt:created_at,
  lineItems:invoice_line_items (
    id,
    lineType:line_type,
    addonType:addon_type,
    description,
    quantity,
    unitPrice:unit_price,
    vatRate:vat_rate,
    subtotal,
    vatAmount:vat_amount
  ),
  payment:invoice_payments (
    id,
    invoiceId:invoice_id,
    depositAmount:deposit_amount,
    depositMethod:deposit_method,
    financeAmount:finance_amount,
    financeProvider:finance_provider,
    balanceDue:balance_due,
    balanceDueBy:balance_due_by
  )
`;

function normalizeInvoice(row: unknown): Invoice {
  const r = row as Record<string, unknown>;
  // payment comes back as an array (1-to-1 child); pick the single element.
  const payments = r.payment as InvoicePayment[] | InvoicePayment | null | undefined;
  const payment: InvoicePayment | null = Array.isArray(payments)
    ? (payments[0] ?? null)
    : (payments ?? null);
  return { ...(r as unknown as Invoice), payment };
}

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

function computeTotals(
  rawLines: Omit<InvoiceLineItem, "id" | "subtotal" | "vatAmount">[],
  vatScheme: VatScheme,
  vehicleCost: number,
): InvoiceTotals {
  const lineItems: InvoiceLineItem[] = rawLines.map((li) => {
    const subtotal = Math.round(li.quantity * li.unitPrice * 100) / 100;
    const { vatAmount } = calculateVat({
      scheme: vatScheme,
      lineNet: subtotal,
      isVehicleLine: li.lineType === "vehicle",
      vehicleCost,
    });
    return {
      ...li,
      // Real IDs are minted by the DB on INSERT; this is only used in-memory.
      id: "",
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
  return {
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
    addonsTotal: Math.round(addonsTotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    total: Math.round((subtotal + vatAmount) * 100) / 100,
  };
}

export const invoiceService = {
  async getAll(companyId: UUID): Promise<Invoice[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .eq("company_id", companyId)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalizeInvoice);
    });
  },

  async getByType(companyId: UUID, type: InvoiceType): Promise<Invoice[]> {
    return withCache(`${NS}type:${companyId}:${type}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .eq("company_id", companyId)
        .eq("type", type);
      if (error) throw error;
      return (data ?? []).map(normalizeInvoice);
    });
  },

  async getById(id: UUID): Promise<Invoice | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeInvoice(data) : null;
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<Invoice> {
    const supabase = createClient();

    // Fetch vehicle cost for margin scheme calc.
    let vehicleCost = 0;
    if (input.vehicleId) {
      const { data: veh } = await supabase
        .from("vehicles")
        .select("totalBuyingPrice:total_buying_price, buyingPrice:buying_price")
        .eq("id", input.vehicleId)
        .maybeSingle();
      const v = veh as { totalBuyingPrice: number | null; buyingPrice: number | null } | null;
      vehicleCost = v?.totalBuyingPrice ?? v?.buyingPrice ?? 0;
    }

    const totals = computeTotals(input.lineItems, input.vatScheme, vehicleCost);

    // Atomically reserve a new invoice number.
    const { data: invoiceNumber, error: rpcErr } = await supabase.rpc(
      "next_invoice_number",
      { p_company_id: input.companyId, p_type: input.type },
    );
    if (rpcErr) throw rpcErr;

    const { data: invRow, error: invErr } = await supabase
      .from("invoices")
      .insert({
        company_id: input.companyId,
        type: input.type,
        vehicle_id: input.vehicleId,
        party_name: input.partyName,
        party_phone: input.partyPhone,
        party_email: input.partyEmail,
        buyer_name:
          input.buyerName ??
          (input.type === "sale" ? input.partyName : null),
        buyer_phone:
          input.buyerPhone ??
          (input.type === "sale" ? input.partyPhone : null),
        buyer_email:
          input.buyerEmail ??
          (input.type === "sale" ? input.partyEmail : null),
        buyer_address: input.buyerAddress ?? null,
        invoice_number: invoiceNumber,
        invoice_date: input.invoiceDate,
        due_date: input.dueDate,
        vat_scheme: input.vatScheme,
        subtotal: totals.subtotal,
        addons_total: totals.addonsTotal,
        discount_total: totals.discountTotal,
        vat_amount: totals.vatAmount,
        total: totals.total,
        status: "draft",
        notes: input.notes,
        attachment_url: input.attachmentUrl,
      })
      .select("id")
      .single();
    if (invErr) throw invErr;
    const invoiceId = (invRow as { id: string }).id;

    // Insert line items.
    if (totals.lineItems.length > 0) {
      const { error } = await supabase.from("invoice_line_items").insert(
        totals.lineItems.map((li, i) => ({
          invoice_id: invoiceId,
          line_type: li.lineType,
          addon_type: li.addonType,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unitPrice,
          vat_rate: li.vatRate,
          subtotal: li.subtotal,
          vat_amount: li.vatAmount,
          sort_order: i,
        })),
      );
      if (error) throw error;
    }

    // Insert payment if provided.
    if (input.payment) {
      const balanceDue =
        Math.round(
          (totals.total -
            input.payment.depositAmount -
            input.payment.financeAmount) *
            100,
        ) / 100;
      const { error } = await supabase.from("invoice_payments").insert({
        invoice_id: invoiceId,
        deposit_amount: input.payment.depositAmount,
        deposit_method: input.payment.depositMethod,
        finance_amount: input.payment.financeAmount,
        finance_provider: input.payment.financeProvider,
        balance_due: balanceDue,
        balance_due_by: input.payment.balanceDueBy,
      });
      if (error) throw error;
    }

    // Invalidate before the read-back so the fresh row is fetched.
    invalidate(NS);

    // Re-fetch the full record with children and log.
    const created = await invoiceService.getById(invoiceId);
    if (!created) throw new Error("Failed to read back created invoice");

    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: input.vehicleId,
      actionType: "invoice_created",
      description: `Invoice ${created.invoiceNumber} (${input.type}) created — ${input.partyName}`,
      metadata: { invoiceId: created.id, total: created.total },
    });
    return created;
  },

  async updateStatus(
    id: UUID,
    status: InvoiceStatus,
    actorId: UUID,
  ): Promise<Invoice> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", id)
      .select(INVOICE_SELECT)
      .single();
    if (error) throw error;
    const invoice = normalizeInvoice(data);
    invalidate(NS);
    if (status === "sent") {
      await activityService.log({
        companyId: invoice.companyId,
        userId: actorId,
        vehicleId: invoice.vehicleId,
        actionType: "invoice_sent",
        description: `${invoice.invoiceNumber} sent to ${invoice.partyName}`,
        metadata: { invoiceId: id },
      });
    } else if (status === "paid") {
      await activityService.log({
        companyId: invoice.companyId,
        userId: actorId,
        vehicleId: invoice.vehicleId,
        actionType: "invoice_paid",
        description: `${invoice.invoiceNumber} marked paid`,
        metadata: { invoiceId: id },
      });
    }
    return invoice;
  },

  async vatSummary(
    companyId: UUID,
    fromDate?: string,
    toDate?: string,
  ): Promise<{ inputVat: number; outputVat: number; net: number }> {
    return withCache(
      `${NS}vat-summary:${companyId}:${fromDate ?? ""}:${toDate ?? ""}`,
      async () => {
        const supabase = createClient();
        let query = supabase
          .from("invoices")
          .select("type, vat_amount, invoice_date")
          .eq("company_id", companyId);
        if (fromDate) query = query.gte("invoice_date", fromDate);
        if (toDate) query = query.lte("invoice_date", toDate);
        const { data, error } = await query;
        if (error) throw error;
        let inputVat = 0;
        let outputVat = 0;
        for (const row of (data ?? []) as Array<{
          type: string;
          vat_amount: number;
        }>) {
          if (row.type === "purchase") inputVat += row.vat_amount;
          else outputVat += row.vat_amount;
        }
        return {
          inputVat: Math.round(inputVat * 100) / 100,
          outputVat: Math.round(outputVat * 100) / 100,
          net: Math.round((outputVat - inputVat) * 100) / 100,
        };
      },
    );
  },
};

export const VAT = VAT_RATE;
