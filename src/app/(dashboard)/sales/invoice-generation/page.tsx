"use client";

import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Plus,
  Trash2,
  ShieldX,
  Car,
  User,
  FileText,
  Percent,
  CreditCard,
  ShieldCheck,
  ClipboardCheck,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { invoiceService } from "@/lib/services/invoice-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { salesService } from "@/lib/services/sales-service";
import { warrantyService } from "@/lib/services/warranty-service";
import {
  companyInvoiceFields,
  downloadBlob,
  pdfService,
} from "@/lib/services/pdf-service";
import type {
  AddonCategory,
  DepositMethod,
  Invoice,
  InvoiceLineItem,
  InvoiceLineItemType,
  PreDeliveryCheck,
  SalesDeal,
  Vehicle,
  VatScheme,
  WarrantyDeclaration,
  WarrantyType,
} from "@/lib/types";
import {
  ADDON_CATEGORY_OPTIONS,
  MOTOR_FINANCE_PROVIDERS,
  PDI_ITEMS,
  WARRANTY_DEFAULTS,
} from "@/lib/invoice-templates";
import { computeInvoiceTotals } from "@/lib/invoice-calc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { VehiclePicker } from "@/components/shared/vehicle-picker";
import { formatCurrency, cn } from "@/lib/utils";
import { isValidUkPhone } from "@/lib/formatters";
import {
  addressLookupService,
  type AddressSuggestion,
} from "@/lib/services/address-lookup-service";
import { usePostcodeLookup } from "@/hooks/use-postcode-lookup";
import { toast } from "@/lib/toast";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Human labels for the DepositMethod enum — a legal document form must never
 *  surface raw values like "bank_transfer" (GEN-51). */
const DEPOSIT_METHOD_OPTIONS: [DepositMethod, string][] = [
  ["bank_transfer", "Bank Transfer"],
  ["cash", "Cash"],
  ["card", "Card"],
  ["cheque", "Cheque"],
  ["pdq", "PDQ"],
];

interface DraftLine {
  uid: string;
  type: InvoiceLineItemType;
  addonCategory: AddonCategory | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

const emptyPdc = (v: Vehicle | null): PreDeliveryCheck => ({
  engineStarts: true,
  engineNoise: true,
  transmission: true,
  noiseNormal: true,
  clutch: true,
  steering: true,
  bodyCondition: true,
  bodySuspension: true,
  brakes: true,
  gauges: true,
  warningLights: true,
  exhaust: true,
  exteriorLights: true,
  serviceLight: true,
  lockNut: v?.lockNut ?? true,
  numKeys: v?.numKeys ?? 2,
  serviceHistoryStatus: v
    ? (() => {
        const sh = v.serviceHistory || "full";
        return `${sh[0].toUpperCase()}${sh.slice(1)} - Provided`;
      })()
    : "Full - Provided",
  engineServiceDoneDate: null,
  engineServiceDoneMileage: null,
  v5Status: v?.v5Received ? "V5C-2 Green Slip" : "V5C Awaited",
  hpiCheckResult: "Clear",
});

const defaultWarranty = (): WarrantyDeclaration => ({ ...WARRANTY_DEFAULTS });

const SECTION_ICON: Record<string, LucideIcon> = {
  A: Car,
  B: User,
  C: FileText,
  D: Percent,
  E: CreditCard,
  F: ShieldCheck,
  G: ClipboardCheck,
  H: StickyNote,
};

function Section({
  title,
  letter,
  children,
}: {
  title: string;
  letter: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const Icon = SECTION_ICON[letter];
  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          <span>
            <span className="text-muted-foreground">{letter}.</span> {title}
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")}
        />
      </button>
      {open && <div className="border-t px-4 py-4">{children}</div>}
    </Card>
  );
}

export default function InvoiceGenerationPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <InvoiceGenerationForm />
    </Suspense>
  );
}

