import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceLineItemType,
  InvoiceLineType,
  InvoicePayment,
  InvoiceStatus,
  InvoiceType,
  PreDeliveryCheck,
  UUID,
  VatScheme,
  WarrantyDeclaration,
} from "@/lib/types";
import { calculateVat } from "@/lib/vat";
import { computeInvoiceTotals } from "@/lib/invoice-calc";
import { activityService } from "./activity-service";

const NS = "invoices:";

// All columns from migration 0008 are applied, but the migration-0001
// related_* columns are still guarded by the BASE/INVOICE split so an
// un-applied 0001 cannot break the invoices list.
const BASE_INVOICE_SELECT = `
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
  buyerPostcode:buyer_postcode,
  invoiceNumber:invoice_number,
  invoiceDate:invoice_date,
  dueDate:due_date,
  vatScheme:vat_scheme,
  subtotal,
  addonsTotal:addons_total,
  discountTotal:discount_total,
  vatAmount:vat_amount,
  total,
  presentMileage:present_mileage,
  dorDate:dor_date,
  salesPrice:sales_price,
  discount,
  paidAddonsTotal:paid_addons_total,
  grandTotalInclAddons:grand_total_incl_addons,
  depositAmount:deposit_amount,
  depositReceivedDate:deposit_received_date,
  depositMethod:deposit_method,
  financeAmount:finance_amount,
  financeProvider:finance_provider,
  balanceDue:balance_due,
  balanceDueBy:balance_due_by,
  warranty,
  nonWarrantyDisclaimerAccepted:non_warranty_disclaimer_accepted,
  preDeliveryCheck:pre_delivery_check,
  includeUnitStockingNote:include_unit_stocking_note,
  includeIdRequirementNote:include_id_requirement_note,
  includeServiceHistoryNote:include_service_history_note,
  customNote:custom_note,
  saleId:sale_id,
  createdBy:created_by,
  issuedAt:issued_at,
  status,
  notes,
  attachmentUrl:attachment_url,
  createdAt:created_at,
  lineItems:invoice_line_items (
    id,
    lineType:line_type,
    addonType:addon_type,
    itemType:item_type,
    addonCategory:addon_category,
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

const INVOICE_SELECT = `
  ${BASE_INVOICE_SELECT},
  relatedReturnId:related_return_id,
  relatedInvoiceId:related_invoice_id
