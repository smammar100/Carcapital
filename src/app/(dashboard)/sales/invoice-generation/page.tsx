"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { invoiceService } from "@/lib/services/invoice-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { salesService } from "@/lib/services/sales-service";
import {
  downloadBlob,
  openBlobInNewTab,
  pdfService,
} from "@/lib/services/pdf-service";
import type {
  AddonType,
  DepositMethod,
  Invoice,
  InvoiceLineType,
  SalesDeal,
  Vehicle,
  VatScheme,
} from "@/lib/types";
import { calculateVat, formatVatLabel } from "@/lib/vat";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const ADDON_OPTIONS: { value: AddonType; label: string; defaultDescription: string }[] = [
  { value: "warranty", label: "Warranty", defaultDescription: "Extended Warranty (12 months)" },
  { value: "home_delivery", label: "Home Delivery", defaultDescription: "Home delivery service" },
  { value: "wash", label: "Wash", defaultDescription: "Vehicle wash" },
  { value: "polish", label: "Polish", defaultDescription: "Polish & detail" },
  { value: "fuel", label: "Fuel", defaultDescription: "Full tank of fuel" },
  { value: "floor_mats", label: "Floor Mats", defaultDescription: "Floor mats" },
  { value: "service_pack", label: "Service Pack", defaultDescription: "Service pack" },
  { value: "paint_protection", label: "Paint Protection", defaultDescription: "Paint protection" },
  { value: "accessories", label: "Accessories", defaultDescription: "Accessories" },
  { value: "custom", label: "Custom", defaultDescription: "" },
];

const FINANCE_PROVIDERS = [
  "Close Brothers",
  "MotoNovo",
  "Black Horse",
  "V12 Finance",
  "Other",
] as const;

interface DraftLine {
  uid: string;
  lineType: InvoiceLineType;
  addonType: AddonType | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeVehicleLine(vehicle: Vehicle | null, deal: SalesDeal | null): DraftLine {
  const price = deal?.agreedPrice ?? vehicle?.listingPrice ?? 0;
  return {
    uid: "vehicle-line",
    lineType: "vehicle",
    addonType: null,
    description: vehicle
      ? `${vehicle.make} ${vehicle.model} ${vehicle.registration}`
      : "Vehicle",
    quantity: 1,
    unitPrice: price,
  };
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
  const searchParams = useSearchParams();
  const vehicleIdParam = searchParams.get("vehicleId");
  const { user, company } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [deal, setDeal] = useState<SalesDeal | null>(null);
  const [loading, setLoading] = useState(true);

  // Buyer
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");

  // Lines
  const [lines, setLines] = useState<DraftLine[]>([makeVehicleLine(null, null)]);

  // VAT
  const [vatScheme, setVatScheme] = useState<VatScheme>("margin");

  // Payment
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("card");
  const [financeAmount, setFinanceAmount] = useState<number>(0);
  const [financeProvider, setFinanceProvider] = useState<string>("");
  const [balanceDueBy, setBalanceDueBy] = useState<string>("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);

  // Load vehicles + initialise from query param
  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then(async (vs) => {
      setVehicles(vs);
      const initialId = vehicleIdParam ?? "";
      if (initialId) {
        const v = vs.find((x) => x.id === initialId) ?? null;
        setVehicleId(initialId);
        setVehicle(v);
        // pre-fill from sales deal
        const deals = await salesService.getAll(company.id);
        const d = deals.find((x) => x.vehicleId === initialId) ?? null;
        setDeal(d);
        if (d) {
          setBuyerName(d.customerName);
          setBuyerPhone(d.customerPhone);
          setBuyerEmail(d.customerEmail ?? "");
          setDepositAmount(d.depositAmount ?? 0);
        }
        setLines([makeVehicleLine(v, d)]);
      }
      setLoading(false);
    });
  }, [company, vehicleIdParam]);

  // When vehicle changes manually, refresh the vehicle line
  function handleVehicleChange(id: string) {
    if (!vehicles) return;
    const v = vehicles.find((x) => x.id === id) ?? null;
    setVehicleId(id);
    setVehicle(v);
    setLines((prev) => [
      makeVehicleLine(v, deal),
      ...prev.filter((l) => l.lineType !== "vehicle"),
    ]);
  }

