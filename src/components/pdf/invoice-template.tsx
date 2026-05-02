import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Invoice } from "@/lib/types";

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
  vat: { width: 50, textAlign: "right" },
  line: { width: 80, textAlign: "right" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", marginBottom: 3, gap: 12 },
  totalLabel: { width: 100, textAlign: "right", color: "#666" },
  totalValue: { width: 100, textAlign: "right" },
  big: { fontSize: 12, fontWeight: 700 },
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
            <Text style={[s.brand, { fontSize: 14 }]}>
              {invoice.type === "purchase" ? "Purchase Invoice" : "Sales Invoice"}
            </Text>
            <Text style={s.small}>{invoice.invoiceNumber}</Text>
            <Text style={s.small}>Date: {fmtDate(invoice.invoiceDate)}</Text>
            {invoice.dueDate && (
              <Text style={s.small}>Due: {fmtDate(invoice.dueDate)}</Text>
            )}
          </View>
        </View>

        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.label}>
              {invoice.type === "purchase" ? "Seller / Supplier" : "Bill To"}
            </Text>
            <Text style={{ fontWeight: 700 }}>{invoice.partyName}</Text>
            {invoice.partyEmail && <Text>{invoice.partyEmail}</Text>}
            {invoice.partyPhone && <Text>{invoice.partyPhone}</Text>}
          </View>
          <View style={s.col}>
            <Text style={s.label}>Status</Text>
            <Text style={{ textTransform: "uppercase" }}>{invoice.status}</Text>
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
          {invoice.lineItems.map((li) => {
            const net = li.quantity * li.unitPrice;
            const lineTotal = net * (1 + li.vatRate);
            return (
              <View key={li.id} style={s.tr}>
                <Text style={[s.td, s.desc]}>{li.description}</Text>
                <Text style={[s.td, s.qty]}>{li.quantity}</Text>
                <Text style={[s.td, s.unit]}>{fmt(li.unitPrice)}</Text>
                <Text style={[s.td, s.vat]}>{(li.vatRate * 100).toFixed(0)}%</Text>
                <Text style={[s.td, s.line]}>{fmt(lineTotal)}</Text>
              </View>
            );
          })}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalValue}>{fmt(invoice.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>VAT</Text>
            <Text style={s.totalValue}>{fmt(invoice.vatAmount)}</Text>
          </View>
          <View style={[s.totalRow, s.big]}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{fmt(invoice.total)}</Text>
          </View>
        </View>

        <Text style={s.footer}>{companyName} · Thank you for your business.</Text>
      </Page>
    </Document>
  );
}
