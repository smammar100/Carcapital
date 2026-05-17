"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { todoService } from "@/lib/services/todo-service";
import { dvlaService } from "@/lib/services/dvla-service";
import { dealerPartnerService } from "@/lib/services/dealer-partner-service";
import type { DealerPartner } from "@/lib/types";
import {
  AUCTION_HOUSES,
  BODY_TYPES,
  FINANCE_PROVIDERS,
  FUEL_TYPES,
  VAT_RATE,
} from "@/lib/constants";
import { CostSummaryReceipt } from "./cost-summary-receipt";
import { toast } from "sonner";
import { cn, formatCurrency, formatRegPlate } from "@/lib/utils";

// v4.1 spec §11.3 — single scrollable Add Vehicle page with 7 sections
// + sticky cost summary. NO wizard, NO "New Costs"/"Key Tag Number"/
// "Switch Companies" fields (TC-P1-005).

const SOURCE_OPTIONS = [
  { value: "auction", label: "Auction" },
  { value: "private", label: "Private Seller" },
  { value: "trade_in", label: "Trade-in" },
  { value: "dealer", label: "Dealer" },
  { value: "other", label: "Other" },
] as const;

const SERVICE_HISTORY_OPTIONS = [
  { value: "full", label: "Full" },
  { value: "partial", label: "Partial" },
  { value: "none", label: "None" },
  { value: "unknown", label: "Unknown" },
] as const;

const VEHICLE_TYPE_OPTIONS = [
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
] as const;

const TRANSMISSION_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
] as const;

const todoSchema = z.object({
  description: z.string().min(1),
  cost: z.coerce.number().min(0).optional(),
});

const schema = z.object({
  // Section 1 — Vehicle Identity
  registration: z.string().min(2, "Registration required"),
  make: z.string().min(1, "Make required"),
  model: z.string().min(1, "Model required"),
  variantName: z.string().optional(),
  variantCode: z.string().optional(),
  year: z.coerce.number().int().min(1980).max(2030),
  colour: z.string().optional(),
  mileage: z.coerce.number().int().min(0),
  vehicleType: z.enum(["car", "van"]),
  bodyType: z.enum(["hatchback", "saloon", "suv", "mpv", "estate", "convertible", "coupe"]),
  fuelType: z.enum(["petrol", "diesel", "hybrid", "electric"]),
  transmission: z.enum(["manual", "automatic"]),
  engineSizeCC: z.coerce.number().int().optional(),

  // Section 2 — Source / Seller
  sellerName: z.string().min(1, "Seller name required"),
  sellerPhone: z.string().optional(),
  sourceType: z.enum(["auction", "private", "trade_in", "dealer", "other"]),
  localOrImport: z.enum(["local", "import"]),
  auctionHouse: z.string().optional(),
  ownedBy: z.string().optional(),
  managedBy: z.string().optional(),
  invoiceDate: z.string().optional(),

  // Section 3 — Documentation
  v5Received: z.boolean(),
  serviceHistory: z.enum(["full", "partial", "none", "unknown"]),
  numKeys: z.coerce.number().int().min(1).max(4),
  lockNut: z.boolean(),
  motExpiry: z.string().optional(),

  // Section 4 — Purchase Cost Breakdown
  buyingPrice: z.coerce.number().min(0),
  buyersFee: z.coerce.number().min(0).optional(),
  inspectionCharge: z.coerce.number().min(0).optional(),
  collectionFee: z.coerce.number().min(0).optional(),
  deliveryFee: z.coerce.number().min(0).optional(),
  lateStorageFee: z.coerce.number().min(0).optional(),
  otherCharges: z.coerce.number().min(0).optional(),

  financeProvider: z.enum(["none", "next_gear", "close_brothers", "bca", "infinit"]),

  // Section 5 — Receiving
  receivedDate: z.string().min(1, "Received date required"),

  // Section 7 — Pricing (optional)
  warrantyCost: z.coerce.number().min(0).optional(),
  minimumSalePrice: z.coerce.number().min(0).optional(),
  listingPrice: z.coerce.number().min(0).optional(),
});

type FormInput = z.input<typeof schema>;