  function addAddon() {
    const opt = ADDON_OPTIONS[0];
    setLines((prev) => [
      ...prev,
      {
        uid: uid(),
        lineType: "addon",
        addonType: opt.value,
        description: opt.defaultDescription,
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }

  function addDiscount() {
    setLines((prev) => [
      ...prev,
      {
        uid: uid(),
        lineType: "discount",
        addonType: null,
        description: "Discount",
        quantity: 1,
        unitPrice: 0, // user enters as positive, we render as negative below
      },
    ]);
  }

  function changeAddonType(uidStr: string, addon: AddonType) {
    const opt = ADDON_OPTIONS.find((o) => o.value === addon);
    setLines((prev) =>
      prev.map((l) =>
        l.uid === uidStr
          ? { ...l, addonType: addon, description: opt?.defaultDescription ?? l.description }
          : l,
      ),
    );
  }

  function removeLine(uidStr: string) {
    setLines((prev) => prev.filter((l) => l.uid !== uidStr || l.lineType === "vehicle"));
  }

  function updateLine(uidStr: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.uid === uidStr ? { ...l, ...patch } : l)));
  }

  // Totals
  const totals = useMemo(() => {
    const vehicleCost = vehicle?.totalBuyingPrice ?? vehicle?.buyingPrice ?? 0;
    let subtotal = 0;
    let addonsTotal = 0;
    let discountTotal = 0;
    let vatAmount = 0;
    for (const l of lines) {
      // Discounts: user types positive, we treat as negative
      const signedNet =
        l.lineType === "discount"
          ? -Math.abs(l.quantity * l.unitPrice)
          : l.quantity * l.unitPrice;
      const { vatAmount: lineVat } = calculateVat({
        scheme: vatScheme,
        lineNet: signedNet,
        isVehicleLine: l.lineType === "vehicle",
        vehicleCost,
      });
      subtotal += signedNet;
      if (l.lineType === "addon") addonsTotal += signedNet;
      if (l.lineType === "discount") discountTotal += signedNet;
      vatAmount += lineVat;
    }
    const grandTotal = subtotal + vatAmount;
    const balanceDue = grandTotal - depositAmount - financeAmount;
    return {
      subtotal: round2(subtotal),
      addonsTotal: round2(addonsTotal),
      discountTotal: round2(discountTotal),
      vatAmount: round2(vatAmount),
      grandTotal: round2(grandTotal),
      balanceDue: round2(balanceDue),
    };
  }, [lines, vatScheme, vehicle, depositAmount, financeAmount]);

  const paymentMismatch = Math.abs(totals.balanceDue) > 0.01 && depositAmount + financeAmount > totals.grandTotal + 0.01;

