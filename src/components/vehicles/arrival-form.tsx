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
import {
  ComplianceCard,
  type ComplianceCardValue,
} from "./compliance-card";
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
  if (ratio <= 1.05) return "fair";
  return "high";
}

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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add Vehicle</h1>
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

        {/* ── Auto-filled group: identity + compliance + valuation ── */}
        <div className="flex items-center gap-3 pt-1">
          <h2 className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Auto-filled from DVLA + AutoTrader
          </h2>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>

        {/* Section 1 — Vehicle Identity */}
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">1 · Vehicle Identity</h2>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Registration *</Label>
              <Input
                {...form.register("registration")}
                onBlur={() => void handleDvlaLookup()}
                placeholder="GK66 6NX"
              />
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
                  <CheckCircle2 className="h-3 w-3" /> Matched — make / model /
                  derivative, tax, MOT &amp; valuation auto-filled from DVLA +
                  AutoTrader.
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
            <div className="flex flex-col gap-2">
              <Label>MOT Expiry</Label>
              <Input type="date" {...form.register("motExpiry")} />
            </div>
          </div>
        </Card>

        {/* Compliance & Verification (DVLA + DVSA) — auto-filled from lookup */}
        <ComplianceCard
          value={compliance}
          onChange={(next) =>
            setCompliance((curr) => ({ ...curr, ...next }))
          }
          onRefetch={() => {
            // Allow the user to force a re-fetch even if the registration
            // hasn't changed since the last lookup.
            lastLookupRegRef.current = "";
            void handleDvlaLookup();
          }}
          refetching={dvlaState === "loading"}
          verifiedAt={verifiedAt}
          sources={complianceSources}
          motSource={motSource}
        />

        {/* AutoTrader valuation strip — auto-filled when a retail valuation came
            back. "Use as listing price" sets the section-7 listing price. */}
        {atData.retailValuation != null && (
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                AutoTrader valuation
              </h2>
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

        {/* ── Manual-entry group: source, docs, costs, receiving, pricing ── */}
        <div className="flex items-center gap-3 pt-3">
          <h2 className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your details — entered manually
          </h2>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>

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
