"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { RegPlate } from "@/components/shared/reg-plate";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
import {
  ComplianceCard,
  type ComplianceCardValue,
} from "./compliance-card";
import { toast } from "@/lib/toast";
import { cn, formatCurrency, formatRegPlate } from "@/lib/utils";

// v4.1 spec §11.3 — Add Vehicle arrival form. Reorganised into a guided
// 5-step wizard (Variation E) with a left step rail + a live cost-summary
// receipt. The form stays a single <form> with one onSubmit; sections are
// grouped into steps and RHF keeps field values across step changes.

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

const STEPS: { id: string; title: string; icon: LucideIcon; hint: string }[] = [
  { id: "identity", title: "Vehicle Identity", icon: Car, hint: "Reg lookup + specs" },
  { id: "source", title: "Source & Docs", icon: FileText, hint: "Seller, paperwork" },
  { id: "costs", title: "Purchase Costs", icon: Receipt, hint: "Price, fees, VAT" },
  { id: "finish", title: "Receiving & Pricing", icon: Tag, hint: "Dates, to-dos, price" },
  { id: "review", title: "Review & Submit", icon: ShieldCheck, hint: "Confirm & save" },
];

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
  purchaseSource: z.enum(["auction", "private", "trade_in", "dealer", "other"]),
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

/**
 * Derive a Great/Good/Fair/High price indicator by comparing the intended
 * listing price to AutoTrader's retail valuation. Mirrors AutoTrader's own
 * banding loosely (their exact thresholds are advert-side and not exposed
 * on the vehicle lookup). Returns null when either input is missing.
 */
function deriveAtPriceIndicator(
  listingPrice: number | null,
  retailValuation: number | null,
): string | null {
  if (!listingPrice || !retailValuation || retailValuation <= 0) return null;
  const ratio = listingPrice / retailValuation;
  if (ratio <= 0.96) return "great";
  if (ratio <= 1.0) return "good";
  if (ratio <= 1.05) return "above_average";
  return "high";
}

