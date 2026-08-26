import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { variantLabel } from "@/lib/vehicle-variant";
import type { TodoItem, Vehicle } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#666", marginBottom: 12 },
  hr: { borderBottom: "1pt solid #ccc", marginVertical: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 120, color: "#666" },
  value: { flex: 1 },
  table: { borderTop: "1pt solid #ccc", borderLeft: "1pt solid #ccc" },
  tr: { flexDirection: "row" },
  th: {
    flex: 1,
    padding: 5,
    fontWeight: 700,
    backgroundColor: "#eee",
    borderRight: "1pt solid #ccc",
    borderBottom: "1pt solid #ccc",
  },
  td: {
    flex: 1,
    padding: 5,
    borderRight: "1pt solid #ccc",
    borderBottom: "1pt solid #ccc",
  },
  small: { width: 50, textAlign: "center" },
  med: { width: 90 },
  status: {
    width: 70,
    padding: 5,
    borderRight: "1pt solid #ccc",
    borderBottom: "1pt solid #ccc",
    textTransform: "capitalize",
  },
  cost: {
    width: 70,
    padding: 5,
    borderRight: "1pt solid #ccc",
    borderBottom: "1pt solid #ccc",
    textAlign: "right",
  },
  total: { marginTop: 10, textAlign: "right", fontSize: 11, fontWeight: 700 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#888",
    textAlign: "center",
  },
});

interface Props {
  vehicle: Vehicle;
  todos: TodoItem[];
  preparedBy: string;
  companyName: string;
  /** Vendor id → name lookup, so the Vendor column shows names not UUIDs. */
  vendorNames?: Record<string, string>;
}

function fmtGBP(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function JobCardTemplate({
  vehicle,
  todos,
  preparedBy,
  companyName,
  vendorNames,
}: Props) {
  const grandTotal = todos.reduce((s, t) => s + (t.cost ?? 0), 0);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{companyName} · Job Card</Text>
        <Text style={styles.meta}>
          Generated {new Date().toLocaleString("en-GB")} · Prepared by {preparedBy}
        </Text>

        <Text style={styles.sectionTitle}>Vehicle</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Registration:</Text>
          <Text style={styles.value}>{vehicle.registration}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Stock ID:</Text>
          <Text style={styles.value}>{vehicle.stockId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Make / Model:</Text>
          <Text style={styles.value}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Variant:</Text>
          <Text style={styles.value}>{variantLabel(vehicle)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Mileage:</Text>
          <Text style={styles.value}>{vehicle.mileage.toLocaleString()} mi</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Colour / Fuel:</Text>
          <Text style={styles.value}>
            {vehicle.colour} · {vehicle.fuelType} · {vehicle.transmission}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Things to Do</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.small]}>#</Text>
            <Text style={styles.th}>Description</Text>
            <Text style={[styles.th, styles.med]}>Vendor</Text>
            <Text style={[styles.th, { ...styles.small, width: 70 }]}>
              Status
            </Text>
            <Text style={[styles.th, { ...styles.small, width: 70 }]}>Cost</Text>
          </View>
          {todos.length === 0 ? (
            <View style={styles.tr}>
              <Text style={[styles.td, { flex: 1 }]}>No items recorded</Text>
            </View>
          ) : (
            todos.map((t) => (
              <View key={t.id} style={styles.tr}>
                <Text style={[styles.td, styles.small]}>{t.serialNumber}</Text>
                <Text style={styles.td}>{t.description}</Text>
                <Text style={[styles.td, styles.med]}>
                  {(t.vendorId ? vendorNames?.[t.vendorId] : null) ?? "—"}
                </Text>
                <Text style={styles.status}>{t.status.replace("_", " ")}</Text>
                <Text style={styles.cost}>{fmtGBP(t.cost)}</Text>
              </View>
            ))
          )}
        </View>
        <Text style={styles.total}>Grand total: {fmtGBP(grandTotal)}</Text>

        <Text style={styles.sectionTitle}>Cost Summary</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Buying:</Text>
          <Text style={styles.value}>{fmtGBP(vehicle.totalBuyingPrice)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Stocking:</Text>
          <Text style={styles.value}>{fmtGBP(vehicle.stockingCharges)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Value Addition:</Text>
          <Text style={styles.value}>{fmtGBP(vehicle.valueAddition)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Warranty:</Text>
          <Text style={styles.value}>{fmtGBP(vehicle.warrantyCost)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Base Cost:</Text>
          <Text style={styles.value}>{fmtGBP(vehicle.baseCost)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Listing Price:</Text>
          <Text style={styles.value}>{fmtGBP(vehicle.listingPrice)}</Text>
        </View>

        <Text style={styles.footer}>{companyName} · Confidential</Text>
      </Page>
    </Document>
  );
}