  async function handleSubmit() {
    if (!user || !company) return;
    if (!vehicle) {
      toast.error("Pick a vehicle");
      return;
    }
    if (!buyerName.trim()) {
      toast.error("Buyer name is required");
      return;
    }
    if (!buyerAddress.trim()) {
      toast.error("Buyer address is required for sales invoices");
      return;
    }
    setSubmitting(true);
    try {
      const invoice = await invoiceService.create(
        {
          companyId: company.id,
          type: "sale",
          vehicleId: vehicle.id,
          partyName: buyerName,
          partyPhone: buyerPhone || null,
          partyEmail: buyerEmail || null,
          buyerName,
          buyerPhone: buyerPhone || null,
          buyerEmail: buyerEmail || null,
          buyerAddress: buyerAddress || null,
          invoiceDate: new Date().toISOString().slice(0, 10),
          dueDate: balanceDueBy || null,
          vatScheme,
          lineItems: lines.map((l) => ({
            lineType: l.lineType,
            addonType: l.addonType,
            description: l.description,
            quantity: l.quantity,
            unitPrice:
              l.lineType === "discount" ? -Math.abs(l.unitPrice) : l.unitPrice,
            vatRate: vatScheme === "standard" ? 0.2 : 0,
          })),
          payment:
            depositAmount > 0 || financeAmount > 0
              ? {
                  depositAmount,
                  depositMethod,
                  financeAmount,
                  financeProvider: financeAmount > 0 ? financeProvider || null : null,
                  balanceDueBy: balanceDueBy || null,
                }
              : null,
          notes: null,
          attachmentUrl: null,
        },
        user.id,
      );
      toast.success(`Invoice ${invoice.invoiceNumber} created`);
      await openInvoicePdf(invoice);
      router.push("/admin/invoicing");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  async function openInvoicePdf(invoice: Invoice) {
    if (!company) return;
    const blob = await pdfService.generateInvoice({
      invoice,
      companyName: company.name,
      companyAddress: company.address,
      vatNumber: company.vatNumber,
    });
    openBlobInNewTab(blob);
  }

  if (loading || !vehicles) {
    return <Skeleton className="h-96" />;
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No vehicles to invoice"
        description="Add a vehicle and progress a deal to deposit-taken before generating an invoice."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Generate Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Sales invoice with structured add-ons, VAT scheme, and payment breakdown.
          </p>
        </div>

        {/* Section 1 — Vehicle */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">Vehicle</h2>
          <div>
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={handleVehicleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.stockId} — {v.registration} — {v.make} {v.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {vehicle && (
            <div className="flex flex-wrap items-center gap-3 rounded border bg-muted/30 p-3 text-xs">
              <RegPlate registration={vehicle.registration} size="sm" />
              <span className="font-medium">
                {vehicle.make} {vehicle.model}
              </span>
              <span className="text-muted-foreground">
                {vehicle.year} · {vehicle.colour} · {vehicle.mileage.toLocaleString()} mi
              </span>
              <span className="ml-auto font-mono">{vehicle.stockId}</span>
            </div>
          )}
        </Card>

        {/* Section 2 — Buyer */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">Buyer details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Buyer name *</Label>
              <Input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Address *</Label>
              <Input
                value={buyerAddress}
                onChange={(e) => setBuyerAddress(e.target.value)}
                placeholder="12 Maple Street, Slough, SL1 1AA"
              />
            </div>
          </div>
        </Card>

        {/* Section 3 — Line items */}
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Line items</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addAddon}>
                <Plus className="mr-1 h-3 w-3" />
                Add Add-on
              </Button>
              <Button size="sm" variant="outline" onClick={addDiscount}>
                <Plus className="mr-1 h-3 w-3" />
                Add Discount
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {lines.map((l) => (
              <div
                key={l.uid}
                className="grid grid-cols-[100px_1fr_60px_100px_30px] items-end gap-2 rounded border p-2 text-xs"
              >
                <div>
                  <Label className="text-[10px] uppercase">Type</Label>
                  {l.lineType === "addon" ? (
                    <Select
                      value={l.addonType ?? "custom"}
                      onValueChange={(v) => changeAddonType(l.uid, v as AddonType)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADDON_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex h-8 items-center px-2 capitalize text-muted-foreground">
                      {l.lineType}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Description</Label>
                  <Input
                    value={l.description}
                    onChange={(e) => updateLine(l.uid, { description: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => updateLine(l.uid, { quantity: Number(e.target.value) || 1 })}
                    className="h-8 text-right"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">
                    {l.lineType === "discount" ? "Amount £" : "Unit £"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={l.unitPrice}
                    onChange={(e) => updateLine(l.uid, { unitPrice: Number(e.target.value) || 0 })}
                    className="h-8 text-right"
                  />
                </div>
                <div className="self-center">
                  {l.lineType !== "vehicle" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => removeLine(l.uid)}
                      title="Remove line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Section 4 — VAT scheme */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">VAT scheme</h2>
          <div className="flex flex-wrap gap-2">
            {(["margin", "standard", "zero_rated"] as VatScheme[]).map((v) => (
              <Button
                key={v}
                variant={vatScheme === v ? "default" : "outline"}
                size="sm"
                onClick={() => setVatScheme(v)}
              >
                {formatVatLabel(v)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Margin scheme applies VAT to the profit margin only on the vehicle line.
            Add-ons fall back to standard 20%.
          </p>
        </Card>

        {/* Section 5 — Payment breakdown */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">Payment breakdown</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Deposit (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
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
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Finance (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={financeAmount}
                onChange={(e) => setFinanceAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Finance provider</Label>
              <Select
                value={financeProvider}
                onValueChange={setFinanceProvider}
                disabled={financeAmount === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a provider" />
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
              <Label>Balance due (auto)</Label>
              <Input
                value={formatCurrency(totals.balanceDue)}
                readOnly
                className="bg-muted"
              />
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
          {paymentMismatch && (
            <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Deposit + finance exceed grand total — please review.
            </p>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/sales/pipeline")}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Generating…" : "Generate PDF"}
          </Button>
        </div>
      </div>

      {/* Sticky cost summary */}
      <Card className="flex h-fit flex-col gap-2 p-5 lg:sticky lg:top-4">
        <h2 className="text-sm font-semibold">Cost summary</h2>
        <Row label="Vehicle" value={lines.find((l) => l.lineType === "vehicle")?.unitPrice ?? 0} />
        <Row label="Add-ons" value={totals.addonsTotal} />
        <Row label="Discounts" value={totals.discountTotal} />
        <div className="my-1 border-t" />
        <Row label="Subtotal" value={totals.subtotal} />
        <Row label="VAT" value={totals.vatAmount} />
        <div className="my-1 border-t" />
        <Row label="Grand Total" value={totals.grandTotal} bold />
        <div className="my-2 border-t border-dashed" />
        <Row label="Deposit Paid" value={-depositAmount} muted />
        <Row label="Finance" value={-financeAmount} muted />
        <div className="my-1 border-t" />
        <Row label="Balance Due" value={totals.balanceDue} bold />
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-xs ${
        bold ? "text-base font-semibold" : ""
      } ${muted ? "text-muted-foreground" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
