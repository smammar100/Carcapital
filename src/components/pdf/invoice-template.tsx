import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Invoice, InvoiceLineItem, Vehicle } from "@/lib/types";
import { formatVatLabel, normalizeVatScheme } from "@/lib/vat";
import {
  CAR_CAPITAL_COMPANY as CO,
  CUSTOMER_DECLARATION_TEXT,
  FINANCE_DECLARATION_TEXT,
  WARRANTY_COVERAGE_PARTS,
  WARRANTY_DISCLAIMER_TEXT,
  NON_WARRANTY_DISCLAIMER_TEXT,
  TEST_DRIVE_AFFIRMATION_TEXT,
  DOCS_RECEIVED_TEXT,
  GENERAL_SERVICING_TEXT,
  DPF_NOTICE_TEXT,
  SELLER_DECLARATION_TEXT,
  FOOTER_NOTES,
  PDI_ITEMS,
} from "@/lib/invoice-templates";

interface Props {
  invoice: Invoice;
  companyName: string;
  companyAddress: string;
  vatNumber: string | null;
  vehicle?: Vehicle | null;
  /** Public URL of the company logo; falls back to the text mark when unset. */
  logoUrl?: string | null;
}

const TEAL = "#73AFA5";
const LABEL = "#555555";
const RULE = "#B0B0B0";
const BOX = "#F4F4F4";

const s = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  brand: { fontSize: 17, fontFamily: "Helvetica-Bold" },
  brandSmall: { fontSize: 8.5, color: "#333", marginTop: 3, lineHeight: 1.4 },
  logoBox: {
    width: 60,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBoxEmpty: {
    border: `1pt solid ${RULE}`,
  },
  logoTxt: { fontSize: 7, color: LABEL, textAlign: "center" },
  logoImg: { width: "100%", height: "100%", objectFit: "contain" },
  bannerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  bannerLine: { flex: 1, borderBottom: `1pt dashed ${RULE}` },
  bannerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  idGrid: { flexDirection: "row", gap: 14 },
  idCol: { flex: 1 },
  idRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${RULE}`,
    paddingVertical: 2.5,
  },
  idLabel: { width: 78, fontSize: 7.5, color: LABEL },
  idVal: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  idChoiceWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  idChoice: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    marginRight: 3,
  },
  table: { marginTop: 8, border: `0.5pt solid ${RULE}` },
  tr: { flexDirection: "row", borderBottom: `0.5pt solid ${RULE}` },
  trLast: { flexDirection: "row" },
  thDesc: {
    flex: 1,
    padding: 4,
    backgroundColor: BOX,
    fontFamily: "Helvetica-Bold",
    borderRight: `0.5pt solid ${RULE}`,
  },
  thVat: {
    width: 44,
    padding: 4,
    backgroundColor: BOX,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    borderRight: `0.5pt solid ${RULE}`,
  },
  thTotal: {
    width: 88,
    padding: 4,
    backgroundColor: BOX,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  tdDesc: { flex: 1, padding: 4, borderRight: `0.5pt solid ${RULE}` },
  tdVat: {
    width: 44,
    padding: 4,
    textAlign: "center",
    borderRight: `0.5pt solid ${RULE}`,
  },
  tdTotal: { width: 88, padding: 4, textAlign: "right" },
  noteRow: {
    padding: 4,
    borderBottom: `0.5pt solid ${RULE}`,
    fontSize: 7.5,
    fontStyle: "italic",
    color: "#333",
  },
  totalsWrap: { alignItems: "flex-end", marginTop: 6 },
  totalsBox: { width: 270, border: `0.5pt solid ${RULE}` },
  totRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${RULE}`,
  },
  totLabel: {
    flex: 1,
    padding: 4,
    fontFamily: "Helvetica-Bold",
    borderRight: `0.5pt solid ${RULE}`,
  },
  totVal: {
    width: 90,
    padding: 4,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  sigRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  sigCell: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  sigLine: { width: 110, borderBottom: "0.5pt solid #111", height: 1 },
  declBox: {
    border: `0.5pt solid ${RULE}`,
    padding: 6,
    marginTop: 8,
    fontSize: 7.5,
    lineHeight: 1.35,
  },
  footer: { marginTop: "auto", paddingTop: 8 },
  footerGrid: { flexDirection: "row", justifyContent: "space-between" },
  footerCol: { fontSize: 7.5, lineHeight: 1.5 },
  badgeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  // Square-ish accreditation logos; contain keeps their aspect ratio (GEN-35).
  badgeImg: { width: 42, height: 42, objectFit: "contain" },
  hr: { borderBottom: `0.5pt solid ${RULE}`, marginVertical: 5 },
  contactLine: { fontSize: 7.5, textAlign: "center" },
  chkBox: {
    width: 9,
    height: 9,
    border: "0.7pt solid #111",
    alignItems: "center",
    justifyContent: "center",
  },
  chkMark: { fontSize: 7, fontFamily: "Helvetica-Bold", lineHeight: 1 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 3 },
  specGrid: { flexDirection: "row", flexWrap: "wrap" },
  specCell: { width: "33.33%", flexDirection: "row", paddingVertical: 1.5 },
  specLabel: { fontSize: 7.5, color: LABEL, width: 64 },
  specVal: { fontSize: 8, fontFamily: "Helvetica-Bold", flex: 1 },
  para: { fontSize: 7.5, lineHeight: 1.4, marginTop: 3, textAlign: "justify" },
  paraItalic: {
    fontSize: 7,
    fontStyle: "italic",
    lineHeight: 1.4,
    marginTop: 3,
    textAlign: "justify",
  },
  pdiGrid: { flexDirection: "row", gap: 18, marginTop: 4 },
  pdiCol: { flex: 1 },
  pdiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 1.5,
  },
  pdiLabel: { fontSize: 7.5, flex: 1, paddingRight: 6 },
  docsGrid: { flexDirection: "row", gap: 18, marginTop: 6 },
});