function InvoiceGenerationForm() {
  const baseId = useId();
  const vehicleFieldId = `${baseId}-vehicle`;
  const buyerNameId = `${baseId}-buyer-name`;
  const buyerPhoneId = `${baseId}-buyer-phone`;
  const buyerPostcodeId = `${baseId}-buyer-postcode`;
  const buyerAddressId = `${baseId}-buyer-address`;
  const buyerEmailId = `${baseId}-buyer-email`;
  const invoiceDateId = `${baseId}-invoice-date`;
  const presentMileageId = `${baseId}-present-mileage`;
  const dorDateId = `${baseId}-dor-date`;
  const depositAmountId = `${baseId}-deposit-amount`;
  const depositMethodId = `${baseId}-deposit-method`;
  const depositReceivedDateId = `${baseId}-deposit-received-date`;
  const financeAmountId = `${baseId}-finance-amount`;
  const financeProviderId = `${baseId}-finance-provider`;
  const balanceDueById = `${baseId}-balance-due-by`;
  const warrantyProviderTypeId = `${baseId}-warranty-provider-type`;
  const warrantyProviderNameId = `${baseId}-warranty-provider-name`;
  const warrantyProviderPhoneId = `${baseId}-warranty-provider-phone`;
  const warrantyProviderEmailId = `${baseId}-warranty-provider-email`;
  const warrantyCoverTypeId = `${baseId}-warranty-cover-type`;
  const warrantyClaimLimitId = `${baseId}-warranty-claim-limit`;
  const warrantyDiagnosticsCoverId = `${baseId}-warranty-diagnostics-cover`;
  const warrantyDurationId = `${baseId}-warranty-duration`;
  const warrantyExcessPercentId = `${baseId}-warranty-excess-percent`;
  const numKeysId = `${baseId}-num-keys`;
  const serviceHistoryId = `${baseId}-service-history`;
  const engineServiceDateId = `${baseId}-engine-service-date`;
  const engineServiceMileageId = `${baseId}-engine-service-mileage`;
  const v5StatusId = `${baseId}-v5-status`;
  const hpiCheckResultId = `${baseId}-hpi-check-result`;
  const customNoteId = `${baseId}-custom-note`;
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const searchParams = useSearchParams();
  const vehicleIdParam = searchParams.get("vehicleId");
  const invoiceIdParam = searchParams.get("invoiceId");
  const editing = !!invoiceIdParam;
  const { user, company } = useAuth();
  const { can, isSuperUser, isLoading: permLoading } = usePermissions();
  const canGenerate = isSuperUser || can("invoice:generate");
  const canEdit = isSuperUser || can("invoice:edit");
  const allowed = editing ? canEdit : canGenerate;

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [deal, setDeal] = useState<SalesDeal | null>(null);
  const [loading, setLoading] = useState(true);

  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerPostcode, setBuyerPostcode] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  const {
    lookupDebounced: lookupPostcodeDebounced,
    suggestions: pcSuggestions,
    isLoading: pcLoading,
    notFound: pcNotFound,
    error: pcError,
    hasPremiseData: pcHasPremises,
    reset: resetPostcode,
  } = usePostcodeLookup();
  const [pcListOpen, setPcListOpen] = useState(false);

  // Cars this invoice may be raised against. Searching within them is
  // VehiclePicker's job (GEN-79) — this only decides what's offerable.
  const filteredVehicles = useMemo(
    () =>
      (vehicles ?? []).filter(
        // Don't offer already-sold/returned cars for a fresh invoice — except
        // the one already selected/being edited, so existing invoices load.
        (v) =>
          v.id === vehicleId ||
          (v.status !== "sold" && v.status !== "returned"),
      ),
    [vehicles, vehicleId],
  );

  /**
   * Accept a suggestion the user picked.
   *
   * Sets the address line outright rather than merging. The previous version
   * tried to preserve "whatever you typed before the auto-filled part", which
   * couldn't tell a typed street from an earlier auto-fill — so looking up a
   * second postcode welded the old locality onto the new address (a TW3
   * lookup followed by UB1 produced "HESTON EAST, SOUTHALL BROADWAY…"). On a
   * legal document that is not a cosmetic bug.
   */
  function acceptAddress(s: AddressSuggestion) {
    setBuyerAddress(addressLookupService.toAddressLine(s));
    setBuyerPostcode(s.postcode);
    setPcListOpen(false);
    resetPostcode();
  }

  const [presentMileage, setPresentMileage] = useState<number>(0);
  const [dorDate, setDorDate] = useState<string>("");

  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState<DraftLine[]>([
    {
      uid: "vehicle-line",
      type: "vehicle_price",
      addonCategory: null,
      description: "SALES PRICE",
      quantity: 1,
      unitPrice: 0,
    },
  ]);

  const [vatScheme, setVatScheme] = useState<VatScheme>("margin_used");

  const [depositAmount, setDepositAmount] = useState(0);
  const [depositMethod, setDepositMethod] =
    useState<DepositMethod>("bank_transfer");
  const [depositReceivedDate, setDepositReceivedDate] = useState("");
  const [financeAmount, setFinanceAmount] = useState(0);
  const [financeProvider, setFinanceProvider] = useState<string>(
    MOTOR_FINANCE_PROVIDERS[0],
  );
  const [balanceDueBy, setBalanceDueBy] = useState("");

  const [warranty, setWarranty] = useState<WarrantyDeclaration>(
    defaultWarranty(),
  );
  const [nonWarrantyDisclaimer, setNonWarrantyDisclaimer] = useState(false);
  const [pdc, setPdc] = useState<PreDeliveryCheck>(emptyPdc(null));

  const [includeUnitStockingNote, setUnitNote] = useState(true);
  const [includeIdRequirementNote, setIdNote] = useState(true);
  const [includeServiceHistoryNote, setShNote] = useState(true);
  const [customNote, setCustomNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const restoredRef = useRef(false);

  function applyVehicle(v: Vehicle | null, d: SalesDeal | null) {
    setVehicle(v);
    if (v) {
      setPresentMileage(v.mileage);
      setDorDate(v.firstRegisteredDate ?? "");
      setPdc(emptyPdc(v));
      setLines((prev) => [
        {
          uid: "vehicle-line",
          type: "vehicle_price",
          addonCategory: null,
          description: "SALES PRICE",
          quantity: 1,
          unitPrice: d?.agreedPrice ?? v.sellingPrice ?? v.listingPrice ?? 0,
        },
        ...prev.filter((l) => l.type !== "vehicle_price"),
      ]);
    }
  }

  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then(async (vs) => {
      setVehicles(vs);

      if (invoiceIdParam) {
        // ---- EDIT MODE: prefill from the existing invoice ----
        const inv = await invoiceService.getById(invoiceIdParam);
        if (!inv) {
          toast.error("Invoice not found");
          router.replace("/admin/invoicing");
          return;
        }
        if (inv.status === "paid" || inv.status === "cancelled") {
          toast.error(`${inv.status} invoices cannot be edited`);
          router.replace("/admin/invoicing");
          return;
        }
        const v = vs.find((x) => x.id === inv.vehicleId) ?? null;
        setVehicle(v);
        setVehicleId(inv.vehicleId ?? "");
        setBuyerName(inv.buyerName ?? inv.partyName);
        setBuyerAddress(inv.buyerAddress ?? "");
        setBuyerPostcode(inv.buyerPostcode ?? "");
        setBuyerPhone(inv.buyerPhone ?? inv.partyPhone ?? "");
        setBuyerEmail(inv.buyerEmail ?? inv.partyEmail ?? "");
        setPresentMileage(inv.presentMileage ?? v?.mileage ?? 0);
        setDorDate(inv.dorDate ?? v?.firstRegisteredDate ?? "");
        setInvoiceDate(inv.invoiceDate);
        setLines(
          inv.lineItems.map((li, i) => ({
            uid: li.type === "vehicle_price" ? "vehicle-line" : `${li.id || i}`,
            type: li.type,
            addonCategory: li.addonCategory,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
          })),
        );
        setVatScheme(inv.vatScheme);
        setDepositAmount(inv.depositAmount);
        if (inv.depositMethod) setDepositMethod(inv.depositMethod);
        setDepositReceivedDate(inv.depositReceivedDate ?? "");
        setFinanceAmount(inv.financeAmount);
        setFinanceProvider(inv.financeProvider ?? MOTOR_FINANCE_PROVIDERS[0]);
        setBalanceDueBy(inv.balanceDueBy ?? "");
        // Merged over the defaults so an invoice saved before a declaration
        // field existed (e.g. `type`) still opens with a complete form.
        setWarranty({ ...defaultWarranty(), ...(inv.warranty ?? {}) });
        setNonWarrantyDisclaimer(inv.nonWarrantyDisclaimerAccepted);
        setPdc(inv.preDeliveryCheck ?? emptyPdc(v));
        setUnitNote(inv.includeUnitStockingNote);
        setIdNote(inv.includeIdRequirementNote);
        setShNote(inv.includeServiceHistoryNote);
        setCustomNote(inv.customNote ?? "");
        restoredRef.current = true; // skip the draft-restore prompt in edit mode
        setLoading(false);
        return;
      }

      if (vehicleIdParam) {
        const v = vs.find((x) => x.id === vehicleIdParam) ?? null;
        setVehicleId(vehicleIdParam);
        const deals = await salesService.getAll(company.id);
        const d = deals.find((x) => x.vehicleId === vehicleIdParam) ?? null;
        setDeal(d);
        if (d) {
          setBuyerName(d.customerName);
          setBuyerPhone(d.customerPhone);
          setBuyerEmail(d.customerEmail ?? "");
          setDepositAmount(d.depositAmount ?? 0);
        }
        applyVehicle(v, d);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, vehicleIdParam, invoiceIdParam]);

  // ---- localStorage draft autosave (every 10s) ----
  const draftKey = company
    ? `cc-invoice-draft:${company.id}:${invoiceIdParam ?? vehicleIdParam ?? "new"}`
    : null;

  useEffect(() => {
    if (!draftKey || restoredRef.current) return;
    restoredRef.current = true;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (d.buyerName) setBuyerName(d.buyerName as string);
      if (d.buyerAddress) setBuyerAddress(d.buyerAddress as string);
      if (d.buyerPostcode) setBuyerPostcode(d.buyerPostcode as string);
      if (d.buyerPhone) setBuyerPhone(d.buyerPhone as string);
      if (d.buyerEmail) setBuyerEmail(d.buyerEmail as string);
      if (Array.isArray(d.lines)) setLines(d.lines as DraftLine[]);
      if (d.vatScheme) setVatScheme(d.vatScheme as VatScheme);
      if (d.customNote) setCustomNote(d.customNote as string);
      toast("Draft restored: a saved draft for this invoice was loaded");
    } catch {
      /* ignore corrupt draft */
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const t = setInterval(() => {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          buyerName,
          buyerAddress,
          buyerPostcode,
          buyerPhone,
          buyerEmail,
          lines,
          vatScheme,
          customNote,
        }),
      );
    }, 10_000);
    return () => clearInterval(t);
  }, [
    draftKey,
    buyerName,
    buyerAddress,
    buyerPostcode,
    buyerPhone,
    buyerEmail,
    lines,
    vatScheme,
    customNote,
  ]);

  function handleVehicleChange(id: string) {
    if (!vehicles) return;
    const v = vehicles.find((x) => x.id === id) ?? null;
    setVehicleId(id);
    applyVehicle(v, deal);
  }

  function addAddon(free: boolean) {
    const opt = ADDON_CATEGORY_OPTIONS[0];
    setLines((p) => [
      ...p,
      {
        uid: uid(),
        type: free ? "addon_free" : "addon_paid",
        addonCategory: opt.value,
        description: opt.defaultDescription,
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }
  function addDiscount() {
    if (lines.some((l) => l.type === "discount")) {
      toast.error("Only one discount line is allowed");
      return;
    }
    setLines((p) => [
      ...p,
      {
        uid: uid(),
        type: "discount",
        addonCategory: null,
        description: "DISCOUNT",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }
  function removeLine(u: string) {
    setLines((p) => p.filter((l) => l.uid !== u || l.type === "vehicle_price"));
  }
  function updateLine(u: string, patch: Partial<DraftLine>) {
    setLines((p) => p.map((l) => (l.uid === u ? { ...l, ...patch } : l)));
  }

  const calcLines: InvoiceLineItem[] = useMemo(
    () =>
      lines.map((l, i) => ({
        id: String(i),
        type: l.type,
        description: l.description,
        addonCategory: l.addonCategory,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        total:
          l.type === "addon_free"
            ? 0
            : round2(l.quantity * l.unitPrice),
        vatAmount: 0,
      })),
    [lines],
  );

  // Vehicle buying price drives margin-scheme VAT on the vehicle line.
  const vehicleCost = vehicle?.totalBuyingPrice ?? vehicle?.buyingPrice ?? 0;

  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        calcLines,
        vatScheme,
        depositAmount,
        financeAmount,
        vehicleCost,
      ),
    [calcLines, vatScheme, depositAmount, financeAmount, vehicleCost],
  );

  const hasWarrantyAddon = lines.some((l) => l.addonCategory === "warranty");
  // Legacy invoices saved before the in-house/external switch existed were
  // always in-house cover (GEN-66).
  const warrantyType: WarrantyType = warranty.type ?? "in_house";

  function validate(): string | null {
    if (!vehicle) return "Select a vehicle";
    if (!buyerName.trim()) return "Buyer name is required";
    if (!buyerAddress.trim()) return "Buyer address is required";
    if (!buyerPostcode.trim()) return "Buyer post code is required";
    if (!buyerPhone.trim()) return "Buyer phone is required";
    if (!isValidUkPhone(buyerPhone))
      return "Buyer phone doesn't look like a UK number (e.g. 07712 345678 or 020 7946 0958)";
    const vp = lines.find((l) => l.type === "vehicle_price");
    if (!vp || vp.quantity * vp.unitPrice <= 0)
      return "A vehicle SALES PRICE greater than zero is required";
    if (lines.filter((l) => l.type === "discount").length > 1)
      return "Only one discount line is allowed";
    if (depositAmount > 0 && !depositReceivedDate)
      return "Deposit received date is required when a deposit is entered";
    if (financeAmount > 0 && !financeProvider)
      return "Finance provider is required when a finance amount is entered";
    if (hasWarrantyAddon && nonWarrantyDisclaimer)
      return "Non-Warranty Disclaimer cannot be ticked alongside a Warranty add-on";
    if (
      !nonWarrantyDisclaimer &&
      warrantyType === "external" &&
      !warranty.provider.trim()
    )
      return "Provider name is required for an external warranty";
    if (pdc.numKeys < 1 || pdc.numKeys > 4)
      return "Number of keys must be between 1 and 4";
    if (
      pdc.engineServiceDoneMileage != null &&
      pdc.engineServiceDoneMileage > presentMileage
    )
      return "Engine service mileage cannot exceed present mileage";
    return null;
  }

  async function handleSubmit() {
    if (!user || !company || !vehicle) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (totals.overpayment) {
      const ok = await confirm({
        title: "Overpayment on this invoice?",
        description:
          "Deposit + finance exceed the grand total. Continue anyway?",
        confirmText: "Continue",
      });
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const payload = {
          companyId: company.id,
          type: "sale" as const,
          vehicleId: vehicle.id,
          partyName: buyerName,
          partyPhone: buyerPhone || null,
          partyEmail: buyerEmail || null,
          buyerName,
          buyerPhone: buyerPhone || null,
          buyerEmail: buyerEmail || null,
          buyerAddress: buyerAddress || null,
          buyerPostcode: buyerPostcode || null,
          invoiceDate,
          dueDate: balanceDueBy || null,
          vatScheme,
          lineItems: lines.map((l) => ({
            type: l.type,
            addonCategory: l.addonCategory,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.type === "addon_free" ? 0 : l.unitPrice,
            total:
              l.type === "addon_free"
                ? 0
                : round2(l.quantity * l.unitPrice),
          })),
          payment: null,
          notes: null,
          attachmentUrl: null,
          presentMileage,
          dorDate: dorDate || null,
          depositAmount,
          depositReceivedDate: depositReceivedDate || null,
          depositMethod,
          financeAmount,
          financeProvider: financeAmount > 0 ? financeProvider : null,
          balanceDueBy: balanceDueBy || null,
          warranty: hasWarrantyAddon || !nonWarrantyDisclaimer ? warranty : null,
          nonWarrantyDisclaimerAccepted: nonWarrantyDisclaimer,
          preDeliveryCheck: pdc,
          includeUnitStockingNote,
          includeIdRequirementNote,
          includeServiceHistoryNote,
          customNote: customNote || null,
          status: "issued" as const,
      };
      const invoice =
        editing && invoiceIdParam
          ? await invoiceService.update(invoiceIdParam, payload, user.id)
          : await invoiceService.create(payload, user.id);
      // Section F is the sale of the cover, so issuing the invoice is what
      // creates the warranty record — in-house included (GEN-66). Idempotent
      // on re-save, and cancels the policy if the disclaimer gets ticked.
      await warrantyService.syncFromInvoice(invoice, user.id, deal?.id ?? null);
      if (draftKey) localStorage.removeItem(draftKey);
      toast.success(
        `Invoice ${invoice.invoiceNumber} ${editing ? "updated" : "created"}`,
      );
      const blob = await pdfService.generateInvoice({
        invoice,
        vehicle,
        ...companyInvoiceFields(company),
      });
      downloadBlob(blob, `Invoice-${invoice.invoiceNumber}.pdf`);
      router.push("/admin/invoicing");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  if (permLoading || loading || !vehicles) return <Skeleton className="h-96" />;

  if (!allowed) {
    return (
      <EmptyState
        icon={ShieldX}
        title="You don't have access"
        description={
          editing
            ? "Editing invoices requires the Edit Invoice capability."
            : "Generating invoices requires the Generate Invoice capability."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {editing ? "Edit Invoice" : "Generate Invoice"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a legal, two-page sales invoice for a deal. Your draft saves
            automatically as you go.
          </p>
        </div>

        <Section letter="A" title="Vehicle">
          <Label htmlFor={vehicleFieldId}>
            Vehicle <span className="text-destructive">*</span>
          </Label>
          {/* One control, not two. This was a search box that filtered a
              separate dropdown — you typed in one field and picked in
              another. VehiclePicker does both (GEN-79). */}
          <VehiclePicker
            id={vehicleFieldId}
            vehicles={filteredVehicles}
            value={vehicle}
            onChange={(v) => handleVehicleChange(v?.id ?? "")}
            placeholder="Search by reg, stock ID or model…"
            className="mt-1"
          />
        </Section>

        <Section letter="B" title="Buyer Details">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={buyerNameId}>
                Buyer name (e.g. MR JOHN SMITH){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id={buyerNameId}
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label htmlFor={buyerPhoneId}>
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                id={buyerPhoneId}
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={buyerPostcodeId}>
                Post code <span className="text-destructive">*</span>
              </Label>
              {/* No Lookup button: the list appears as you type (GEN-68). */}
              <div className="relative">
                <Input
                  id={buyerPostcodeId}
                  value={buyerPostcode}
                  autoComplete="off"
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase();
                    setBuyerPostcode(next);
                    setPcListOpen(true);
                    lookupPostcodeDebounced(next);
                  }}
                  onFocus={() => setPcListOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setPcListOpen(false);
                    // One suggestion is the common case on the current
                    // provider — Enter takes it without reaching for the mouse.
                    if (e.key === "Enter" && pcSuggestions.length === 1) {
                      e.preventDefault();
                      acceptAddress(pcSuggestions[0]);
                    }
                  }}
                />
                {pcListOpen && pcSuggestions.length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover py-1 shadow-lg">
                    {pcSuggestions.map((sug) => (
                      <li key={sug.id}>
                        <button
                          type="button"
                          onClick={() => acceptAddress(sug)}
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                        >
                          <span className="font-medium">
                            {sug.line1 || sug.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {sug.line1 ? sug.label : sug.postcode}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {pcLoading
                  ? "Searching…"
                  : pcError
                    ? "Address lookup unavailable, enter the address manually."
                    : pcNotFound
                      ? "No match for that postcode, enter the address manually."
                      : pcHasPremises
                        ? "Start typing a postcode and pick your address."
                        : "Start typing a postcode and pick the area, then add your house number and street."}
              </p>
            </div>
            <div>
              <Label htmlFor={buyerAddressId}>
                Address line <span className="text-destructive">*</span>
              </Label>
              <Input
                id={buyerAddressId}
                value={buyerAddress}
                onChange={(e) => setBuyerAddress(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label htmlFor={buyerEmailId}>Email (optional)</Label>
              <Input
                id={buyerEmailId}
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
              />
            </div>
          </div>
        </Section>

        <Section letter="C" title="Sale Details (Date + Line Items)">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor={invoiceDateId}>Invoice date</Label>
              <Input
                id={invoiceDateId}
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={presentMileageId}>Present mileage</Label>
              <Input
                id={presentMileageId}
                type="number"
                value={presentMileage}
                onChange={(e) => setPresentMileage(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor={dorDateId}>D.O.R (first registered)</Label>
              <Input
                id={dorDateId}
                type="date"
                value={dorDate}
                onChange={(e) => setDorDate(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {lines.map((l) => (
              <div
                key={l.uid}
                className="flex flex-wrap items-end gap-2 rounded-md border p-2"
              >
                <div className="w-28">
                  <p className="text-xs">Type</p>
                  <div className="text-sm font-medium capitalize">
                    {l.type.replace("_", " ")}
                  </div>
                </div>
                {(l.type === "addon_paid" || l.type === "addon_free") && (
                  <div className="w-40">
                    <Label className="text-xs" htmlFor={`${l.uid}-category`}>
                      Category
                    </Label>
                    <Select
                      value={l.addonCategory ?? "custom"}
                      onValueChange={(v) => {
                        const opt = ADDON_CATEGORY_OPTIONS.find(
                          (o) => o.value === v,
                        );
                        updateLine(l.uid, {
                          addonCategory: v as AddonCategory,
                          description:
                            opt?.defaultDescription || l.description,
                        });
                      }}
                    >
                      <SelectTrigger id={`${l.uid}-category`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADDON_CATEGORY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs" htmlFor={`${l.uid}-description`}>
                    Description
                  </Label>
                  <Input
                    id={`${l.uid}-description`}
                    value={l.description}
                    onChange={(e) =>
                      updateLine(l.uid, { description: e.target.value })
                    }
                  />
                </div>
                {l.type !== "addon_free" && (
                  <div className="w-24">
                    <Label className="text-xs" htmlFor={`${l.uid}-unit-price`}>
                      Unit £
                    </Label>
                    <Input
                      id={`${l.uid}-unit-price`}
                      type="number"
                      value={l.unitPrice}
                      onChange={(e) =>
                        updateLine(l.uid, {
                          unitPrice: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                )}
                {l.type !== "vehicle_price" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeLine(l.uid)}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => addAddon(false)}>
              <Plus className="mr-1 h-3 w-3" /> Paid add-on
            </Button>
            <Button size="sm" variant="outline" onClick={() => addAddon(true)}>
              <Plus className="mr-1 h-3 w-3" /> Free add-on
            </Button>
            <Button size="sm" variant="outline" onClick={addDiscount}>
              <Plus className="mr-1 h-3 w-3" /> Discount
            </Button>
          </div>
        </Section>

        <Section letter="D" title="VAT Scheme">
          <RadioGroup
            value={vatScheme}
            onValueChange={(v) => setVatScheme(v as VatScheme)}
          >
            {(
              [
                ["margin_used", "Margin scheme (UK used-car standard)"],
                ["standard_20", "Standard 20% VAT"],
                ["zero_rated", "Zero rated (export / commercial)"],
              ] as [VatScheme, string][]
            ).map(([v, label]) => (
              <RadioItem key={v} value={v}>
                {label}
              </RadioItem>
            ))}
          </RadioGroup>
        </Section>

        <Section letter="E" title="Payment Breakdown">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={depositAmountId}>Customer deposit (£)</Label>
              <Input
                id={depositAmountId}
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor={depositMethodId}>Deposit method</Label>
              {/* items map: without it Base UI's SelectValue renders the raw
                  enum ("bank_transfer") in the closed trigger (GEN-51). */}
              <Select
                items={DEPOSIT_METHOD_OPTIONS.map(([value, label]) => ({
                  value,
                  label,
                }))}
                value={depositMethod}
                onValueChange={(v) => setDepositMethod(v as DepositMethod)}
              >
                <SelectTrigger id={depositMethodId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPOSIT_METHOD_OPTIONS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={depositReceivedDateId}>
                Deposit received date
              </Label>
              <Input
                id={depositReceivedDateId}
                type="date"
                value={depositReceivedDate}
                onChange={(e) => setDepositReceivedDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={financeAmountId}>Finance amount (£)</Label>
              <Input
                id={financeAmountId}
                type="number"
                value={financeAmount}
                onChange={(e) => setFinanceAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor={financeProviderId}>Finance provider</Label>
              <Select
                value={financeProvider}
                onValueChange={setFinanceProvider}
              >
                <SelectTrigger id={financeProviderId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTOR_FINANCE_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={balanceDueById}>Balance due by</Label>
              <Input
                id={balanceDueById}
                type="date"
                value={balanceDueBy}
                onChange={(e) => setBalanceDueBy(e.target.value)}
              />
            </div>
          </div>
        </Section>

        <Section letter="F" title="Warranty Declaration">
          {hasWarrantyAddon && (
            <p className="mb-2 text-xs text-amber-600">
              A Warranty add-on is present, so this section is required.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor={warrantyProviderTypeId}>
                Warranty provided by
              </Label>
              <Select
                items={{
                  in_house: "Car Capital (in-house)",
                  external: "External provider",
                }}
                value={warrantyType}
                onValueChange={(v) =>
                  setWarranty({
                    ...warranty,
                    type: v as WarrantyType,
                    // Swap the provider block wholesale so an in-house invoice
                    // never carries a stale third-party name into the PDF.
                    ...(v === "in_house"
                      ? {
                          provider: WARRANTY_DEFAULTS.provider,
                          providerPhone: WARRANTY_DEFAULTS.providerPhone,
                          providerEmail: WARRANTY_DEFAULTS.providerEmail,
                        }
                      : warranty.provider === WARRANTY_DEFAULTS.provider
                        ? { provider: "", providerPhone: "", providerEmail: "" }
                        : {}),
                  })
                }
              >
                <SelectTrigger id={warrantyProviderTypeId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_house">
                    Car Capital (in-house)
                  </SelectItem>
                  <SelectItem value="external">External provider</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {warrantyType === "external" ? (
              <>
                <div>
                  <Label htmlFor={warrantyProviderNameId}>Provider name</Label>
                  <Input
                    id={warrantyProviderNameId}
                    value={warranty.provider}
                    onChange={(e) =>
                      setWarranty({ ...warranty, provider: e.target.value })
                    }
                    placeholder="e.g. WarrantyWise"
                  />
                </div>
                <div>
                  <Label htmlFor={warrantyProviderPhoneId}>
                    Provider phone
                  </Label>
                  <Input
                    id={warrantyProviderPhoneId}
                    value={warranty.providerPhone}
                    onChange={(e) =>
                      setWarranty({
                        ...warranty,
                        providerPhone: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={warrantyProviderEmailId}>
                    Provider email
                  </Label>
                  <Input
                    id={warrantyProviderEmailId}
                    type="email"
                    value={warranty.providerEmail}
                    onChange={(e) =>
                      setWarranty({
                        ...warranty,
                        providerEmail: e.target.value,
                      })
                    }
                  />
                </div>
              </>
            ) : null}
            <div>
              <Label htmlFor={warrantyCoverTypeId}>Cover type</Label>
              <Select
                value={warranty.coverType}
                onValueChange={(v) =>
                  setWarranty({
                    ...warranty,
                    coverType: v as WarrantyDeclaration["coverType"],
                  })
                }
              >
                <SelectTrigger id={warrantyCoverTypeId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Basic", "Standard", "Premier", "Comprehensive"].map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={warrantyClaimLimitId}>Claim limit (£)</Label>
              <Input
                id={warrantyClaimLimitId}
                type="number"
                value={warranty.claimLimit}
                onChange={(e) =>
                  setWarranty({
                    ...warranty,
                    claimLimit: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor={warrantyDiagnosticsCoverId}>
                Diagnostics cover (£)
              </Label>
              <Input
                id={warrantyDiagnosticsCoverId}
                type="number"
                value={warranty.diagnosticsCover}
                onChange={(e) =>
                  setWarranty({
                    ...warranty,
                    diagnosticsCover: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor={warrantyDurationId}>Duration</Label>
              <Select
                value={warranty.duration}
                onValueChange={(v) =>
                  setWarranty({
                    ...warranty,
                    duration: v as WarrantyDeclaration["duration"],
                  })
                }
              >
                <SelectTrigger id={warrantyDurationId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1 Month", "3 Months", "6 Months", "12 Months"].map(
                    (d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={warrantyExcessPercentId}>Excess (%)</Label>
              <Input
                id={warrantyExcessPercentId}
                type="number"
                value={warranty.excessPercent}
                onChange={(e) =>
                  setWarranty({
                    ...warranty,
                    excessPercent: Number(e.target.value),
                  })
                }
              />
            </div>
            <label className="flex items-end gap-2 text-sm">
              <Checkbox
                checked={warranty.wearTearCovered}
                onCheckedChange={(v) =>
                  setWarranty({ ...warranty, wearTearCovered: Boolean(v) })
                }
              />
              Wear &amp; Tear covered
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <Checkbox
              checked={nonWarrantyDisclaimer}
              onCheckedChange={(v) =>
                setNonWarrantyDisclaimer(Boolean(v))
              }
            />
            Non-Warranty Disclaimer accepted (opted out of comprehensive cover)
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            {nonWarrantyDisclaimer
              ? "No warranty record will be created for this sale."
              : `Issuing this invoice creates an ${
                  warrantyType === "external" ? "external" : "in-house"
                } warranty record, running ${warranty.duration.toLowerCase()} from the invoice date.`}
          </p>
        </Section>

        <Section letter="G" title="Pre-Delivery Check">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PDI_ITEMS.map((it) => (
              <label
                key={it.key as string}
                className="flex items-center gap-2 text-xs"
              >
                <Checkbox
                  checked={Boolean(pdc[it.key])}
                  onCheckedChange={(v) =>
                    setPdc({ ...pdc, [it.key]: Boolean(v) })
                  }
                />
                {it.label}
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={pdc.lockNut}
                onCheckedChange={(v) =>
                  setPdc({ ...pdc, lockNut: Boolean(v) })
                }
              />
              Lock nut
            </label>
            <div>
              <Label htmlFor={numKeysId}>No. of keys</Label>
              <Input
                id={numKeysId}
                type="number"
                value={pdc.numKeys}
                onChange={(e) =>
                  setPdc({ ...pdc, numKeys: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor={serviceHistoryId}>Service history</Label>
              <Input
                id={serviceHistoryId}
                value={pdc.serviceHistoryStatus}
                onChange={(e) =>
                  setPdc({ ...pdc, serviceHistoryStatus: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor={engineServiceDateId}>Engine service date</Label>
              <Input
                id={engineServiceDateId}
                type="date"
                value={pdc.engineServiceDoneDate ?? ""}
                onChange={(e) =>
                  setPdc({
                    ...pdc,
                    engineServiceDoneDate: e.target.value || null,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor={engineServiceMileageId}>
                Engine service mileage
              </Label>
              <Input
                id={engineServiceMileageId}
                type="number"
                value={pdc.engineServiceDoneMileage ?? ""}
                onChange={(e) =>
                  setPdc({
                    ...pdc,
                    engineServiceDoneMileage: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor={v5StatusId}>V5 status</Label>
              <Select
                value={pdc.v5Status}
                onValueChange={(v) =>
                  setPdc({
                    ...pdc,
                    v5Status: v as PreDeliveryCheck["v5Status"],
                  })
                }
              >
                <SelectTrigger id={v5StatusId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["V5C-2 Green Slip", "V5C Awaited", "Not Received"].map(
                    (o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={hpiCheckResultId}>HPI / history check</Label>
              <Select
                value={pdc.hpiCheckResult}
                onValueChange={(v) =>
                  setPdc({
                    ...pdc,
                    hpiCheckResult: v as PreDeliveryCheck["hpiCheckResult"],
                  })
                }
              >
                <SelectTrigger id={hpiCheckResultId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Clear", "Issues Found", "Pending", "Not Performed"].map(
                    (o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section letter="H" title="Notes & Declarations">
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={includeUnitStockingNote}
                onCheckedChange={(v) => setUnitNote(Boolean(v))}
              />
              Include unit-stocking note
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={includeIdRequirementNote}
                onCheckedChange={(v) => setIdNote(Boolean(v))}
              />
              Include ID-requirement note
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={includeServiceHistoryNote}
                onCheckedChange={(v) => setShNote(Boolean(v))}
              />
              Include service-history note
            </label>
            <div>
              <Label htmlFor={customNoteId}>Custom note</Label>
              <Textarea
                id={customNoteId}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
              />
            </div>
          </div>
        </Section>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/invoicing")}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="generate-invoice"
          >
            {submitting
              ? editing
                ? "Updating…"
                : "Generating…"
              : editing
                ? "Update Invoice"
                : "Generate Invoice"}
          </Button>
        </div>
      </div>

      {/* Sticky cost summary */}
      <div className="xl:w-72">
        <Card className="xl:sticky xl:top-4 p-4">
          <h2 className="text-sm font-semibold">Cost Summary</h2>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            <Row label="Vehicle (Sales Price)" v={totals.salesPrice} />
            {totals.discount > 0 && (
              <Row label="Discount" v={-totals.discount} />
            )}
            <div className="my-1 border-t" />
            <Row label="Subtotal" v={totals.subtotal} />
            <Row label="Add-ons (paid)" v={totals.paidAddonsTotal} />
            <div className="flex justify-between text-muted-foreground">
              <span>Add-ons (free)</span>
              <span>{totals.freeAddonsCount} items</span>
            </div>
            <Row label="VAT" v={totals.vatAmount} />
            <div className="my-1 border-t" />
            <div className="flex justify-between font-semibold">
              <span>GRAND TOTAL</span>
              <span>{formatCurrency(totals.grandTotalInclAddons)}</span>
            </div>
            {depositAmount > 0 && (
              <Row label="Customer Deposit" v={-depositAmount} />
            )}
            {financeAmount > 0 && (
              <Row label="Finance Amount" v={-financeAmount} />
            )}
            <div className="my-1 border-t" />
            <div className="flex justify-between font-semibold">
              <span>BALANCE DUE</span>
              <span>{formatCurrency(totals.balanceDue)}</span>
            </div>
            {totals.overpayment && (
              <p className="text-xs text-destructive">Overpayment</p>
            )}
          </div>
        </Card>
      </div>
      {confirmDialog}
    </div>
  );
}

function Row({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatCurrency(v)}</span>
    </div>
  );
}
