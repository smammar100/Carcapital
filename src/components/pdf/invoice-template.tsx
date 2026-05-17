import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Invoice, InvoiceLineItem, InvoiceLineType } from "@/lib/types";
import { formatVatLabel } from "@/lib/vat";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  brand: { fontSize: 18, fontWeight: 700 },
  small: { fontSize: 9, color: "#666" },
  rh: { textAlign: "right" },
  rule: { borderBottom: "1pt solid #ccc", marginVertical: 8 },
  twoCol: { flexDirection: "row", gap: 24, marginBottom: 16 },
  col: { flex: 1 },
  label: {
    fontSize: 8,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  groupLabel: {
    fontSize: 8,
    color: "#666",
    textTransform: "uppercase",
    fontWeight: 700,
    paddingTop: 8,
    paddingBottom: 4,
  },
  table: { borderTop: "1pt solid #ccc" },
  tr: { flexDirection: "row" },
  th: {
    padding: 5,
    backgroundColor: "#f4f4f5",
    borderBottom: "1pt solid #ccc",
    borderRight: "1pt solid #ccc",
    fontWeight: 700,
  },
  td: {
    padding: 5,
    borderBottom: "1pt solid #ccc",
    borderRight: "1pt solid #ccc",
  },
  desc: { flex: 3 },
  qty: { width: 40, textAlign: "right" },
  unit: { width: 80, textAlign: "right" },
  vat: { width: 60, textAlign: "right" },
  line: { width: 80, textAlign: "right" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", marginBottom: 3, gap: 12 },
  totalLabel: { width: 120, textAlign: "right", color: "#666" },
  totalValue: { width: 100, textAlign: "right" },
  big: { fontSize: 12, fontWeight: 700 },
  paymentBox: {
    marginTop: 16,
    padding: 10,
    border: "1pt solid #ccc",
    backgroundColor: "#fafafa",
  },
  paymentTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  paymentBalance: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    marginTop: 4,
    borderTop: "1pt solid #ccc",
    fontWeight: 700,
  },
  vatNote: { marginTop: 12, fontSize: 8, color: "#666", fontStyle: "italic" },
  refundBox: {
    marginTop: 16,
    padding: 10,
    border: "1pt solid #ccc",
    backgroundColor: "#fafafa",
  },
  refundTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  refundLine: { fontSize: 9, marginBottom: 2 },
  refundStatement: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#888",
    textAlign: "center",
  },
});