function money(n: number): string {
  const v = Math.abs(n);
  const fixed = v.toFixed(2);
  const [intPart, dec] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}£${grouped}.${dec}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function ddMonYY(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${dd}/${MONTHS[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
}

function ddmmyyyy(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function title(str: string): string {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";
}

function formatReg(reg: string): string {
  const r = (reg || "").toUpperCase().replace(/\s+/g, "");
  // Current-style UK plate AB12 CDE → insert the space.
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(r)) return `${r.slice(0, 4)} ${r.slice(4)}`;
  return reg;
}

function makeModel(v: Vehicle | null | undefined): string {
  if (!v) return "—";
  const variant = v.variantCode ? ` ${v.variantCode}` : "";
  return `${v.year} ${v.make}-${v.model}${variant} - ${title(v.fuelType)}`;
}

function Chk({ on }: { on: boolean }) {
  return (
    <View style={s.chkBox}>
      {on ? <Text style={s.chkMark}>X</Text> : null}
    </View>
  );
}

function Banner({ title: t }: { title: string }) {
  return (
    <View style={s.bannerWrap}>
      <View style={s.bannerLine} />
      <Text style={s.bannerText}>{t}</Text>
      <View style={s.bannerLine} />
    </View>
  );
}

function ContactFooterLine() {
  return (
    <Text style={s.contactLine}>
      {`• ${CO.contactPhones[0]}    • ${CO.contactPhones[1]}    • ${CO.contactEmail}    • ${CO.website}`}
    </Text>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.idRow}>
      <Text style={s.idLabel}>{label}</Text>
      <Text style={s.idVal}>{value}</Text>
    </View>
  );
}

function depositPrefix(method: Invoice["depositMethod"]): string {
  switch (method) {
    case "bank_transfer":
      return "BANK";
    case "cash":
      return "CASH";
    case "card":
      return "CARD";
    case "cheque":
      return "CHEQUE";
    case "pdq":
      return "PDQ";
    default:
      return "BANK";
  }
}

// ---------------------------------------------------------------------------
// Legacy fallback (purchase / refund / uploaded invoices) — keeps the admin
// invoicing list's print/download working after the rewrite.
// ---------------------------------------------------------------------------
function LegacyInvoice({ invoice, companyName, companyAddress, vatNumber }: Props) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.brand}>{companyName}</Text>
            <Text style={s.brandSmall}>{companyAddress}</Text>
            {vatNumber ? (
              <Text style={s.brandSmall}>VAT: {vatNumber}</Text>
            ) : null}
          </View>
          <View>
            <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
              {invoice.type.toUpperCase()} INVOICE
            </Text>
            <Text style={s.brandSmall}>{invoice.invoiceNumber}</Text>
            <Text style={s.brandSmall}>{ddMonYY(invoice.invoiceDate)}</Text>
          </View>
        </View>
        <Banner title={`${invoice.type.toUpperCase()} INVOICE`} />
        <Text style={{ marginBottom: 4 }}>{invoice.partyName}</Text>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={s.thDesc}>DESCRIPTION</Text>
            <Text style={s.thVat}>QTY</Text>
            <Text style={s.thTotal}>TOTAL</Text>
          </View>
          {invoice.lineItems.map((l) => (
            <View style={s.tr} key={l.id}>
              <Text style={s.tdDesc}>{l.description}</Text>
              <Text style={s.tdVat}>{l.quantity}</Text>
              <Text style={s.tdTotal}>{money(l.total)}</Text>
            </View>
          ))}
        </View>
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totRow}>
              <Text style={s.totLabel}>SUBTOTAL</Text>
              <Text style={s.totVal}>{money(invoice.subtotal)}</Text>
            </View>
            {normalizeVatScheme(invoice.vatScheme) === "standard" ? (
              <View style={s.totRow}>
                <Text style={s.totLabel}>VAT (20%)</Text>
                <Text style={s.totVal}>{money(invoice.vatAmount)}</Text>
              </View>
            ) : (
              // Margin / zero-rated invoices must NOT itemise a VAT amount to
              // the customer — show the scheme label instead. (The true output
              // VAT is still recorded on the invoice for the VAT return.)
              <View style={s.totRow}>
                <Text style={s.totLabel}>{formatVatLabel(invoice.vatScheme)}</Text>
                <Text style={s.totVal}>—</Text>
              </View>
            )}
            <View style={s.trLast}>
              <Text style={s.totLabel}>TOTAL</Text>
              <Text style={s.totVal}>{money(invoice.total)}</Text>
            </View>
          </View>
        </View>
        {invoice.notes ? (
          <View style={s.declBox}>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}
        <View style={s.footer}>
          <View style={s.hr} />
          <ContactFooterLine />
        </View>
      </Page>
    </Document>
  );
}

