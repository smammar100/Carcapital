import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Vehicle, Warranty } from "@/lib/types";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  border: {
    border: "2pt solid #1f2937",
    padding: 28,
    minHeight: "100%",
  },
  brand: {
    fontSize: 24,
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: 1.2,
  },
  subBrand: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 6,
    color: "#666",
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    textAlign: "center",
    marginTop: 50,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  rule: {
    borderBottom: "1pt solid #1f2937",
    marginVertical: 18,
  },
  body: { fontSize: 11, lineHeight: 1.5, textAlign: "center" },
  section: { marginTop: 24 },
  row: { flexDirection: "row", marginBottom: 5 },
  label: { width: 130, color: "#666" },
  value: { flex: 1, fontWeight: 500 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#888",
    textAlign: "center",
  },
});

interface Props {
  warranty: Warranty;
  vehicle: Vehicle | null;
  companyName: string;
  companyAddress: string;
  vatNumber: string | null;
}

function fmt(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function WarrantyCertificateTemplate({
  warranty,
  vehicle,
  companyName,
  companyAddress,
  vatNumber,
}: Props) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.border}>
          <Text style={s.brand}>{companyName}</Text>
          <Text style={s.subBrand}>{companyAddress}</Text>
          <Text style={s.title}>Certificate of Warranty</Text>
          <View style={s.rule} />
          <Text style={s.body}>
            This certificate confirms that the vehicle described below is covered by
            the {warranty.type === "third_party" ? "third-party" : "in-house"}{" "}
            warranty issued by {companyName}.
          </Text>
          <View style={s.section}>
            <View style={s.row}>
              <Text style={s.label}>Customer:</Text>
              <Text style={s.value}>{warranty.customerName}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Phone:</Text>
              <Text style={s.value}>{warranty.customerPhone}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Email:</Text>
              <Text style={s.value}>{warranty.customerEmail ?? "—"}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Vehicle:</Text>
              <Text style={s.value}>
                {vehicle
                  ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.registration})`
                  : "—"}
              </Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Provider:</Text>
              <Text style={s.value}>
                {warranty.type === "third_party"
                  ? warranty.provider ?? "Third party"
                  : "In-house"}
              </Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Coverage:</Text>
              <Text style={s.value}>{warranty.coverageDetails}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Period:</Text>
              <Text style={s.value}>
                {fmt(warranty.startDate)} to {fmt(warranty.endDate)}
              </Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Issued by:</Text>
              <Text style={s.value}>{companyName}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>VAT:</Text>
              <Text style={s.value}>{vatNumber ?? "N/A"}</Text>
            </View>
          </View>
          <Text style={[s.body, { marginTop: 30, fontSize: 9 }]}>
            Claims are processed at the discretion of the issuer. This certificate is
            not transferable and is governed by UK consumer protection law.
          </Text>
        </View>
        <Text style={s.footer}>{companyName} · Confidential</Text>
      </Page>
    </Document>
  );
}
