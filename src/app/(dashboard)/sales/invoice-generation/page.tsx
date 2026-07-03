"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { downloadBlob, pdfService } from "@/lib/services/pdf-service";
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
} from "@/lib/types";
import {
  ADDON_CATEGORY_OPTIONS,
  FINANCE_PROVIDERS,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, cn } from "@/lib/utils";
import { usePostcodeLookup } from "@/hooks/use-postcode-lookup";
import { toast } from "@/lib/toast";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

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
  v5Status: v?.v5Received ? "V5C-2 Green Slip" : "V5C — Awaited",
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
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [deal, setDeal] = useState<SalesDeal | null>(null);
  const [loading, setLoading] = useState(true);

  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerPostcode, setBuyerPostcode] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  const { lookup: lookupPostcode, isLoading: pcLoading } = usePostcodeLookup();

  // Reg-number / stock / model search over the vehicle picker (the stock list
  // can run to 50+ cars — a plain dropdown isn't navigable).
  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase().replace(/\s+/g, "");
    const list = (vehicles ?? []).filter(
      // Don't offer already-sold/returned cars for a fresh invoice — except the
      // one already selected/being edited, so existing invoices still load.
      (v) =>
        v.id === vehicleId ||
        (v.status !== "sold" && v.status !== "returned"),
    );
    if (!q) return list;
    return list.filter((v) =>
      `${v.stockId}${v.registration}${v.make}${v.model}`
        .toLowerCase()
        .replace(/\s+/g, "")
        .includes(q),
    );
  }, [vehicles, vehicleQuery, vehicleId]);

  async function handlePostcodeLookup() {
    if (!buyerPostcode.trim()) {
      toast.error("Enter a postcode first");
      return;
    }
    const r = await lookupPostcode(buyerPostcode);
    if (!r) {
      toast.error("No address found — enter manually");
      return;
    }
    setBuyerAddress(
      [r.line1, r.line2, r.line3, r.line4]
        .filter(Boolean)
        .join(", ")
        .toUpperCase(),
    );
    toast.success("Address filled — review and adjust");
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
    FINANCE_PROVIDERS[0],
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
        setFinanceProvider(inv.financeProvider ?? FINANCE_PROVIDERS[0]);
        setBalanceDueBy(inv.balanceDueBy ?? "");
        setWarranty(inv.warranty ?? defaultWarranty());
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
      toast("Draft restored — a saved draft for this invoice was loaded");
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

  function validate(): string | null {
    if (!vehicle) return "Select a vehicle";
    if (!buyerName.trim()) return "Buyer name is required";
    if (!buyerAddress.trim()) return "Buyer address is required";
    if (!buyerPostcode.trim()) return "Buyer post code is required";
    if (!buyerPhone.trim()) return "Buyer phone is required";
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
      if (draftKey) localStorage.removeItem(draftKey);
      toast.success(
        `Invoice ${invoice.invoiceNumber} ${editing ? "updated" : "created"}`,
      );
      const blob = await pdfService.generateInvoice({
        invoice,
        companyName: company.name,
        companyAddress: company.address,
        vatNumber: company.vatNumber,
        vehicle,
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
          <Label>
            Vehicle <span className="text-destructive">*</span>
          </Label>
          <Input
            value={vehicleQuery}
            onChange={(e) => setVehicleQuery(e.target.value)}
            placeholder="Search reg, stock ID, make or model…"
            className="mb-2 mt-1"
          />
          <Select
            items={Object.fromEntries(
              vehicles.map((v) => [
                v.id,
                `${v.stockId} — ${v.registration} — ${v.make} ${v.model}`,
              ]),
            )}
            value={vehicleId}
            onValueChange={handleVehicleChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a vehicle…" />
            </SelectTrigger>
            <SelectContent>
              {filteredVehicles.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No vehicles match that search
                </div>
              ) : (
                filteredVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.stockId} — {v.registration} — {v.make} {v.model}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Section>

        <Section letter="B" title="Buyer Details">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>
                Buyer name (e.g. MR JOHN SMITH){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label>
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>
                Address line <span className="text-destructive">*</span>
              </Label>
              <Input
                value={buyerAddress}
                onChange={(e) => setBuyerAddress(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label>
                Post code <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={buyerPostcode}
                  onChange={(e) =>
                    setBuyerPostcode(e.target.value.toUpperCase())
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handlePostcodeLookup()}
                  disabled={pcLoading}
                  className="shrink-0"
                >
                  {pcLoading ? "…" : "Lookup"}
                </Button>
              </div>
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
              />
            </div>
          </div>
        </Section>

        <Section letter="C" title="Sale Details (Date + Line Items)">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Invoice date</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Present mileage</Label>
              <Input
                type="number"
                value={presentMileage}
                onChange={(e) => setPresentMileage(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>D.O.R (first registered)</Label>
              <Input
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
                  <Label className="text-xs">Type</Label>
                  <div className="text-sm font-medium capitalize">
                    {l.type.replace("_", " ")}
                  </div>
                </div>
                {(l.type === "addon_paid" || l.type === "addon_free") && (
                  <div className="w-40">
                    <Label className="text-xs">Category</Label>
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
                      <SelectTrigger>
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
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={l.description}
                    onChange={(e) =>
                      updateLine(l.uid, { description: e.target.value })
                    }
                  />
                </div>
                {l.type !== "addon_free" && (
                  <div className="w-24">
                    <Label className="text-xs">Unit £</Label>
                    <Input
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
          <div className="flex flex-col gap-2">
            {(
              [
                ["margin_used", "Margin scheme (UK used-car standard)"],
                ["standard_20", "Standard 20% VAT"],
                ["zero_rated", "Zero rated (export / commercial)"],
              ] as [VatScheme, string][]
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={vatScheme === v}
                  onChange={() => setVatScheme(v)}
                />
                {label}
              </label>
            ))}
          </div>
        </Section>

        <Section letter="E" title="Payment Breakdown">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Customer deposit (£)</Label>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Deposit method</Label>
              <Select
                value={depositMethod}
                onValueChange={(v) => setDepositMethod(v as DepositMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      ["bank_transfer", "Bank Transfer"],
                      ["cash", "Cash"],
                      ["card", "Card"],
                      ["cheque", "Cheque"],
                      ["pdq", "PDQ"],
                    ] as [DepositMethod, string][]
                  ).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deposit received date</Label>
              <Input
                type="date"
                value={depositReceivedDate}
                onChange={(e) => setDepositReceivedDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Finance amount (£)</Label>
              <Input
                type="number"
                value={financeAmount}
                onChange={(e) => setFinanceAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Finance provider</Label>
              <Select
                value={financeProvider}
                onValueChange={setFinanceProvider}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCE_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Balance due by</Label>
              <Input
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
              A Warranty add-on is present — this section is required.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Cover type</Label>
              <Select
                value={warranty.coverType}
                onValueChange={(v) =>
                  setWarranty({
                    ...warranty,
                    coverType: v as WarrantyDeclaration["coverType"],
                  })
                }
              >
                <SelectTrigger>
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
              <Label>Claim limit (£)</Label>
              <Input
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
              <Label>Diagnostics cover (£)</Label>
              <Input
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
              <Label>Duration</Label>
              <Select
                value={warranty.duration}
                onValueChange={(v) =>
                  setWarranty({
                    ...warranty,
                    duration: v as WarrantyDeclaration["duration"],
                  })
                }
              >
                <SelectTrigger>
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
              <Label>Excess (%)</Label>
              <Input
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
              <Label>No. of keys</Label>
              <Input
                type="number"
                value={pdc.numKeys}
                onChange={(e) =>
                  setPdc({ ...pdc, numKeys: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Service history</Label>
              <Input
                value={pdc.serviceHistoryStatus}
                onChange={(e) =>
                  setPdc({ ...pdc, serviceHistoryStatus: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Engine service date</Label>
              <Input
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
              <Label>Engine service mileage</Label>
              <Input
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
              <Label>V5 status</Label>
              <Select
                value={pdc.v5Status}
                onValueChange={(v) =>
                  setPdc({
                    ...pdc,
                    v5Status: v as PreDeliveryCheck["v5Status"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["V5C-2 Green Slip", "V5C — Awaited", "Not Received"].map(
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
              <Label>HPI / history check</Label>
              <Select
                value={pdc.hpiCheckResult}
                onValueChange={(v) =>
                  setPdc({
                    ...pdc,
                    hpiCheckResult: v as PreDeliveryCheck["hpiCheckResult"],
                  })
                }
              >
                <SelectTrigger>
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
              <Label>Custom note</Label>
              <Textarea
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