export function ArrivalForm() {
  const { user, company } = useAuth();
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [submitting, setSubmitting] = useState(false);
  // Variation E — guided wizard. Sections are grouped into 5 steps; fields
  // stay registered across step changes (RHF keeps values, shouldUnregister
  // is false), so the single onSubmit still validates the whole form.
  const [step, setStep] = useState(0);
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

  // Module-F compliance card state — driven by the DVLA + DVSA lookup.
  // Lives outside react-hook-form because these fields are read-only by
  // default; user overrides flow through `setCompliance`.
  const [compliance, setCompliance] = useState<ComplianceCardValue>({
    registrationDate: null,
    co2Emissions: null,
    euroStatus: null,
    taxStatus: null,
    taxDueDate: null,
    motStatus: null,
    motExpiryDate: null,
    wheelplan: null,
    automatedVehicle: null,
    dateOfLastV5CIssued: null,
  });
  const [complianceSources, setComplianceSources] = useState<
    | {
        dvla: "ok" | "error";
        dvsa: "ok" | "error" | "missing_credentials";
        autotrader: "ok" | "error" | "missing_credentials";
      }
    | undefined
  >(undefined);
  const [motSource, setMotSource] = useState<
    "dvsa" | "autotrader" | "dvla" | null
  >(null);
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null);

  // AutoTrader taxonomy + valuation captured from the lookup. Persisted on
  // create; the retail valuation also powers the "Use as listing price" hint.
  const [atData, setAtData] = useState<{
    derivative: string | null;
    generation: string | null;
    trim: string | null;
    atDerivativeId: string | null;
    retailValuation: number | null;
    tradeValuation: number | null;
    partExchangeValuation: number | null;
    privateValuation: number | null;
  }>({
    derivative: null,
    generation: null,
    trim: null,
    atDerivativeId: null,
    retailValuation: null,
    tradeValuation: null,
    partExchangeValuation: null,
    privateValuation: null,
  });
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
      // Pre-fill reg + mileage when arriving from the "Add Vehicle" modal
      // (`?reg=…&mileage=…`). With both present up front, the auto-lookup
      // below runs once with mileage → AutoTrader valuations come back.
      registration: (searchParams.get("reg") ?? "").toUpperCase(),
      make: "",
      model: "",
      variantName: "",
      variantCode: "",
      year: new Date().getFullYear() - 3,
      colour: "",
      mileage: Number(searchParams.get("mileage")) || 0,
      vehicleType: "car",
      bodyType: "hatchback",
      fuelType: "petrol",
      transmission: "manual",
      engineSizeCC: undefined,
      sellerName: "",
      sellerPhone: "",
      purchaseSource: searchParams.get("dealerPartner") ? "dealer" : "auction",
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

  async function handleDvlaLookup(regOverride?: string) {
    // Prefer an explicit reg (passed by the param-change auto-lookup, which
    // can't rely on form.setValue having flushed yet) over the form value.
    const reg = regOverride ?? form.getValues("registration");
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
    //
    // The coalesce key includes mileage: the reg blur often fires first with
    // mileage still 0 (taxonomy + MOT come back, but AutoTrader can't value a
    // car without mileage). Once the user enters mileage and clicks DVLA, the
    // key changes, so the valuation-aware lookup is NOT coalesced away.
    const mileageKey = Number(form.getValues("mileage")) || 0;
    const coalesceKey = `${cleaned}:${mileageKey}`;
    if (lastLookupRegRef.current === coalesceKey) return;
    lastLookupRegRef.current = coalesceKey;

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

    const formatted = formatRegPlate(reg);
    let landedTerminal = false;

    // Hard ceiling on the WHOLE lookup. If we don't land on a terminal
    // state in 15s, force the form out of "loading" so the spinner can
    // never stick. Defence-in-depth alongside dvla-service's own 12s
    // AbortController + the 5s Supabase race below.
    //
    // NB: we set not_found DIRECTLY here rather than only aborting the
    // controller — the finally block's safety-net skips when signal.aborted
    // is true, so a bare abort() would leave the spinner spinning forever
    // (the production "just keeps searching" bug).
    const ceiling = setTimeout(() => {
      if (!landedTerminal) {
        console.warn("[arrival-form] lookup ceiling hit (15s) — forcing not_found");
        landedTerminal = true;
        setDvlaState("not_found");
        setLoadingStartedAt(null);
      }
      controller.abort();
    }, 15_000);

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
      // Pass the entered mileage so AutoTrader can return valuations (it
      // can't value a car without one). Mileage of 0 / blank → no valuation,
      // but taxonomy (model/derivative) still comes back.
      const mileageNow = Number(form.getValues("mileage")) || undefined;
      const dvlaPromise = dvlaService
        .lookup(formatted, { mileage: mileageNow })
        .catch((e) => {
          console.warn("[arrival-form] vehicle lookup failed", e);
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
        // NB: do NOT return here. Even for a car already in the stock book we
        // still want DVLA + AutoTrader to populate the form so the user can
        // review the pulled make/model/compliance data — previously the early
        // return left every field blank under the "already in stock" banner.
      }

      // 2. Wait for DVLA (runs whether or not it's a duplicate).
      const dvla = await dvlaPromise;
      if (signal.aborted) return;

      // Terminal state: a duplicate keeps its banner; otherwise found /
      // not_found reflects whether DVLA returned anything.
      if (existing) {
        setDvlaState("duplicate");
      } else if (!dvla) {
        setDvlaState("not_found");
        landedTerminal = true;
        return;
      } else {
        setDvlaState("found");
      }
      landedTerminal = true;

      // Duplicate with no DVLA hit: banner is shown, nothing to fill.
      if (!dvla) return;

      // Auto-fill from the combined DVLA + DVSA payload. Null / undefined
      // checks (not truthy) so legitimate zero values — e.g. engineSizeCC=0
      // for electric cars, or co2Emissions=0 for some EVs — still populate.
      if (dvla.make) form.setValue("make", dvla.make);
      // AutoTrader taxonomy → the Variant fields + Body/Transmission selects.
      // DVLA returns none of these; without them the form left Variant Name /
      // Variant Code blank and Body/Transmission on their defaults.
      if (dvla.derivative) form.setValue("variantName", dvla.derivative);
      if (dvla.atDerivativeId) form.setValue("variantCode", dvla.atDerivativeId);
      if (dvla.bodyType) form.setValue("bodyType", dvla.bodyType);
      if (dvla.transmission) form.setValue("transmission", dvla.transmission);
      if (dvla.vehicleType) form.setValue("vehicleType", dvla.vehicleType);
      // Don't overwrite a user-typed model with DVLA's null. DVLA VES
      // never returns model, but if a future version does we still respect
      // any value already in the field.
      const currentModel = form.getValues("model");
      if (dvla.model && !currentModel?.trim()) form.setValue("model", dvla.model);
      if (dvla.year != null) form.setValue("year", dvla.year);
      if (dvla.colour) form.setValue("colour", dvla.colour);
      if (dvla.fuelType) form.setValue("fuelType", dvla.fuelType);
      if (dvla.engineSizeCC != null) form.setValue("engineSizeCC", dvla.engineSizeCC);
      if (dvla.motExpiry) form.setValue("motExpiry", dvla.motExpiry);

      // Module-F — populate the Compliance & Verification card with the
      // 8 additional fields the route now returns. Each value is taken
      // verbatim (the merge rule lives server-side in /api/vehicle/lookup).
      setCompliance({
        registrationDate: dvla.registrationDate ?? null,
        co2Emissions: dvla.co2Emissions ?? null,
        euroStatus: dvla.euroStatus ?? null,
        taxStatus: dvla.taxStatus ?? null,
        taxDueDate: dvla.taxDueDate ?? null,
        motStatus: dvla.motStatus ?? null,
        motExpiryDate: dvla.motExpiry ?? null,
        wheelplan: dvla.wheelplan ?? null,
        automatedVehicle: dvla.automatedVehicle ?? null,
        dateOfLastV5CIssued: dvla.dateOfLastV5CIssued ?? null,
      });
      setComplianceSources(dvla.sources);
      setMotSource(dvla.motSource ?? null);
      setVerifiedAt(new Date());

      // AutoTrader taxonomy + valuation. Fill the model from AutoTrader when
      // the user hasn't typed one (DVLA returns model=null). Derivative /
      // generation / trim are captured for persistence + display.
      setAtData({
        derivative: dvla.derivative ?? null,
        generation: dvla.generation ?? null,
        trim: dvla.trim ?? null,
        atDerivativeId: dvla.atDerivativeId ?? null,
        retailValuation: dvla.retailValuation ?? null,
        tradeValuation: dvla.tradeValuation ?? null,
        partExchangeValuation: dvla.partExchangeValuation ?? null,
        privateValuation: dvla.privateValuation ?? null,
      });
      // dvla.model already carries AutoTrader's model after the route merge;
      // the guard above only writes it when the model field is empty.
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

  // Auto-run the lookup when arriving from the Add Vehicle modal with a
  // `?reg=` param — AND re-run it if the param CHANGES while the page is
  // already mounted (the modal navigates add-vehicle?reg=A → add-vehicle?reg=B
  // without remounting, so a one-shot mount effect would never re-fire and the
  // form would keep showing the old car). We track the last reg we looked up
  // and re-seed the reg/mileage fields before kicking off the new lookup.
  const lastAutoLookupRegRef = useRef<string>("");
  useEffect(() => {
    const regParam = (searchParams.get("reg") ?? "").trim().toUpperCase();
    if (!regParam) return;
    if (lastAutoLookupRegRef.current === regParam) return;
    lastAutoLookupRegRef.current = regParam;

    // Re-seed the form's reg + mileage from the new query params so the rest
    // of the form (and submit) sees the latest values.
    form.setValue("registration", regParam);
    const mileageParam = Number(searchParams.get("mileage"));
    if (Number.isFinite(mileageParam) && mileageParam > 0) {
      form.setValue("mileage", Math.round(mileageParam));
    }
    // Pass regParam explicitly — setValue above may not have flushed into
    // form state yet, and handleDvlaLookup() otherwise reads the stale reg.
    void handleDvlaLookup(regParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      const proceed = await confirm({
        title: "Registration already on the Master Sheet",
        description: `${reg} already exists (${existing.stockId}, ${existing.make} ${existing.model}). Add anyway?`,
        confirmText: "Add anyway",
      });
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
          purchaseSource: values.purchaseSource === "trade_in" ? "trade_in" : values.purchaseSource,
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
          motExpiry: values.motExpiry || compliance.motExpiryDate || null,
          vin: null,
          firstRegisteredDate: compliance.registrationDate,
          // Module-F compliance fields — populated by /api/vehicle/lookup
          // and persisted alongside the manually-entered data.
          co2Emissions: compliance.co2Emissions,
          euroStatus: compliance.euroStatus,
          taxStatus: compliance.taxStatus,
          taxDueDate: compliance.taxDueDate,
          motStatus: compliance.motStatus,
          wheelplan: compliance.wheelplan,
          automatedVehicle: compliance.automatedVehicle,
          dateOfLastV5CIssued: compliance.dateOfLastV5CIssued,
          // AutoTrader taxonomy + valuation (migration 0018)
          derivative: atData.derivative,
          generation: atData.generation,
          trim: atData.trim,
          atDerivativeId: atData.atDerivativeId,
          atRetailValuation: atData.retailValuation,
          atTradeValuation: atData.tradeValuation,
          atPartExchangeValuation: atData.partExchangeValuation,
          atPrivateValuation: atData.privateValuation,
          atPriceIndicator: deriveAtPriceIndicator(
            values.listingPrice ? Number(values.listingPrice) : null,
            atData.retailValuation,
          ),
          atValuationAt: atData.retailValuation ? new Date().toISOString() : null,
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
      if (values.purchaseSource === "dealer" && selectedPartnerId) {
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

  const watchedSource = form.watch("purchaseSource");
  const regClean = (watchAll.registration ?? "").replace(/[^A-Za-z0-9]/g, "");
  const isLast = step === STEPS.length - 1;
  const go = (n: number) => setStep(Math.min(STEPS.length - 1, Math.max(0, n)));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Vehicle</h1>
        <p className="text-sm text-muted-foreground">
          Guided arrival form. Typing the registration auto-checks your stock
          book and pre-fills make / year / colour / fuel from DVLA.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr_300px]">
        {/* Step rail */}
        <nav className="hidden lg:block">
          <div className="sticky top-4 flex flex-col gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const on = i === step;
              const done = i < step;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(i)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border-l-2 px-3 py-2.5 text-left transition-colors",
                    on ? "border-primary bg-muted/60" : "border-transparent hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      on
                        ? "bg-primary text-primary-foreground"
                        : done
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("flex items-center gap-1.5 text-sm", on ? "font-semibold" : "font-medium")}>
                      <Icon className="size-3.5" />
                      {s.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">{s.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Center: form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-w-0 flex-col gap-3">
          <div className="rounded-xl border bg-card p-5">
            {/* Mobile step indicator */}
            <div className="mb-4 flex items-center gap-2 text-sm font-medium lg:hidden">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                {step + 1}
              </span>
              {STEPS[step].title}
              <span className="text-muted-foreground">· {step + 1} of {STEPS.length}</span>
            </div>

            {/* Validation summary (surfaced on the review step) */}
            {isLast && Object.keys(errors).length > 0 && (
              <div className="mb-4 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
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

            {/* ───────────────────────────── STEP 1 — Identity ── */}
            {step === 0 && (
              <div className="flex flex-col gap-5">
                {/* Reg lookup hero */}
                <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4 sm:p-5">
                  <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                    <div className="min-w-0">
                      <Label>Registration *</Label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="relative w-[200px]">
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            {...form.register("registration")}
                            onBlur={() => void handleDvlaLookup()}
                            placeholder="GK66 6NX"
                            className="pl-9 font-mono uppercase tracking-wider"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => void handleDvlaLookup()}
                          disabled={dvlaState === "loading"}
                          className="shrink-0 gap-1.5"
                        >
                          {dvlaState === "loading" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Sparkles className="size-4" />
                          )}
                          Fetch DVLA
                        </Button>
                      </div>
                    </div>
                    {regClean.length >= 4 && (
                      <RegPlate
                        registration={watchAll.registration ?? ""}
                        size="lg"
                        className="ml-auto"
                      />
                    )}
                  </div>
                  <div className="mt-2 min-h-[1rem]">
                    {dvlaState === "loading" && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Checking DVLA and your stock book
                        {loadingStartedAt !== null
                          ? ` (${Math.max(0, Math.round((Date.now() - loadingStartedAt) / 1000))}s)`
                          : ""}
                        …
                      </p>
                    )}
                    {dvlaState === "found" && (
                      <p className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> Matched — make / model /
                        derivative, tax, MOT &amp; valuation auto-filled from DVLA +
                        AutoTrader.
                      </p>
                    )}
                    {dvlaState === "not_found" && (
                      <p className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> The number is incorrect
                        — please try again, or fill the form in manually.
                      </p>
                    )}
                    {dvlaState === "duplicate" && duplicate && (
                      <p className="flex flex-wrap items-center gap-1 text-xs text-sky-700 dark:text-sky-400">
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
                </div>

                {/* Identity fields */}
                <div>
                  <StepHeader icon={Car} title="Vehicle Identity" hint="Auto-filled from DVLA + AutoTrader" />
                  <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Mileage *</Label>
                      <Input type="number" {...form.register("mileage")} />
                    </div>
                    <FieldShell label="Make *" auto={dvlaState === "found"}>
                      <Input {...form.register("make")} />
                    </FieldShell>
                    <FieldShell label="Model *" auto={dvlaState === "found"}>
                      <Input {...form.register("model")} />
                    </FieldShell>
                    <div className="flex flex-col gap-2">
                      <Label>Variant Name</Label>
                      <Input {...form.register("variantName")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Variant Code</Label>
                      <Input {...form.register("variantCode")} />
                    </div>
                    <FieldShell label="Year" auto={dvlaState === "found"}>
                      <Input type="number" {...form.register("year")} />
                    </FieldShell>
                    <FieldShell label="Colour" auto={dvlaState === "found"}>
                      <Input {...form.register("colour")} />
                    </FieldShell>
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
                    <FieldShell label="Fuel Type" auto={dvlaState === "found"}>
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
                    </FieldShell>
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
                    <div className="flex flex-col gap-2">
                      <Label>MOT Expiry</Label>
                      <Input type="date" {...form.register("motExpiry")} />
                    </div>
                  </div>
                </div>

                {/* Compliance & Verification (DVLA + DVSA) */}
                <ComplianceCard
                  value={compliance}
                  onChange={(next) => setCompliance((curr) => ({ ...curr, ...next }))}
                  onRefetch={() => {
                    lastLookupRegRef.current = "";
                    void handleDvlaLookup();
                  }}
                  refetching={dvlaState === "loading"}
                  verifiedAt={verifiedAt}
                  sources={complianceSources}
                  motSource={motSource}
                />

                {/* AutoTrader valuation strip */}
                {atData.retailValuation != null && (
                  <Card className="flex flex-col gap-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold">AutoTrader valuation</h2>
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Based on {Number(form.getValues("mileage")).toLocaleString()} mi
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <ValuationCell label="Retail" value={atData.retailValuation} highlight />
                      <ValuationCell label="Trade" value={atData.tradeValuation} />
                      <ValuationCell label="Part-ex" value={atData.partExchangeValuation} />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            if (atData.retailValuation != null) {
                              form.setValue("listingPrice", atData.retailValuation);
                              toast.success(
                                `Listing price set to ${formatCurrency(atData.retailValuation)}`,
                              );
                            }
                          }}
                        >
                          Use as listing price
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ───────────────────────────── STEP 2 — Source & Docs ── */}
            {step === 1 && (
              <div className="flex flex-col gap-6">
                <div>
                  <StepHeader icon={FileText} title="Source / Seller" hint="Where the car came from" />
                  <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
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
                        name="purchaseSource"
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
                        <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
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
                </div>

                <div className="border-t pt-6">
                  <StepHeader icon={FileText} title="Documentation" hint="Paperwork & keys" />
                  <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
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
                      <Input type="number" min={1} max={4} {...form.register("numKeys")} />
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
                  </div>
                </div>
              </div>
            )}

            {/* ───────────────────────────── STEP 3 — Costs ── */}
            {step === 2 && (
              <div>
                <StepHeader icon={Receipt} title="Purchase Cost Breakdown" hint="VAT auto-calculated at 20%" />
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-2 font-medium">Cost Item</th>
                      <th className="py-1.5 pr-2 text-right font-medium">VAT 20%</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Amount £</th>
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
                      <td />
                      <td className="py-2 pr-2 text-right font-semibold tabular-nums">
                        {formatCurrency(totalBuyingPrice)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ───────────────────────────── STEP 4 — Receiving & Pricing ── */}
            {step === 3 && (
              <div className="flex flex-col gap-6">
                <div>
                  <StepHeader icon={Tag} title="Receiving" hint="When the car arrived" />
                  <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Received Date *</Label>
                      <Input type="date" {...form.register("receivedDate")} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Received By</Label>
                      <Input value={user?.name ?? "—"} readOnly disabled />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <StepHeader icon={Plus} title="Things to Do" hint="Optional prep tasks" />
                  {todos.length > 0 && (
                    <div className="mt-4 flex flex-col gap-1">
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
                  <div className="mt-4 flex items-end gap-2">
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
                </div>

                <div className="border-t pt-6">
                  <StepHeader icon={Tag} title="Pricing" hint="Optional — can set later" />
                  <div className="mt-4 grid gap-x-4 gap-y-4 sm:grid-cols-3">
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
                </div>
              </div>
            )}

            {/* ───────────────────────────── STEP 5 — Review ── */}
            {step === 4 && (
              <div className="flex flex-col gap-4">
                <StepHeader icon={ShieldCheck} title="Review & Submit" hint="Check the details, then submit" />
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  Review the summary below. The cost receipt on the right reflects
                  what will be saved.
                </div>

                <ReviewCard
                  title="Vehicle"
                  onEdit={() => go(0)}
                  rows={[
                    ["Registration", formatRegPlate(watchAll.registration ?? "") || "—"],
                    ["Make / Model", `${watchAll.make || "—"} ${watchAll.model || ""}`.trim()],
                    ["Year", String(watchAll.year ?? "—")],
                    ["Mileage", `${Number(watchAll.mileage || 0).toLocaleString()} mi`],
                    ["Fuel", String(watchAll.fuelType ?? "—")],
                    ["Colour", String(watchAll.colour || "—")],
                  ]}
                />
                <ReviewCard
                  title="Source & Documentation"
                  onEdit={() => go(1)}
                  rows={[
                    ["Seller", String(watchAll.sellerName || "—")],
                    ["Source", String(watchAll.purchaseSource ?? "—")],
                    ["Local / Import", String(watchAll.localOrImport ?? "—")],
                    ["V5 received", watchAll.v5Received ? "Yes" : "No"],
                    ["Service history", String(watchAll.serviceHistory ?? "—")],
                    ["Keys", String(watchAll.numKeys ?? "—")],
                  ]}
                />
                <ReviewCard
                  title="Costs & Pricing"
                  onEdit={() => go(2)}
                  rows={[
                    ["Buying price", formatCurrency(buyingPrice)],
                    ["Fees & charges", formatCurrency(fees)],
                    ["Total buying", formatCurrency(totalBuyingPrice)],
                    ["Prep (to-dos)", formatCurrency(prepCosts)],
                    ["Base cost", formatCurrency(baseCost)],
                    ["Listing price", formatCurrency(Number(watchAll.listingPrice) || null)],
                  ]}
                />
              </div>
            )}
          </div>

          {/* Sticky action bar */}
          <div className="sticky bottom-0 flex items-center justify-between gap-2 rounded-xl border bg-card/85 px-4 py-3 backdrop-blur">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0}
              onClick={() => go(step - 1)}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" disabled={submitting}>
                Save as Draft
              </Button>
              {!isLast ? (
                <Button type="button" onClick={() => go(step + 1)} className="gap-1.5">
                  Continue <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={submitting} className="gap-1.5">
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      <Check className="size-4" /> Submit Vehicle
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Live cost-summary receipt */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 flex flex-col gap-3">
            <CostSummaryReceipt
              buyingPrice={buyingPrice}
              feesAndCharges={fees}
              stockingCharges={0}
              prepCosts={prepCosts}
              warranty={warrantyCost}
              listingPrice={Number(watchAll.listingPrice) || null}
            />
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              Updates live as you enter costs. VAT is calculated at 20% per line.
            </div>
          </div>
        </aside>
      </div>

      {confirmDialog}
    </div>
  );
}

function StepHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/** Field wrapper that shows a small "DVLA" pill above auto-filled fields. */
function FieldShell({
  label,
  auto,
  children,
}: {
  label: string;
  auto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {auto && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            <Sparkles className="size-2.5" /> DVLA
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ReviewCard({
  title,
  onEdit,
  rows,
}: {
  title: string;
  onEdit: () => void;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-primary hover:underline"
        >
          Edit
        </button>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{k}</span>
            <span className="truncate text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValuationCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-3 py-2",
        highlight && "border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-500/5",
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">
        {value != null ? formatCurrency(value) : "—"}
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
      <td className="py-1.5 pr-2 text-right text-xs text-muted-foreground tabular-nums">
        {vat !== null ? formatCurrency(vat) : "—"}
      </td>
      <td className="py-1.5 pr-2 text-right">
        <Input
          type="number"
          step="0.01"
          {...form.register(name)}
          className="h-8 text-right tabular-nums"
        />
      </td>
    </tr>
  );
}