function lineTotalDisplay(l: InvoiceLineItem): string {
  return l.type === "addon_free" ? "FREE" : money(l.total);
}

// ---------------------------------------------------------------------------
// 2-page Car Capital Sales Invoice (SPEC §7, 1:1 with the reference PDF)
// ---------------------------------------------------------------------------
function SalesInvoice({ invoice, vehicle, logoUrl }: Props) {
  const pdc = invoice.preDeliveryCheck;
  const w = invoice.warranty;
  const left = PDI_ITEMS.slice(0, 7);
  const right = PDI_ITEMS.slice(7, 14);

  const engineService =
    pdc && pdc.engineServiceDoneDate
      ? `DONE - ${ddmmyyyy(pdc.engineServiceDoneDate)}${pdc.engineServiceDoneMileage != null ? ` @${pdc.engineServiceDoneMileage.toLocaleString()}` : ""}`
      : "NOT DONE";

  const mileageStr =
    invoice.presentMileage != null
      ? `${invoice.presentMileage.toLocaleString()} MILES`
      : vehicle
        ? `${vehicle.mileage.toLocaleString()} MILES`
        : "—";
  const mm = makeModel(vehicle);
  const vrmVin = vehicle
    ? `${formatReg(vehicle.registration)} / ${vehicle.vin ?? "—"}`
    : "—";
  const isAuto = vehicle ? vehicle.transmission === "automatic" : false;
  const isLocal = vehicle ? vehicle.localOrImport === "local" : true;
  const isStandardVat = normalizeVatScheme(invoice.vatScheme) === "standard";

  return (
    <Document>
      {/* ============================ PAGE 1 ============================ */}
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.brand}>{CO.legalName}</Text>
            <Text style={s.brandSmall}>{CO.addressLines.join("\n")}</Text>
          </View>
          <View style={[s.logoBox, logoUrl ? {} : s.logoBoxEmpty]}>
            {logoUrl ? (
              <Image src={logoUrl} style={s.logoImg} />
            ) : (
              <Text style={s.logoTxt}>CAR{"\n"}CAPITAL</Text>
            )}
          </View>
        </View>

        <Banner title="SALES INVOICE" />

        <View style={s.idGrid}>
          <View style={s.idCol}>
            <IdRow label="Date" value={ddMonYY(invoice.invoiceDate)} />
            <IdRow label="Invoice To" value={invoice.buyerName ?? "—"} />
            <IdRow label="Address" value={invoice.buyerAddress ?? "—"} />
            <IdRow label="Post Code" value={invoice.buyerPostcode ?? "—"} />
            <IdRow label="Phone" value={invoice.buyerPhone ?? "—"} />
            <IdRow label="Email" value={invoice.buyerEmail ?? "—"} />
          </View>
          <View style={s.idCol}>
            <IdRow label="Present Mileage" value={mileageStr} />
            <IdRow label="Make & Model" value={mm} />
            <IdRow label="VRM / VIN No" value={vrmVin} />
            <IdRow label="D.O.R" value={ddmmyyyy(invoice.dorDate)} />
            <View style={s.idRow}>
              <Text style={s.idLabel}>Gearbox</Text>
              <View style={s.idChoiceWrap}>
                <Text style={s.idChoice}>Automatic</Text>
                <Chk on={isAuto} />
                <Text style={[s.idChoice, { marginLeft: 8 }]}>Manual</Text>
                <Chk on={!isAuto} />
              </View>
            </View>
            <View style={s.idRow}>
              <Text style={s.idLabel}>Origin</Text>
              <View style={s.idChoiceWrap}>
                <Text style={s.idChoice}>Local</Text>
                <Chk on={isLocal} />
                <Text style={[s.idChoice, { marginLeft: 8 }]}>Jap Import</Text>
                <Chk on={!isLocal} />
              </View>
            </View>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tr}>
            <Text style={s.thDesc}>DESCRIPTION</Text>
            <Text style={s.thVat}>VAT</Text>
            <Text style={s.thTotal}>TOTAL</Text>
          </View>
          {invoice.lineItems.map((l) => (
            <View style={s.tr} key={l.id}>
              <Text style={s.tdDesc}>{l.description}</Text>
              <Text style={s.tdVat}>
                {isStandardVat && l.vatAmount > 0 ? money(l.vatAmount) : ""}
              </Text>
              <Text style={s.tdTotal}>{lineTotalDisplay(l)}</Text>
            </View>
          ))}
          {invoice.includeUnitStockingNote ? (
            <Text style={s.noteRow}>{FOOTER_NOTES.unitStocking}</Text>
          ) : null}
          {invoice.includeIdRequirementNote ? (
            <Text style={s.noteRow}>{FOOTER_NOTES.idRequirement}</Text>
          ) : null}
          {invoice.includeServiceHistoryNote ? (
            <Text style={s.noteRow}>{FOOTER_NOTES.serviceHistory}</Text>
          ) : null}
          {invoice.customNote ? (
            <Text style={s.noteRow}>{invoice.customNote}</Text>
          ) : null}
        </View>

        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totRow}>
              <Text style={s.totLabel}>SALES PRICE</Text>
              <Text style={s.totVal}>{money(invoice.salesPrice)}</Text>
            </View>
            <View style={s.totRow}>
              <Text style={s.totLabel}>GRAND TOTAL (INCL ADD ONS)</Text>
              <Text style={s.totVal}>
                {money(invoice.grandTotalInclAddons)}
              </Text>
            </View>
            {isStandardVat ? (
              <View style={s.totRow}>
                <Text style={s.totLabel}>VAT (20%)</Text>
                <Text style={s.totVal}>{money(invoice.vatAmount)}</Text>
              </View>
            ) : (
              // Margin / zero-rated sales must NOT itemise a VAT amount to the
              // customer — show the scheme label instead. (Output VAT is still
              // recorded on the invoice for the VAT return.)
              <View style={s.totRow}>
                <Text style={s.totLabel}>{formatVatLabel(invoice.vatScheme)}</Text>
                <Text style={s.totVal}>—</Text>
              </View>
            )}
            {invoice.depositAmount > 0 ? (
              <View style={s.totRow}>
                <Text style={s.totLabel}>
                  {`CUSTOMER DEPOSIT (${depositPrefix(invoice.depositMethod)} ${ddmmyyyy(invoice.depositReceivedDate)})`}
                </Text>
                <Text style={s.totVal}>{money(invoice.depositAmount)}</Text>
              </View>
            ) : null}
            {invoice.financeAmount > 0 ? (
              <View style={s.totRow}>
                <Text style={s.totLabel}>FINANCE AMOUNT</Text>
                <Text style={s.totVal}>{money(invoice.financeAmount)}</Text>
              </View>
            ) : null}
            <View style={s.trLast}>
              <Text style={s.totLabel}>BALANCE DUE</Text>
              <Text style={s.totVal}>{money(invoice.balanceDue)}</Text>
            </View>
          </View>
        </View>

        <View style={s.sigRow}>
          <View style={s.sigCell}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>SELLER'S SIGNATURE</Text>
            <View style={s.sigLine} />
          </View>
          <View style={s.sigCell}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>BUYER'S SIGNATURE</Text>
            <View style={s.sigLine} />
          </View>
        </View>

        <View style={s.declBox}>
          <Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
              CUSTOMER DECLARATION:{" "}
            </Text>
            {CUSTOMER_DECLARATION_TEXT}
          </Text>
        </View>
        <View style={s.declBox}>
          <Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
              FINANCE DECLARATION:{" "}
            </Text>
            {FINANCE_DECLARATION_TEXT}
          </Text>
        </View>

        <View style={s.footer}>
          <View style={s.footerGrid}>
            <View style={s.footerCol}>
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
                  Bank Details:{" "}
                </Text>
                {CO.bankAccountName}, {CO.bankName}
              </Text>
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
                  Account No:{" "}
                </Text>
                {CO.bankAccountNumber}
              </Text>
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
                  Sort Code:{" "}
                </Text>
                {CO.bankSortCode}
              </Text>
            </View>
            <View style={s.footerCol}>
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
                  Company Reg No:{" "}
                </Text>
                {CO.companyRegNumber}
              </Text>
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
                  VAT Reg No:{" "}
                </Text>
                {CO.vatRegNumber}
              </Text>
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>FCA No: </Text>
                {CO.fcaNumber}
              </Text>
            </View>
            <View style={s.badgeRow}>
              {CO.badges.map((b) => (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
                <Image key={b.src} src={b.src} style={s.badgeImg} />
              ))}
            </View>
          </View>
          <View style={s.hr} />
          <ContactFooterLine />
        </View>
      </Page>

      {/* ============================ PAGE 2 ============================ */}
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={[s.brand, { fontSize: 13 }]}>{CO.legalName}</Text>
            <Text style={s.brandSmall}>{CO.addressLines.join(", ")}</Text>
          </View>
          <View
            style={[
              s.logoBox,
              { width: 46, height: 28 },
              logoUrl ? {} : s.logoBoxEmpty,
            ]}
          >
            {logoUrl ? (
              <Image src={logoUrl} style={s.logoImg} />
            ) : (
              <Text style={s.logoTxt}>CAR{"\n"}CAPITAL</Text>
            )}
          </View>
        </View>

        <Banner title="WARRANTY DECLARATION" />

        <Text style={s.sectionTitle}>Warranty Specs</Text>
        <View style={s.specGrid}>
          <SpecCell label="Provider" value={w?.provider ?? CO.legalName} />
          <SpecCell label="Phone" value={w?.providerPhone ?? CO.warrantyProviderPhone} />
          <SpecCell label="Email" value={w?.providerEmail ?? CO.warrantyProviderEmail} />
          <SpecCell label="Cover Type" value={w?.coverType ?? "—"} />
          <SpecCell label="Claim Limit (£)" value={w ? String(w.claimLimit) : "—"} />
          <SpecCell
            label="Diagnostics"
            value={w ? `Covered Up To £${w.diagnosticsCover}` : "—"}
          />
          <SpecCell label="Duration" value={w?.duration ?? "—"} />
          <SpecCell label="Excess" value={w ? `${w.excessPercent}%` : "—"} />
          <SpecCell
            label="Wear & Tear"
            value={w ? (w.wearTearCovered ? "Covered" : "Not Covered") : "—"}
          />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
            Non-Warranty Disclaimer
          </Text>
          <Chk on={invoice.nonWarrantyDisclaimerAccepted} />
        </View>
        <Text style={s.para}>{NON_WARRANTY_DISCLAIMER_TEXT}</Text>

        <Text style={[s.sectionTitle, { marginTop: 6 }]}>
          Which parts are covered?
        </Text>
        <Text style={s.paraItalic}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>Engine: </Text>
          {WARRANTY_COVERAGE_PARTS.engine}
        </Text>
        <Text style={s.paraItalic}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>Manual Gearbox: </Text>
          {WARRANTY_COVERAGE_PARTS.manualGearbox}
        </Text>
        <Text style={s.paraItalic}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
            Fully Automatic Gearbox:{" "}
          </Text>
          {WARRANTY_COVERAGE_PARTS.automaticGearbox}
        </Text>
        <Text style={s.paraItalic}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>Clutch: </Text>
          {WARRANTY_COVERAGE_PARTS.clutch}
        </Text>
        <Text style={s.paraItalic}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>Disclaimer: </Text>
          {WARRANTY_DISCLAIMER_TEXT}
        </Text>

        <Banner title="PRE DELIVERY CHECK" />

        <Text style={{ fontSize: 8 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>Buyer's Name: </Text>
          {invoice.buyerName ?? "—"}
        </Text>
        <Text style={{ fontSize: 8 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
            Vehicle Make & Model:{" "}
          </Text>
          {mm}
        </Text>
        <Text style={{ fontSize: 8 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
            Vehicle Reg & Chassis No:{" "}
          </Text>
          {vrmVin}
        </Text>
        <Text style={{ fontSize: 8 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
            Present Mileage:{" "}
          </Text>
          {mileageStr}
        </Text>

        <Text style={s.paraItalic}>{TEST_DRIVE_AFFIRMATION_TEXT}</Text>
        <Text style={[s.para, { marginTop: 4 }]}>
          Specifically, the vehicle has been inspected as follows:
        </Text>

        <View style={s.pdiGrid}>
          <View style={s.pdiCol}>
            {left.map((it) => (
              <View style={s.pdiRow} key={it.key as string}>
                <Text style={s.pdiLabel}>{it.label}</Text>
                <Chk on={pdc ? Boolean(pdc[it.key]) : true} />
              </View>
            ))}
          </View>
          <View style={s.pdiCol}>
            {right.map((it) => (
              <View style={s.pdiRow} key={it.key as string}>
                <Text style={s.pdiLabel}>{it.label}</Text>
                <Chk on={pdc ? Boolean(pdc[it.key]) : true} />
              </View>
            ))}
          </View>
        </View>

        <Text style={[s.para, { marginTop: 6 }]}>{DOCS_RECEIVED_TEXT}</Text>

        <View style={s.docsGrid}>
          <View style={{ flex: 1 }}>
            <SpecCell label="Lock Nut" value={pdc?.lockNut ? "Yes" : "No"} full />
            <SpecCell label="No of Keys" value={pdc ? String(pdc.numKeys) : "—"} full />
            <SpecCell
              label="Service History"
              value={pdc?.serviceHistoryStatus ?? "—"}
              full
            />
          </View>
          <View style={{ flex: 1 }}>
            <SpecCell label="Engine Service" value={engineService} full />
            <SpecCell label="Car V5/Logbook" value={pdc?.v5Status ?? "—"} full />
            <SpecCell
              label="HPI/History Check"
              value={pdc?.hpiCheckResult ?? "—"}
              full
            />
          </View>
        </View>

        <Banner title="GENERAL DECLARATION" />
        <Text style={s.paraItalic}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
            General Servicing & Other requirements:{" "}
          </Text>
          {GENERAL_SERVICING_TEXT}
        </Text>
        <Text style={s.paraItalic}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
            Vehicles with a Diesel Particulate Filter:{" "}
          </Text>
          {DPF_NOTICE_TEXT}
        </Text>
        <Text style={s.paraItalic}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>
            Seller Declaration:{" "}
          </Text>
          {SELLER_DECLARATION_TEXT}
        </Text>

        <View style={s.sigRow}>
          <View style={s.sigCell}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>SELLER'S SIGNATURE</Text>
            <View style={s.sigLine} />
          </View>
          <View style={s.sigCell}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontStyle: "normal" }}>BUYER'S SIGNATURE</Text>
            <View style={s.sigLine} />
          </View>
        </View>

        <View style={s.footer}>
          <View style={s.hr} />
          <ContactFooterLine />
        </View>
      </Page>
    </Document>
  );
}

function SpecCell({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <View style={[s.specCell, full ? { width: "100%" } : {}]}>
      <Text style={s.specLabel}>{label}</Text>
      <Text style={s.specVal}>{value}</Text>
    </View>
  );
}

export function InvoiceTemplate(props: Props) {
  return props.invoice.type === "sale" ? (
    <SalesInvoice {...props} />
  ) : (
    <LegacyInvoice {...props} />
  );
}