`;

/** PostgREST undefined_column → migration 0001 related_* not applied yet. */
function isMissingColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    e?.code === "42703" || /column .* does not exist/i.test(e?.message ?? "")
  );
}

const num = (v: unknown): number =>
  typeof v === "number" ? v : v == null ? 0 : Number(v) || 0;

function lineTypeToItemType(lt: InvoiceLineType, unit: number): InvoiceLineItemType {
  if (lt === "vehicle") return "vehicle_price";
  if (lt === "discount") return "discount";
  // addon / fee
  return unit > 0 ? "addon_paid" : "addon_free";
}

function itemTypeToLineType(it: InvoiceLineItemType): InvoiceLineType {
  if (it === "vehicle_price") return "vehicle";
  if (it === "discount") return "discount";
  return "addon";
}

function normalizeLine(raw: Record<string, unknown>): InvoiceLineItem {
  const legacyLineType = (raw.lineType as InvoiceLineType | null) ?? "addon";
  const unit = num(raw.unitPrice);
  const itemType =
    (raw.itemType as InvoiceLineItemType | null) ??
    lineTypeToItemType(legacyLineType, unit);
  const total = num(raw.subtotal);
  return {
    id: String(raw.id ?? ""),
    type: itemType,
    description: String(raw.description ?? ""),
    addonCategory:
      (raw.addonCategory as InvoiceLineItem["addonCategory"]) ??
      (raw.addonType as InvoiceLineItem["addonCategory"]) ??
      null,
    quantity: num(raw.quantity),
    unitPrice: unit,
    total,
    vatAmount: num(raw.vatAmount),
    // legacy aliases retained for the invoicing list / refund flow
    lineType: legacyLineType,
    addonType: (raw.addonType as InvoiceLineItem["addonType"]) ?? null,
    subtotal: total,
    vatRate: num(raw.vatRate),
  };
}

function normalizeInvoice(row: unknown): Invoice {
  const r = row as Record<string, unknown>;
  const payments = r.payment as
    | InvoicePayment[]
    | InvoicePayment
    | null
    | undefined;
  const payment: InvoicePayment | null = Array.isArray(payments)
    ? (payments[0] ?? null)
    : (payments ?? null);

  const rawLines = (r.lineItems as Record<string, unknown>[] | null) ?? [];
  const lineItems = rawLines.map(normalizeLine);

  const total = num(r.grandTotalInclAddons) || num(r.total);

  return {
    id: String(r.id),
    companyId: String(r.companyId),
    type: r.type as InvoiceType,
    vehicleId: (r.vehicleId as string | null) ?? null,
    partyName: String(r.partyName ?? ""),
    partyPhone: (r.partyPhone as string | null) ?? null,
    partyEmail: (r.partyEmail as string | null) ?? null,
    buyerName: (r.buyerName as string | null) ?? null,
    buyerPhone: (r.buyerPhone as string | null) ?? null,
    buyerEmail: (r.buyerEmail as string | null) ?? null,
    buyerAddress: (r.buyerAddress as string | null) ?? null,
    buyerPostcode: (r.buyerPostcode as string | null) ?? null,
    invoiceNumber: String(r.invoiceNumber ?? ""),
    invoiceDate: String(r.invoiceDate ?? ""),
    dueDate: (r.dueDate as string | null) ?? null,
    vatScheme: (r.vatScheme as VatScheme) ?? "margin_used",
    lineItems,
    presentMileage: (r.presentMileage as number | null) ?? null,
    dorDate: (r.dorDate as string | null) ?? null,
    salesPrice: num(r.salesPrice),
    discount: num(r.discount),
    paidAddonsTotal: num(r.paidAddonsTotal),
    grandTotalInclAddons: total,
    depositAmount: num(r.depositAmount),
    depositReceivedDate: (r.depositReceivedDate as string | null) ?? null,
    depositMethod:
      (r.depositMethod as Invoice["depositMethod"]) ??
      payment?.depositMethod ??
      null,
    financeAmount: num(r.financeAmount) || num(payment?.financeAmount),
    financeProvider:
      (r.financeProvider as string | null) ??
      payment?.financeProvider ??
      null,
    balanceDue: num(r.balanceDue) || num(payment?.balanceDue),
    balanceDueBy:
      (r.balanceDueBy as string | null) ?? payment?.balanceDueBy ?? null,
    warranty: (r.warranty as WarrantyDeclaration | null) ?? null,
    nonWarrantyDisclaimerAccepted: Boolean(r.nonWarrantyDisclaimerAccepted),
    preDeliveryCheck: (r.preDeliveryCheck as PreDeliveryCheck | null) ?? null,
    includeUnitStockingNote: r.includeUnitStockingNote !== false,
    includeIdRequirementNote: r.includeIdRequirementNote !== false,
    includeServiceHistoryNote: r.includeServiceHistoryNote !== false,
    customNote: (r.customNote as string | null) ?? null,
    subtotal: num(r.subtotal),
    addonsTotal: num(r.addonsTotal),
    discountTotal: num(r.discountTotal),
    vatAmount: num(r.vatAmount),
    total,
    payment,
    status: (r.status as InvoiceStatus) ?? "draft",
    notes: (r.notes as string | null) ?? null,
    attachmentUrl: (r.attachmentUrl as string | null) ?? null,
    relatedReturnId: (r.relatedReturnId as string | null) ?? null,
    relatedInvoiceId: (r.relatedInvoiceId as string | null) ?? null,
    saleId: (r.saleId as string | null) ?? null,
    createdBy: (r.createdBy as string | null) ?? null,
    issuedAt: (r.issuedAt as string | null) ?? null,
    createdAt: String(r.createdAt ?? ""),
  };
}

type RawLine = Omit<InvoiceLineItem, "id" | "vatAmount">;

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
  buyerPostcode?: string | null;
  invoiceDate: string;
  dueDate: string | null;
  vatScheme: VatScheme;
  lineItems: RawLine[];
  payment?: Omit<InvoicePayment, "id" | "invoiceId" | "balanceDue"> | null;
  notes: string | null;
  attachmentUrl: string | null;
  relatedReturnId?: UUID | null;
  relatedInvoiceId?: UUID | null;
  // ---- SPEC sales-only fields (ignored on legacy purchase/refund) ----
  presentMileage?: number | null;
  dorDate?: string | null;
  depositAmount?: number;
  depositReceivedDate?: string | null;
  depositMethod?: Invoice["depositMethod"];
  financeAmount?: number;
  financeProvider?: string | null;
  balanceDueBy?: string | null;
  warranty?: WarrantyDeclaration | null;
  nonWarrantyDisclaimerAccepted?: boolean;
  preDeliveryCheck?: PreDeliveryCheck | null;
  includeUnitStockingNote?: boolean;
  includeIdRequirementNote?: boolean;
  includeServiceHistoryNote?: boolean;
  customNote?: string | null;
  saleId?: UUID | null;
  status?: InvoiceStatus;
  /**
   * Force the recorded VAT (used by refund/credit invoices to reverse the exact
   * proportional output VAT of the original sale, so the VAT summary balances).
   */
  vatAmountOverride?: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function lineGroup(li: RawLine): "vehicle" | "addon" | "discount" {
  const t = li.type ?? lineTypeToItemType(li.lineType ?? "addon", li.unitPrice);
  if (t === "vehicle_price") return "vehicle";
  if (t === "discount") return "discount";
  return "addon";
}

/** Per-line VAT + legacy aggregate totals (used by both branches). */
function legacyTotals(
  rawLines: RawLine[],
  vatScheme: VatScheme,
  vehicleCost: number,
) {
  const lines = rawLines.map((li) => {
    const sub = round2(li.quantity * li.unitPrice);
    const grp = lineGroup(li);
    // Discount lines carry a POSITIVE subtotal but must reduce the net total
    // and its VAT — feed the VAT engine a negative net for them.
    const { vatAmount } = calculateVat({
      scheme: vatScheme,
      lineNet: grp === "discount" ? -sub : sub,
      isVehicleLine: grp === "vehicle",
      vehicleCost,
    });
    return { li, sub, grp, vatAmount };
  });
  let subtotal = 0;
  let addonsTotal = 0;
  let discountTotal = 0;
  let vatAmount = 0;
  for (const x of lines) {
    // Discounts are stored positive; subtract them from the subtotal.
    subtotal += x.grp === "discount" ? -x.sub : x.sub;
    if (x.grp === "addon") addonsTotal += x.sub;
    if (x.grp === "discount") discountTotal += x.sub;
    vatAmount += x.vatAmount;
  }
  return {
    lines,
    subtotal: round2(subtotal),
    addonsTotal: round2(addonsTotal),
    discountTotal: round2(discountTotal),
    vatAmount: round2(vatAmount),
    total: round2(subtotal + vatAmount),
  };
}

interface PreparedInvoice {
  isSale: boolean;
  lt: ReturnType<typeof legacyTotals>;
  calc: ReturnType<typeof computeInvoiceTotals>;
  depositAmount: number;
  financeAmount: number;
  grandTotal: number;
  balanceDue: number;
}

/** Shared totals computation for create + update (cannot diverge). */
async function prepareInvoice(
  supabase: ReturnType<typeof createClient>,
  input: CreateInput,
): Promise<PreparedInvoice> {
  const isSale = input.type === "sale";
  let vehicleCost = 0;
  if (input.vehicleId) {
    const { data: veh } = await supabase
      .from("vehicles")
      .select("totalBuyingPrice:total_buying_price, buyingPrice:buying_price")
      .eq("id", input.vehicleId)
      .maybeSingle();
    const v = veh as {
      totalBuyingPrice: number | null;
      buyingPrice: number | null;
    } | null;
    vehicleCost = v?.totalBuyingPrice ?? v?.buyingPrice ?? 0;
  }
  const lt = legacyTotals(input.lineItems, input.vatScheme, vehicleCost);
  const depositAmount =
    input.depositAmount ?? input.payment?.depositAmount ?? 0;
  const financeAmount =
    input.financeAmount ?? input.payment?.financeAmount ?? 0;
  const calc = computeInvoiceTotals(
    input.lineItems.map((li, i) => ({
      ...li,
      id: String(i),
      vatAmount: 0,
    })) as InvoiceLineItem[],
    input.vatScheme,
    depositAmount,
    financeAmount,
    vehicleCost,
  );
  const grandTotal = isSale ? calc.grandTotalInclAddons : lt.total;
  const balanceDue = round2(grandTotal - depositAmount - financeAmount);
  return { isSale, lt, calc, depositAmount, financeAmount, grandTotal, balanceDue };
}

/** Mutable invoice columns shared by the create INSERT and update UPDATE. */
function buildInvoiceColumns(
  input: CreateInput,
  p: PreparedInvoice,
  issuedAt: string | null,
  status: InvoiceStatus,
): Record<string, unknown> {
  const { isSale, lt, calc } = p;
  return {
    vehicle_id: input.vehicleId,
    party_name: input.partyName,
    party_phone: input.partyPhone,
    party_email: input.partyEmail,
    buyer_name: input.buyerName ?? (isSale ? input.partyName : null),
    buyer_phone: input.buyerPhone ?? (isSale ? input.partyPhone : null),
    buyer_email: input.buyerEmail ?? (isSale ? input.partyEmail : null),
    buyer_address: input.buyerAddress ?? null,
    buyer_postcode: input.buyerPostcode ?? null,
    invoice_date: input.invoiceDate,
    due_date: input.dueDate,
    vat_scheme: input.vatScheme,
    subtotal: isSale ? calc.subtotal : lt.subtotal,
    addons_total: isSale ? calc.paidAddonsTotal : lt.addonsTotal,
    discount_total: isSale ? -calc.discount : lt.discountTotal,
    vat_amount:
      input.vatAmountOverride ?? (isSale ? calc.vatAmount : lt.vatAmount),
    total: p.grandTotal,
    present_mileage: input.presentMileage ?? null,
    dor_date: input.dorDate ?? null,
    sales_price: isSale ? calc.salesPrice : 0,
    discount: isSale ? calc.discount : 0,
    paid_addons_total: isSale ? calc.paidAddonsTotal : 0,
    grand_total_incl_addons: p.grandTotal,
    deposit_amount: p.depositAmount,
    deposit_received_date: input.depositReceivedDate ?? null,
    deposit_method:
      input.depositMethod ?? input.payment?.depositMethod ?? null,
    finance_amount: p.financeAmount,
    finance_provider:
      input.financeProvider ?? input.payment?.financeProvider ?? null,
    balance_due: p.balanceDue,
    balance_due_by: input.balanceDueBy ?? input.payment?.balanceDueBy ?? null,
    warranty: input.warranty ?? null,
    non_warranty_disclaimer_accepted:
      input.nonWarrantyDisclaimerAccepted ?? false,
    pre_delivery_check: input.preDeliveryCheck ?? null,
    include_unit_stocking_note: input.includeUnitStockingNote ?? true,
    include_id_requirement_note: input.includeIdRequirementNote ?? true,
    include_service_history_note: input.includeServiceHistoryNote ?? true,
    custom_note: input.customNote ?? null,
    sale_id: input.saleId ?? null,
    issued_at: issuedAt,
    status,
    notes: input.notes,
    attachment_url: input.attachmentUrl,
  };
}

function buildLineRows(
  invoiceId: UUID,
  lt: ReturnType<typeof legacyTotals>,
): Record<string, unknown>[] {
  return lt.lines.map((x, i) => {
    const itemType =
      x.li.type ??
      lineTypeToItemType(x.li.lineType ?? "addon", x.li.unitPrice);
    return {
      invoice_id: invoiceId,
      line_type: x.li.lineType ?? itemTypeToLineType(itemType),
      addon_type: x.li.addonType ?? x.li.addonCategory ?? null,
      item_type: itemType,
      addon_category: x.li.addonCategory ?? x.li.addonType ?? null,
      description: x.li.description,
      quantity: x.li.quantity,
      unit_price: x.li.unitPrice,
      vat_rate: x.li.vatRate ?? 0,
      subtotal: x.sub,
      vat_amount: x.vatAmount,
      sort_order: i,
    };
  });
}

export const invoiceService = {
  async getAll(companyId: UUID): Promise<Invoice[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const run = (sel: string) =>
        supabase
          .from("invoices")
          .select(sel)
          .eq("company_id", companyId)
          .order("invoice_date", { ascending: false });
      let { data, error } = await run(INVOICE_SELECT);
      if (error && isMissingColumn(error)) {
        ({ data, error } = await run(BASE_INVOICE_SELECT));
      }
      if (error) throw error;
      return (data ?? []).map(normalizeInvoice);
    });
  },

  async getByType(companyId: UUID, type: InvoiceType): Promise<Invoice[]> {
    return withCache(`${NS}type:${companyId}:${type}`, async () => {
      const supabase = createClient();
      const run = (sel: string) =>
        supabase
          .from("invoices")
          .select(sel)
          .eq("company_id", companyId)
          .eq("type", type);
      let { data, error } = await run(INVOICE_SELECT);
      if (error && isMissingColumn(error)) {
        ({ data, error } = await run(BASE_INVOICE_SELECT));
      }
      if (error) throw error;
      return (data ?? []).map(normalizeInvoice);
    });
  },

  async getByVehicle(
    companyId: UUID,
    vehicleId: UUID,
    type?: InvoiceType,
  ): Promise<Invoice[]> {
    const supabase = createClient();
    const run = (sel: string) => {
      let q = supabase
        .from("invoices")
        .select(sel)
        .eq("company_id", companyId)
        .eq("vehicle_id", vehicleId);
      if (type) q = q.eq("type", type);
      return q.order("invoice_date", { ascending: false });
    };
    let { data, error } = await run(INVOICE_SELECT);
    if (error && isMissingColumn(error)) {
      ({ data, error } = await run(BASE_INVOICE_SELECT));
    }
    if (error) throw error;
    return (data ?? []).map(normalizeInvoice);
  },

  async getById(id: UUID): Promise<Invoice | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const run = (sel: string) =>
        supabase.from("invoices").select(sel).eq("id", id).maybeSingle();
      let { data, error } = await run(INVOICE_SELECT);
      if (error && isMissingColumn(error)) {
        ({ data, error } = await run(BASE_INVOICE_SELECT));
      }
      if (error) throw error;
      return data ? normalizeInvoice(data) : null;
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<Invoice> {
    const supabase = createClient();
    const p = await prepareInvoice(supabase, input);

    // Invoice number: sales use the CC-INV-NNNN sequence; everything else
    // keeps the existing PUR/INV/REF-YYYY-NNNN RPC untouched.
    let invoiceNumber: string;
    if (p.isSale) {
      const { data, error } = await supabase.rpc("next_cc_invoice_number", {
        p_company_id: input.companyId,
      });
      if (error) throw error;
      invoiceNumber = data as string;
    } else {
      const { data, error } = await supabase.rpc("next_invoice_number", {
        p_company_id: input.companyId,
        p_type: input.type,
      });
      if (error) throw error;
      invoiceNumber = data as string;
    }

    const status = input.status ?? (p.isSale ? "issued" : "draft");
    const issuedAt = status !== "draft" ? new Date().toISOString() : null;

    const { data: invRow, error: invErr } = await supabase
      .from("invoices")
      .insert({
        company_id: input.companyId,
        type: input.type,
        invoice_number: invoiceNumber,
        created_by: actorId,
        ...buildInvoiceColumns(input, p, issuedAt, status),
      } as never)
      .select("id")
      .single();
    if (invErr) throw invErr;
    const invoiceId = (invRow as { id: string }).id;

    if (p.lt.lines.length > 0) {
      const { error } = await supabase
        .from("invoice_line_items")
        .insert(buildLineRows(invoiceId, p.lt) as never);
      if (error) throw error;
    }

    if (input.payment || p.depositAmount > 0 || p.financeAmount > 0) {
      const { error } = await supabase.from("invoice_payments").insert({
        invoice_id: invoiceId,
        deposit_amount: p.depositAmount,
        deposit_method:
          input.depositMethod ?? input.payment?.depositMethod ?? null,
        finance_amount: p.financeAmount,
        finance_provider:
          input.financeProvider ?? input.payment?.financeProvider ?? null,
        balance_due: p.balanceDue,
        balance_due_by:
          input.balanceDueBy ?? input.payment?.balanceDueBy ?? null,
      });
      if (error) throw error;
    }

    if (
      input.relatedReturnId !== undefined ||
      input.relatedInvoiceId !== undefined
    ) {
      const link: Record<string, unknown> = {};
      if (input.relatedReturnId !== undefined)
        link.related_return_id = input.relatedReturnId;
      if (input.relatedInvoiceId !== undefined)
        link.related_invoice_id = input.relatedInvoiceId;
      const { error: linkErr } = await supabase
        .from("invoices")
        .update(link as unknown as TableUpdate<"invoices">)
        .eq("id", invoiceId);
      if (linkErr && !isMissingColumn(linkErr)) throw linkErr;
    }

    invalidate(NS);

    const created = await invoiceService.getById(invoiceId);
    if (!created) throw new Error("Failed to read back created invoice");

    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: input.vehicleId,
      actionType: "invoice_created",
      description: `Invoice ${created.invoiceNumber} (${input.type}) created: ${input.partyName}`,
      metadata: { invoiceId: created.id, total: created.total },
    });
    return created;
  },

  /**
   * Full edit of a non-paid invoice. Identity (number/type/company) and
   * created_by are preserved; totals + line items + payment are recomputed
   * and replaced. The 2-page PDF is regenerated by the caller.
   */
  async update(
    id: UUID,
    input: CreateInput,
    actorId: UUID,
  ): Promise<Invoice> {
    const supabase = createClient();
    const existing = await invoiceService.getById(id);
    if (!existing) throw new Error("Invoice not found");
    if (existing.status === "paid")
      throw new Error("Paid invoices cannot be edited");
    if (existing.status === "cancelled")
      throw new Error("Cancelled invoices cannot be edited");

    const p = await prepareInvoice(supabase, input);
    const status = input.status ?? existing.status;
    const issuedAt =
      existing.issuedAt ??
      (status !== "draft" ? new Date().toISOString() : null);

    const { error: updErr } = await supabase
      .from("invoices")
      .update(
        buildInvoiceColumns(input, p, issuedAt, status) as unknown as TableUpdate<"invoices">,
      )
      .eq("id", id);
    if (updErr) throw updErr;

    // Replace line items.
    {
      const { error: delErr } = await supabase
        .from("invoice_line_items")
        .delete()
        .eq("invoice_id", id);
      if (delErr) throw delErr;
      if (p.lt.lines.length > 0) {
        const { error } = await supabase
          .from("invoice_line_items")
          .insert(buildLineRows(id, p.lt) as never);
        if (error) throw error;
      }
    }

    // Replace payment.
    {
      const { error: delErr } = await supabase
        .from("invoice_payments")
        .delete()
        .eq("invoice_id", id);
      if (delErr) throw delErr;
      if (input.payment || p.depositAmount > 0 || p.financeAmount > 0) {
        const { error } = await supabase.from("invoice_payments").insert({
          invoice_id: id,
          deposit_amount: p.depositAmount,
          deposit_method:
            input.depositMethod ?? input.payment?.depositMethod ?? null,
          finance_amount: p.financeAmount,
          finance_provider:
            input.financeProvider ?? input.payment?.financeProvider ?? null,
          balance_due: p.balanceDue,
          balance_due_by:
            input.balanceDueBy ?? input.payment?.balanceDueBy ?? null,
        });
        if (error) throw error;
      }
    }

    if (
      input.relatedReturnId !== undefined ||
      input.relatedInvoiceId !== undefined
    ) {
      const link: Record<string, unknown> = {};
      if (input.relatedReturnId !== undefined)
        link.related_return_id = input.relatedReturnId;
      if (input.relatedInvoiceId !== undefined)
        link.related_invoice_id = input.relatedInvoiceId;
      const { error: linkErr } = await supabase
        .from("invoices")
        .update(link as unknown as TableUpdate<"invoices">)
        .eq("id", id);
      if (linkErr && !isMissingColumn(linkErr)) throw linkErr;
    }

    invalidate(NS);

    const updated = await invoiceService.getById(id);
    if (!updated) throw new Error("Failed to read back updated invoice");

    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: input.vehicleId,
      actionType: "invoice_created",
      description: `Invoice ${updated.invoiceNumber} (${input.type}) updated: ${input.partyName}`,
      metadata: { invoiceId: updated.id, total: updated.total },
    });
    return updated;
  },

  async updateStatus(
    id: UUID,
    status: InvoiceStatus,
    actorId: UUID,
  ): Promise<Invoice> {
    const supabase = createClient();
    const run = (sel: string) =>
      supabase
        .from("invoices")
        .update({ status } as never)
        .eq("id", id)
        .select(sel)
        .single();
    let { data, error } = await run(INVOICE_SELECT);
    if (error && isMissingColumn(error)) {
      ({ data, error } = await run(BASE_INVOICE_SELECT));
    }
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
          else if (row.type === "refund") outputVat -= row.vat_amount;
          else outputVat += row.vat_amount;
        }
        return {
          inputVat: round2(inputVat),
          outputVat: round2(outputVat),
          net: round2(outputVat - inputVat),
        };
      },
    );
  },
};