export function ArrivalForm() {
  const { user, company } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // dvlaState drives the inline status shown under the registration field.
  //  - idle         : nothing has been looked up yet
  //  - loading      : lookup in flight
  //  - found        : DVLA returned data and the form has been auto-filled
  //  - not_found    : DVLA didn't recognise this reg, or the format was invalid
  //  - duplicate    : we already have this reg in our stock book (we don't
  //                   even call DVLA — we show the user where to find it)
  const [dvlaState, setDvlaState] = useState<
    "idle" | "loading" | "found" | "not_found" | "duplicate"
  >("idle");
  // Populated only when dvlaState === "duplicate"
  const [duplicate, setDuplicate] = useState<{
    id: string;
    stockId: string;
    label: string;
  } | null>(null);
  const [todos, setTodos] = useState<{ description: string; cost: number }[]>([]);
  const [newTodo, setNewTodo] = useState({ description: "", cost: 0 });
  // SPEC Points 6/7 — dealer partner picker (shown when source = Dealer).
  const searchParams = useSearchParams();
  const [partners, setPartners] = useState<DealerPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    searchParams.get("dealerPartner") ?? "",
  );

  useEffect(() => {
    if (!company) return;
    void dealerPartnerService
      .getAll(company.id)
      .then((p) => setPartners(p.filter((x) => x.active)));
  }, [company]);

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      registration: "",
      make: "",
      model: "",
      variantName: "",
      variantCode: "",
      year: new Date().getFullYear() - 3,
      colour: "",
      mileage: 0,
      vehicleType: "car",
      bodyType: "hatchback",
      fuelType: "petrol",
      transmission: "manual",
      engineSizeCC: undefined,
      sellerName: "",
      sellerPhone: "",
      sourceType: searchParams.get("dealerPartner") ? "dealer" : "auction",
      localOrImport: "local",
      auctionHouse: "",
      ownedBy: "",
      managedBy: user?.id ?? "",
      invoiceDate: today,
      v5Received: false,
      serviceHistory: "unknown",
      numKeys: 2,
      lockNut: false,
      motExpiry: "",
      buyingPrice: 0,
      buyersFee: 0,
      inspectionCharge: 0,
      collectionFee: 0,
      deliveryFee: 0,
      lateStorageFee: 0,
      otherCharges: 0,
      financeProvider: "none",
      receivedDate: today,
      warrantyCost: 0,
      minimumSalePrice: undefined,
      listingPrice: undefined,
    },
    mode: "onTouched",
  });

  const watchAll = form.watch();
  const errors = form.formState.errors;

  // Holds the AbortController for the in-flight lookup so a newer lookup can
  // cancel an older one. Cancelled lookups exit without touching state.
  const inflightLookupRef = useRef<AbortController | null>(null);
  // The last cleaned reg we kicked off a lookup for. onBlur + onClick on the
  // same reg are coalesced — we don't double-fire the same call.
  const lastLookupRegRef = useRef<string>("");
  // When the loading state started; lets us render "Checking… (Ns)" so the
  // user can see the lookup is still progressing on a slow DVLA call.
  const [loadingStartedAt, setLoadingStartedAt] = useState<number | null>(null);
  // Tick the elapsed-time display once per 500ms while loading.
  const [, setLoadingTick] = useState(0);
  useEffect(() => {
    if (loadingStartedAt === null) return;
    const id = setInterval(() => setLoadingTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [loadingStartedAt]);

  async function handleDvlaLookup() {
    const reg = form.getValues("registration");
    // Skip lookups while the user is still typing — UK plates are 4-8 chars
    // (with optional space). Anything shorter is mid-typing; anything longer
    // is junk. The DVLA route rejects anything that doesn't match
    // /^[A-Z0-9]{1,8}$/ after space-stripping; we mirror that guard here so
    // the lookup never fires with obviously bad input.
    const cleaned = (reg ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length < 4 || cleaned.length > 8) {
      setDvlaState("idle");
      setDuplicate(null);
      lastLookupRegRef.current = "";
      return;
    }

    // Coalesce double-fire: clicking the DVLA button also blurs the Input,
    // so onBlur AND onClick both call this for the same reg. Skip the
    // second invocation if we just kicked off the same lookup.
    if (lastLookupRegRef.current === cleaned) return;
    lastLookupRegRef.current = cleaned;

    // Abort any previous in-flight lookup so its fetches free up. We treat
    // an aborted signal as "a newer lookup is in charge now" — its results
    // are ignored on return.
    inflightLookupRef.current?.abort();
    const controller = new AbortController();
    inflightLookupRef.current = controller;
    const { signal } = controller;

    setDvlaState("loading");
    setDuplicate(null);
    setLoadingStartedAt(Date.now());

    // Hard ceiling on the WHOLE lookup. If we don't land on a terminal
    // state in 15s the controller aborts itself. Defence-in-depth alongside
    // dvla-service's own 12s AbortController + the 5s Supabase race below.
    const ceiling = setTimeout(() => controller.abort(), 15_000);

    const formatted = formatRegPlate(reg);
    let landedTerminal = false;

    try {
      // dbPromise races against a 5s deadline. If Supabase doesn't respond
      // in 5s, treat as "no duplicate" and continue with the DVLA result.
      // The user occasionally won't see a duplicate banner under pathological
      // DB slowness, but the form stays usable. The existing submit-time
      // duplicate check (onSubmit, below) is the safety net for that case.
      const dbPromise = Promise.race([
        vehicleService.getByRegistration(formatted).catch((e) => {
          console.warn("[arrival-form] getByRegistration failed", e);
          return null;
        }),
        new Promise<null>((r) => setTimeout(() => r(null), 5_000)),
      ]);
      const dvlaPromise = dvlaService.lookup(formatted).catch((e) => {
        console.warn("[arrival-form] dvla lookup failed", e);
        return null;
      });

      // 1. Settle the DB check first (or its 5s deadline).
      const existing = await dbPromise;
      if (signal.aborted) return;

      if (existing) {
        setDuplicate({
          id: existing.id,
          stockId: existing.stockId,
          label: `${existing.make} ${existing.model ?? ""}`.trim(),
        });
        setDvlaState("duplicate");
        landedTerminal = true;
        // Let DVLA finish so the LRU cache warms up for the next user.
        void dvlaPromise;
        return;
      }

      // 2. No duplicate — wait for DVLA.
      const dvla = await dvlaPromise;
      if (signal.aborted) return;

      if (!dvla) {
        setDvlaState("not_found");
        landedTerminal = true;
        return;
      }

      // Auto-fill from DVLA. Null/undefined checks (not truthy) so legitimate
      // zero values — e.g. engineSizeCC=0 for electric cars — still populate.
      setDvlaState("found");
      landedTerminal = true;
      if (dvla.make) form.setValue("make", dvla.make);
      if (dvla.model) form.setValue("model", dvla.model);
      if (dvla.year != null) form.setValue("year", dvla.year);
      if (dvla.colour) form.setValue("colour", dvla.colour);
      if (dvla.fuelType) form.setValue("fuelType", dvla.fuelType);
      if (dvla.engineSizeCC != null) form.setValue("engineSizeCC", dvla.engineSizeCC);
      if (dvla.motExpiry) form.setValue("motExpiry", dvla.motExpiry);
    } catch (e) {
      console.warn("[arrival-form] handleDvlaLookup unexpected", e);
      if (!signal.aborted) {
        setDvlaState("not_found");
        landedTerminal = true;
      }
    } finally {
      clearTimeout(ceiling);
      // Safety net: if we exited without setting a terminal state AND we
      // weren't aborted by a newer lookup, force not_found so the loading
      // spinner can never stick forever.
      if (!landedTerminal && !signal.aborted) {
        setDvlaState("not_found");
      }
      setLoadingStartedAt(null);
    }
  }

  function addTodo() {
    if (!newTodo.description.trim()) return;
    setTodos((t) => [...t, { ...newTodo }]);
    setNewTodo({ description: "", cost: 0 });
  }

  function removeTodo(idx: number) {
    setTodos((t) => t.filter((_, i) => i !== idx));
  }

  // Live cost rollups
  const buyingPrice = Number(watchAll.buyingPrice) || 0;
  const fees =
    (Number(watchAll.buyersFee) || 0) +
    (Number(watchAll.inspectionCharge) || 0) +
    (Number(watchAll.collectionFee) || 0) +
    (Number(watchAll.deliveryFee) || 0) +
    (Number(watchAll.lateStorageFee) || 0) +
    (Number(watchAll.otherCharges) || 0);
  const totalBuyingPrice = buyingPrice + fees;
  const warrantyCost = Number(watchAll.warrantyCost) || 0;
  const prepCosts = todos.reduce((sum, t) => sum + (Number(t.cost) || 0), 0);
  const baseCost = totalBuyingPrice + prepCosts + warrantyCost;

  async function onSubmit(values: FormInput) {
    if (!user || !company) return;
    setSubmitting(true);
    // (errors are rendered inline below each field via form.formState.errors)
    // v4.1 TC-P6-004: warn when a registration is already in the master sheet
    // (don't block — the user may want to bring back a returned/removed vehicle).
    const reg = formatRegPlate(values.registration);
    const existing = await vehicleService.getByRegistration(reg);
    if (existing) {
      const proceed = window.confirm(
        `${reg} is already on the Master Sheet (${existing.stockId}, ${existing.make} ${existing.model}). Add anyway?`,
      );
      if (!proceed) {
        setSubmitting(false);
        return;
      }
    }
    try {
      const v = await vehicleService.create(
        {
          companyId: company.id,
          registration: reg,
          tagNumber: null,
          make: values.make.toUpperCase(),
          model: values.model.toUpperCase(),
          variantName: values.variantName || null,
          variantCode: values.variantCode || null,
          year: Number(values.year),
          colour: values.colour ?? "",
          mileage: Number(values.mileage),
          vehicleType: values.vehicleType,
          bodyType: values.bodyType,
          fuelType: values.fuelType,
          transmission: values.transmission,
          engineSizeCC: values.engineSizeCC ? Number(values.engineSizeCC) : null,
          receivedDate: values.receivedDate,
          receivedBy: user.id,
          sellerName: values.sellerName,
          sellerPhone: values.sellerPhone ?? "",
          sourceType: values.sourceType === "trade_in" ? "trade_in" : values.sourceType,
          purchaseChannel: "supplier",
          supplierId: null,
          customFields: {},
          localOrImport: values.localOrImport,
          auctionHouse: values.auctionHouse || null,
          ownedBy: values.ownedBy || company.name,
          managedBy: values.managedBy || user.id,
          invoiceDate: values.invoiceDate || null,
          v5Received: values.v5Received,
          serviceHistory: values.serviceHistory,
          numKeys: Number(values.numKeys),
          lockNut: values.lockNut,
          motExpiry: values.motExpiry || null,
          buyingPrice: Number(values.buyingPrice),
          vatOnBuyingPrice: Math.round(Number(values.buyingPrice) * VAT_RATE * 100) / 100,
          buyersFee: values.buyersFee ? Number(values.buyersFee) : null,
          inspectionCharge: values.inspectionCharge ? Number(values.inspectionCharge) : null,
          collectionFee: values.collectionFee ? Number(values.collectionFee) : null,
          deliveryFee: values.deliveryFee ? Number(values.deliveryFee) : null,
          lateStorageFee: values.lateStorageFee ? Number(values.lateStorageFee) : null,
          otherCharges: values.otherCharges ? Number(values.otherCharges) : null,
          totalBuyingPrice,
          financeProvider: values.financeProvider,
          loadingFee: 0,
          dailyChargeRate: 0,
          unloadingFee: 0,
          stockingCharges: 0,
          valueAddition: prepCosts,
          warrantyCost: warrantyCost || null,
          landedCost: totalBuyingPrice,
          baseCost,
          minimumSalePrice: values.minimumSalePrice ? Number(values.minimumSalePrice) : null,
          listingPrice: values.listingPrice ? Number(values.listingPrice) : null,
          sellingPrice: null,
          dateSold: null,
          sellingAgent: null,
          grossEarning: null,
          status: "received",
          removedFromWebsiteAt: null,
          daysInStock: 0,
          imagesCount: 0,
          heroImageUrl: null,
        },
        user.id,
      );
      // Persist any "Things to Do" added at arrival
      for (const t of todos) {
        await todoService.add({
          vehicleId: v.id,
          description: t.description,
          vendorId: null,
          cost: t.cost || null,
          source: "manual",
          createdBy: user.id,
        });
      }
      // SPEC Point 7 — link the vehicle to its dealer partner (guarded;
      // no-ops if supplier_id / dealer_partners aren't migrated).
      if (values.sourceType === "dealer" && selectedPartnerId) {
        await dealerPartnerService.assignSupplier(v.id, selectedPartnerId);
      }
      toast.success(`Vehicle ${v.stockId} added`);
      router.push(`/vehicles/${v.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const watchedSource = form.watch("sourceType");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Add Vehicle</h1>
          <p className="text-sm text-muted-foreground">
            Single-page arrival form. Typing the registration auto-checks your
            stock book and pre-fills make / year / colour / fuel from DVLA.
          </p>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="font-semibold">Please fix these errors:</div>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {Object.entries(errors).map(([field, err]) => (
                <li key={field}>
                  <span className="font-mono">{field}</span>:{" "}
                  {(err as { message?: string })?.message ?? "invalid"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 1 — Vehicle Identity */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">1 · Vehicle Identity</h2>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Registration *</Label>
              <div className="flex gap-2">
                <Input
                  {...form.register("registration")}
                  onBlur={() => void handleDvlaLookup()}
                  placeholder="GK66 6NX"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDvlaLookup()}
                  disabled={dvlaState === "loading"}
                >
                  {dvlaState === "loading" && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  DVLA
                </Button>
              </div>
              {dvlaState === "loading" && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking DVLA and your stock book
                  {loadingStartedAt !== null
                    ? ` (${Math.max(0, Math.round((Date.now() - loadingStartedAt) / 1000))}s)`
                    : ""}
                  …
                </p>
              )}
              {dvlaState === "found" && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> DVLA matched — fields
                  auto-filled. Please add the model manually (DVLA doesn&apos;t
                  return it).
                </p>
              )}
              {dvlaState === "not_found" && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> The number is incorrect
                  — please try again, or fill the form in manually.
                </p>
              )}
              {dvlaState === "duplicate" && duplicate && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-sky-700 dark:text-sky-400">
                  <Info className="h-3 w-3" />
                  <span>
                    This car is already in your stock book as{" "}
                    <Link
                      href={`/vehicles/${duplicate.id}`}
                      className="font-semibold underline underline-offset-2"
                    >
                      {duplicate.stockId}
                    </Link>
                    {duplicate.label ? ` (${duplicate.label})` : ""}.
                  </span>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Mileage *</Label>
              <Input type="number" {...form.register("mileage")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Make *</Label>
              <Input {...form.register("make")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Model *</Label>
              <Input {...form.register("model")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Variant Name</Label>
              <Input {...form.register("variantName")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Variant Code</Label>
              <Input {...form.register("variantCode")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Year</Label>
              <Input type="number" {...form.register("year")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Colour</Label>
              <Input {...form.register("colour")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Vehicle Type</Label>
              <Controller
                control={form.control}
                name="vehicleType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Body Type</Label>
              <Controller
                control={form.control}
                name="bodyType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BODY_TYPES.map((b) => (
                        <SelectItem key={b} value={b} className="capitalize">
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Fuel Type</Label>
              <Controller
                control={form.control}
                name="fuelType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map((f) => (
                        <SelectItem key={f} value={f} className="capitalize">
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Transmission</Label>
              <Controller
                control={form.control}
                name="transmission"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSMISSION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Engine Size CC</Label>
              <Input type="number" {...form.register("engineSizeCC")} />
            </div>
          </div>
        </Card>

        {/* Section 2 — Source / Seller */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">2 · Source / Seller</h2>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Seller Name *</Label>
              <Input {...form.register("sellerName")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Seller Phone</Label>
              <Input {...form.register("sellerPhone")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Source Type</Label>
              <Controller
                control={form.control}
                name="sourceType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {watchedSource === "dealer" && (
              <div className="flex flex-col gap-2">
                <Label>Dealer Partner</Label>
                <Select
                  value={selectedPartnerId}
                  onValueChange={setSelectedPartnerId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select dealer partner…" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No dealer partners
                      </SelectItem>
                    ) : (
                      partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.companyName ?? p.name}
                          {p.companyName ? ` (${p.name})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Local or Import</Label>
              <Controller
                control={form.control}
                name="localOrImport"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="import">Import</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {watchedSource === "auction" && (
              <div className="flex flex-col gap-2">
                <Label>Auction House</Label>
                <Controller
                  control={form.control}
                  name="auctionHouse"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick an auction house" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUCTION_HOUSES.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Owned By</Label>
              <Input {...form.register("ownedBy")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Invoice Date</Label>
              <Input type="date" {...form.register("invoiceDate")} />
            </div>
          </div>
        </Card>

        {/* Section 3 — Documentation */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">3 · Documentation</h2>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>V5 Received</Label>
              <div className="flex h-9 items-center rounded-md border bg-background px-3">
                <Controller
                  control={form.control}
                  name="v5Received"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Service History</Label>
              <Controller
                control={form.control}
                name="serviceHistory"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_HISTORY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Number of Keys</Label>
              <Input
                type="number"
                min={1}
                max={4}
                {...form.register("numKeys")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Lock Nut</Label>
              <div className="flex h-9 items-center rounded-md border bg-background px-3">
                <Controller
                  control={form.control}
                  name="lockNut"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>MOT Expiry</Label>
              <Input type="date" {...form.register("motExpiry")} />
            </div>
          </div>
        </Card>

        {/* Section 4 — Purchase Cost Breakdown */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">4 · Purchase Cost Breakdown</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Cost Item</th>
                <th className="py-1.5 pr-2 text-right font-medium">Amount £</th>
                <th className="py-1.5 pr-2 text-right font-medium">VAT 20%</th>
              </tr>
            </thead>
            <tbody>
              <CostRow label="Buying Price *" name="buyingPrice" form={form} showVat />
              <CostRow label="Buyer's Fee" name="buyersFee" form={form} showVat />
              <CostRow label="Inspection Charge" name="inspectionCharge" form={form} />
              <CostRow label="Collection Fee" name="collectionFee" form={form} />
              <CostRow label="Delivery / Transport" name="deliveryFee" form={form} showVat />
              <CostRow label="Late Storage" name="lateStorageFee" form={form} />
              <CostRow label="Other Charges" name="otherCharges" form={form} />
              <tr className="border-t bg-muted/30">
                <td className="py-2 pr-2 font-semibold">Total Buying Price</td>
                <td className="py-2 pr-2 text-right font-semibold tabular-nums">
                  {formatCurrency(totalBuyingPrice)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
          <div className="flex flex-col gap-2">
            <Label>Finance Provider</Label>
            <Controller
              control={form.control}
              name="financeProvider"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCE_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </Card>

        {/* Section 5 — Receiving */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">5 · Receiving</h2>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Received Date *</Label>
              <Input type="date" {...form.register("receivedDate")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Received By</Label>
              <Input value={user?.name ?? "—"} readOnly disabled />
            </div>
          </div>
        </Card>

        {/* Section 6 — Things to Do (optional) */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">6 · Things to Do (optional)</h2>
          {todos.length > 0 && (
            <div className="flex flex-col gap-1">
              {todos.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded border p-2 text-xs"
                >
                  <span className="flex-1">{t.description}</span>
                  <span className="tabular-nums">{formatCurrency(t.cost)}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => removeTodo(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label>Description</Label>
              <Input
                value={newTodo.description}
                onChange={(e) => setNewTodo((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="flex w-24 flex-col gap-2">
              <Label>Cost £</Label>
              <Input
                type="number"
                step="0.01"
                value={newTodo.cost}
                onChange={(e) => setNewTodo((p) => ({ ...p, cost: Number(e.target.value) || 0 }))}
              />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addTodo}>
              <Plus className="mr-1 h-3 w-3" />
              Add Item
            </Button>
          </div>
        </Card>

        {/* Section 7 — Pricing (optional) */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">7 · Pricing (optional)</h2>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>Warranty Cost £</Label>
              <Input type="number" step="0.01" {...form.register("warrantyCost")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Minimum Sale Price £</Label>
              <Input type="number" step="0.01" {...form.register("minimumSalePrice")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Listing Price £</Label>
              <Input type="number" step="0.01" {...form.register("listingPrice")} />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={submitting}>
            Save as Draft
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Vehicle"
            )}
          </Button>
        </div>
      </form>

      {/* Sticky Cost Summary Panel */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <CostSummaryReceipt
          buyingPrice={buyingPrice}
          feesAndCharges={fees}
          stockingCharges={0}
          prepCosts={prepCosts}
          warranty={warrantyCost}
          listingPrice={Number(watchAll.listingPrice) || null}
        />
      </div>
    </div>
  );
}

function CostRow({
  label,
  name,
  form,
  showVat,
}: {
  label: string;
  name: keyof FormInput;
  form: ReturnType<typeof useForm<FormInput>>;
  showVat?: boolean;
}) {
  const value = Number(form.watch(name)) || 0;
  const vat = showVat ? Math.round(value * VAT_RATE * 100) / 100 : null;
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-1.5 pr-2">
        <Label className="text-xs font-normal">{label}</Label>
      </td>
      <td className="py-1.5 pr-2 text-right">
        <Input
          type="number"
          step="0.01"
          {...form.register(name)}
          className="h-8 text-right tabular-nums"
        />
      </td>
      <td className="py-1.5 pr-2 text-right text-xs text-muted-foreground tabular-nums">
        {vat !== null ? formatCurrency(vat) : "—"}
      </td>
    </tr>
  );
}