function fmt(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const GROUP_ORDER: InvoiceLineType[] = ["vehicle", "addon", "fee", "discount"];
const GROUP_LABEL: Record<InvoiceLineType, string> = {
  vehicle: "Vehicle",
  addon: "Add-ons",
  fee: "Fees",
  discount: "Discounts",
};

interface Props {
  invoice: Invoice;
  companyName: string;
  companyAddress: string;
  vatNumber: string | null;
}

export function InvoiceTemplate({
  invoice,
  companyName,
  companyAddress,
  vatNumber,
}: Props) {
  const linesByGroup = new Map<InvoiceLineType, InvoiceLineItem[]>();
  for (const li of invoice.lineItems) {
    const arr = linesByGroup.get(li.lineType) ?? [];
    arr.push(li);
    linesByGroup.set(li.lineType, arr);
  }

  const isRefund = invoice.type === "refund";
  const usesBuyerFields = invoice.type === "sale" || isRefund;
  const buyerName = usesBuyerFields
    ? invoice.buyerName ?? invoice.partyName
    : invoice.partyName;
  const buyerPhone = usesBuyerFields
    ? invoice.buyerPhone ?? invoice.partyPhone
    : invoice.partyPhone;
  const buyerEmail = usesBuyerFields
    ? invoice.buyerEmail ?? invoice.partyEmail
    : invoice.partyEmail;

  const headingTitle =
    invoice.type === "purchase"
      ? "Purchase Invoice"
      : isRefund
        ? "Refund / Cancellation Invoice"
        : "Sales Invoice";
  const billToLabel =
    invoice.type === "purchase"
      ? "Seller / Supplier"
      : isRefund
        ? "Refund To"
        : "Bill To";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>{companyName}</Text>
            <Text style={s.small}>{companyAddress}</Text>
            {vatNumber && <Text style={s.small}>VAT: {vatNumber}</Text>}
          </View>
          <View style={s.rh}>
            <Text style={[s.brand, { fontSize: 14 }]}>{headingTitle}</Text>
            <Text style={s.small}>{invoice.invoiceNumber}</Text>
            <Text style={s.small}>Date: {fmtDate(invoice.invoiceDate)}</Text>
            {invoice.dueDate && (
              <Text style={s.small}>Due: {fmtDate(invoice.dueDate)}</Text>
            )}
          </View>
        </View>

        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.label}>{billToLabel}</Text>
            <Text style={{ fontWeight: 700 }}>{buyerName}</Text>
            {invoice.type === "sale" && invoice.buyerAddress && (
              <Text>{invoice.buyerAddress}</Text>
            )}
            {buyerEmail && <Text>{buyerEmail}</Text>}
            {buyerPhone && <Text>{buyerPhone}</Text>}
          </View>
          <View style={s.col}>
            <Text style={s.label}>Status</Text>
            <Text style={{ textTransform: "uppercase" }}>{invoice.status}</Text>
            <Text style={[s.label, { marginTop: 6 }]}>VAT scheme</Text>
            <Text>{formatVatLabel(invoice.vatScheme)}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, s.desc]}>Description</Text>
            <Text style={[s.th, s.qty]}>Qty</Text>
            <Text style={[s.th, s.unit]}>Unit</Text>
            <Text style={[s.th, s.vat]}>VAT</Text>
            <Text style={[s.th, s.line]}>Line total</Text>
          </View>
          {GROUP_ORDER.map((group) => {
            const lines = linesByGroup.get(group);
            if (!lines || lines.length === 0) return null;
            return (
              <View key={group}>
                <Text style={s.groupLabel}>{GROUP_LABEL[group]}</Text>
                {lines.map((li) => (
                  <View key={li.id} style={s.tr}>
                    <Text style={[s.td, s.desc]}>{li.description}</Text>
                    <Text style={[s.td, s.qty]}>{li.quantity}</Text>
                    <Text style={[s.td, s.unit]}>{fmt(li.unitPrice)}</Text>
                    <Text style={[s.td, s.vat]}>{fmt(li.vatAmount)}</Text>
                    <Text style={[s.td, s.line]}>{fmt(li.subtotal + li.vatAmount)}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalValue}>{fmt(invoice.subtotal)}</Text>
          </View>
          {invoice.addonsTotal > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Add-ons</Text>
              <Text style={s.totalValue}>{fmt(invoice.addonsTotal)}</Text>
            </View>
          )}
          {invoice.discountTotal < 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Discounts</Text>
              <Text style={s.totalValue}>{fmt(invoice.discountTotal)}</Text>
            </View>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>VAT</Text>
            <Text style={s.totalValue}>{fmt(invoice.vatAmount)}</Text>
          </View>
          <View style={[s.totalRow, s.big]}>
            <Text style={s.totalLabel}>Grand Total</Text>
            <Text style={s.totalValue}>{fmt(invoice.total)}</Text>
          </View>
        </View>

        {invoice.payment && (
          <View style={s.paymentBox}>
            <Text style={s.paymentTitle}>Payment breakdown</Text>
            <View style={s.paymentRow}>
              <Text>
                Deposit{invoice.payment.depositMethod ? ` (${invoice.payment.depositMethod.replace("_", " ")})` : ""}
              </Text>
              <Text>{fmt(invoice.payment.depositAmount)}</Text>
            </View>
            <View style={s.paymentRow}>
              <Text>
                Finance{invoice.payment.financeProvider ? ` (${invoice.payment.financeProvider})` : ""}
              </Text>
              <Text>{fmt(invoice.payment.financeAmount)}</Text>
            </View>
            <View style={s.paymentBalance}>
              <Text>
                Balance Due{invoice.payment.balanceDueBy ? ` by ${fmtDate(invoice.payment.balanceDueBy)}` : ""}
              </Text>
              <Text>{fmt(invoice.payment.balanceDue)}</Text>
            </View>
          </View>
        )}

        {isRefund && invoice.notes && (
          <View style={s.refundBox}>
            <Text style={s.refundTitle}>Refund / cancellation details</Text>
            {invoice.notes.split("\n").map((line, i) =>
              line.trim() === "" ? (
                <View key={i} style={{ height: 4 }} />
              ) : /14 working days/i.test(line) ? (
                <Text key={i} style={s.refundStatement}>
                  {line}
                </Text>
              ) : (
                <Text key={i} style={s.refundLine}>
                  {line}
                </Text>
              ),
            )}
          </View>
        )}

        {invoice.vatScheme === "margin" && (
          <Text style={s.vatNote}>
            Sold under the UK Used Car Margin Scheme — VAT not separately recoverable by purchaser.
          </Text>
        )}

        <Text style={s.footer}>{companyName} · Thank you for your business.</Text>
      </Page>
    </Document>
  );
}
