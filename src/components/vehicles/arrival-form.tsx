"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { dvlaService } from "@/lib/services/dvla-service";
import {
  AUCTION_HOUSES,
  BODY_TYPES,
  FINANCE_PROVIDERS,
  FUEL_TYPES,
} from "@/lib/constants";
import type {
  BodyType,
  FinanceProvider,
  FuelType,
  ServiceHistory,
  SourceType,
  Transmission,
  VehicleType,
} from "@/lib/types";
import { CostSummaryPanel } from "./cost-summary-panel";
import { toast } from "sonner";
import { formatRegPlate } from "@/lib/utils";

const schema = z.object({
  registration: z.string().min(2, "Reg required"),
  make: z.string().min(1, "Make required"),
  model: z.string().min(1, "Model required"),
  variantCode: z.string().optional(),
  year: z.coerce.number().int().min(1980).max(2030),
  colour: z.string().min(1),
  mileage: z.coerce.number().int().min(0),
  vehicleType: z.enum(["car", "van"]),
  bodyType: z.enum(["hatchback", "saloon", "suv", "mpv", "estate", "convertible", "coupe"]),
  fuelType: z.enum(["petrol", "diesel", "hybrid", "electric"]),
  transmission: z.enum(["automatic", "manual"]),
  engineSizeCC: z.coerce.number().int().optional(),
  // source
  sellerName: z.string().min(1),
  sellerPhone: z.string().min(1),
  sourceType: z.enum(["auction", "private", "trade_in", "dealer", "other"]),
  auctionHouse: z.string().optional(),
  localOrImport: z.enum(["local", "import"]),
  // documentation
  v5Received: z.boolean(),
  serviceHistory: z.enum(["full", "partial", "none", "unknown"]),
  numKeys: z.coerce.number().int().min(0).default(2),
  lockNut: z.boolean(),
  motExpiry: z.string().optional(),
  // costs
  buyingPrice: z.coerce.number().min(0),
  buyersFee: z.coerce.number().optional(),
  inspectionCharge: z.coerce.number().optional(),
  collectionFee: z.coerce.number().optional(),
  deliveryFee: z.coerce.number().optional(),
  // stocking
  financeProvider: z.enum(["next_gear", "close_brothers", "bca", "infinit", "none"]),
  // pricing
  listingPrice: z.coerce.number().optional(),
  warrantyCost: z.coerce.number().optional(),
  minimumSalePrice: z.coerce.number().optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const NAV_SECTIONS = [
  { id: "identity", label: "Vehicle Identity" },
  { id: "source", label: "Source / Seller" },
  { id: "docs", label: "Documentation" },
  { id: "costs", label: "Purchase Costs" },
  { id: "stocking", label: "Stocking Plan" },
  { id: "pricing", label: "Pricing" },
];

export function ArrivalForm() {
  const { user, company } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [dvlaState, setDvlaState] = useState<
    "idle" | "loading" | "found" | "not_found"
  >("idle");

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      registration: "",
      make: "",
      model: "",
      variantCode: "",
      year: 2020,
      colour: "",
      mileage: 0,
      vehicleType: "car",
      bodyType: "hatchback" as BodyType,
      fuelType: "petrol" as FuelType,
      transmission: "manual" as Transmission,
      engineSizeCC: undefined,
      sellerName: "",
      sellerPhone: "",
      sourceType: "auction" as SourceType,
      auctionHouse: "",
      localOrImport: "local",
      v5Received: false,
      serviceHistory: "unknown" as ServiceHistory,
      numKeys: 2,
      lockNut: false,
      motExpiry: "",
      buyingPrice: 0,
      buyersFee: 0,
      inspectionCharge: 0,
      collectionFee: 0,
      deliveryFee: 0,
      financeProvider: "next_gear" as FinanceProvider,
      listingPrice: undefined,
      warrantyCost: undefined,
      minimumSalePrice: undefined,
    },
  });

  const watchAll = form.watch();

  async function handleDvlaLookup() {
    const reg = form.getValues("registration");
    if (!reg) return;
    setDvlaState("loading");
    const data = await dvlaService.lookup(formatRegPlate(reg));
    if (data) {
      setDvlaState("found");
      if (data.make) form.setValue("make", data.make);
      if (data.model) form.setValue("model", data.model);
      if (data.year) form.setValue("year", data.year);
      if (data.colour) form.setValue("colour", data.colour);
      if (data.fuelType) form.setValue("fuelType", data.fuelType);
      if (data.engineSizeCC)
        form.setValue("engineSizeCC", data.engineSizeCC);
    } else {
      setDvlaState("not_found");
    }
  }

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    setSubmitting(true);
    try {
      const buyingPrice = values.buyingPrice;
      const buyersFee = values.buyersFee ?? 0;
      const inspectionCharge = values.inspectionCharge ?? 0;
      const collectionFee = values.collectionFee ?? 0;
      const deliveryFee = values.deliveryFee ?? 0;
      const totalBuyingPrice =
        buyingPrice + buyersFee + inspectionCharge + collectionFee + deliveryFee;
      const finance = FINANCE_PROVIDERS.find(
        (p) => p.value === values.financeProvider,
      )!;
      const stockingCharges = finance.loadingFee + finance.unloadingFee;
      const valueAddition = 0;
      const warrantyCost = values.warrantyCost ?? null;
      const landedCost = totalBuyingPrice + valueAddition;
      const baseCost = landedCost + (warrantyCost ?? 0);
      const today = new Date().toISOString().slice(0, 10);

      const v = await vehicleService.create(
        {
          companyId: company.id,
          registration: formatRegPlate(values.registration),
          tagNumber: null,
          make: values.make.toUpperCase(),
          model: values.model.toUpperCase(),
          variantName: values.variantCode?.split(" ")[0] ?? null,
          variantCode: values.variantCode || null,
          year: values.year,
          colour: values.colour,
          mileage: values.mileage,
          vehicleType: values.vehicleType as VehicleType,
          bodyType: values.bodyType,
          fuelType: values.fuelType,
          transmission: values.transmission,
          engineSizeCC: values.engineSizeCC ?? null,
          receivedDate: today,
          receivedBy: user.id,
          sellerName: values.sellerName,
          sellerPhone: values.sellerPhone,
          sourceType: values.sourceType,
          purchaseChannel: values.sourceType === "auction" ? "supplier" : "vendor",
          localOrImport: values.localOrImport,
          auctionHouse: values.auctionHouse || null,
          ownedBy: company.name,
          managedBy: user.id,
          invoiceDate: today,
          v5Received: values.v5Received,
          serviceHistory: values.serviceHistory,
          numKeys: values.numKeys,
          lockNut: values.lockNut,
          motExpiry: values.motExpiry || null,
          buyingPrice,
          vatOnBuyingPrice: 0,
          buyersFee: buyersFee || null,
          inspectionCharge: inspectionCharge || null,
          collectionFee: collectionFee || null,
          deliveryFee: deliveryFee || null,
          lateStorageFee: null,
          otherCharges: null,
          totalBuyingPrice,
          financeProvider: values.financeProvider,
          loadingFee: finance.loadingFee,
          dailyChargeRate: finance.dailyCharge,
          unloadingFee: finance.unloadingFee,
          stockingCharges,
          valueAddition,
          warrantyCost,
          landedCost,
          baseCost,
          minimumSalePrice: values.minimumSalePrice ?? null,
          listingPrice: values.listingPrice ?? null,
          sellingPrice: null,
          dateSold: null,
          sellingAgent: null,
          grossEarning: null,
          status: "received",
          daysInStock: 0,
          imagesCount: 0,
        },
        user.id,
      );
      toast.success(`Vehicle ${v.stockId} added`);
      router.push(`/vehicles/${v.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  // Update auctionHouse defaults when source changes
  useEffect(() => {
    if (watchAll.sourceType !== "auction" && watchAll.auctionHouse) {
      form.setValue("auctionHouse", "");
    }
  }, [watchAll.sourceType, watchAll.auctionHouse, form]);

  const buyingPrice = Number(watchAll.buyingPrice) || 0;
  const feesAndCharges =
    (Number(watchAll.buyersFee) || 0) +
    (Number(watchAll.inspectionCharge) || 0) +
    (Number(watchAll.collectionFee) || 0) +
    (Number(watchAll.deliveryFee) || 0);
  const finance = FINANCE_PROVIDERS.find(
    (p) => p.value === watchAll.financeProvider,
  );
  const stockingCharges = (finance?.loadingFee ?? 0) + (finance?.unloadingFee ?? 0);
  const warranty = Number(watchAll.warrantyCost) || 0;
  const listingPrice = watchAll.listingPrice ? Number(watchAll.listingPrice) : null;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
    >
      <div className="flex flex-col gap-6">
        {/* Section: Identity */}
        <Card id="identity" className="p-5">
          <SectionHeader title="Vehicle Identity" subtitle="Reg, make, model, basic specs" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Registration</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  {...form.register("registration")}
                  onBlur={handleDvlaLookup}
                  placeholder="GK66 6NX"
                  className="font-mono uppercase tracking-wider"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDvlaLookup}
                  disabled={dvlaState === "loading"}
                >
                  {dvlaState === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "DVLA"
                  )}
                </Button>
              </div>
              {dvlaState === "found" && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Auto-populated from DVLA
                </p>
              )}
              {dvlaState === "not_found" && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> DVLA lookup unavailable — fill
                  manually
                </p>
              )}
              {form.formState.errors.registration && (
                <p className="mt-1 text-xs text-rose-600">
                  {form.formState.errors.registration.message}
                </p>
              )}
            </div>
            <Field label="Make">
              <Input {...form.register("make")} placeholder="AUDI" />
            </Field>
            <Field label="Model">
              <Input {...form.register("model")} placeholder="A3" />
            </Field>
            <Field label="Variant code (full)" colspan={2}>
              <Input
                {...form.register("variantCode")}
                placeholder="1.4 TFSI CoD SE Sportback 5dr"
              />
            </Field>
            <Field label="Year">
              <Input type="number" {...form.register("year")} />
            </Field>
            <Field label="Colour">
              <Input {...form.register("colour")} />
            </Field>
            <Field label="Mileage">
              <Input type="number" {...form.register("mileage")} />
            </Field>
            <Field label="Engine cc">
              <Input type="number" {...form.register("engineSizeCC")} />
            </Field>
            <SelectField
              control={form.control}
              name="bodyType"
              label="Body type"
              options={BODY_TYPES.map((b) => ({ value: b, label: b }))}
            />
            <SelectField
              control={form.control}
              name="fuelType"
              label="Fuel"
              options={FUEL_TYPES.map((f) => ({ value: f, label: f }))}
            />
            <SelectField
              control={form.control}
              name="transmission"
              label="Transmission"
              options={[
                { value: "automatic", label: "automatic" },
                { value: "manual", label: "manual" },
              ]}
            />
            <SelectField
              control={form.control}
              name="vehicleType"
              label="Vehicle type"
              options={[
                { value: "car", label: "Car" },
                { value: "van", label: "Van" },
              ]}
            />
          </div>
        </Card>

        {/* Section: Source */}
        <Card id="source" className="p-5">
          <SectionHeader title="Source / Seller" subtitle="Where did this car come from?" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Seller name">
              <Input {...form.register("sellerName")} />
            </Field>
            <Field label="Seller phone">
              <Input {...form.register("sellerPhone")} />
            </Field>
            <SelectField
              control={form.control}
              name="sourceType"
              label="Source type"
              options={[
                { value: "auction", label: "Auction" },
                { value: "private", label: "Private" },
                { value: "trade_in", label: "Trade-in" },
                { value: "dealer", label: "Dealer" },
                { value: "other", label: "Other" },
              ]}
            />
            <SelectField
              control={form.control}
              name="localOrImport"
              label="Local / Import"
              options={[
                { value: "local", label: "Local" },
                { value: "import", label: "Import" },
              ]}
            />
            {watchAll.sourceType === "auction" && (
              <SelectField
                control={form.control}
                name="auctionHouse"
                label="Auction house"
                colspan={2}
                options={AUCTION_HOUSES.map((h) => ({ value: h, label: h }))}
              />
            )}
          </div>
        </Card>

        {/* Section: Documentation */}
        <Card id="docs" className="p-5">
          <SectionHeader title="Documentation" subtitle="V5, MOT, keys" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="V5 received">
              <Controller
                control={form.control}
                name="v5Received"
                render={({ field }) => (
                  <div className="flex h-10 items-center">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </Field>
            <SelectField
              control={form.control}
              name="serviceHistory"
              label="Service history"
              options={[
                { value: "full", label: "Full" },
                { value: "partial", label: "Partial" },
                { value: "none", label: "None" },
                { value: "unknown", label: "Unknown" },
              ]}
            />
            <Field label="Number of keys">
              <Input type="number" {...form.register("numKeys")} />
            </Field>
            <Field label="Lock nut">
              <Controller
                control={form.control}
                name="lockNut"
                render={({ field }) => (
                  <div className="flex h-10 items-center">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </Field>
            <Field label="MOT expiry" colspan={2}>
              <Input type="date" {...form.register("motExpiry")} />
            </Field>
          </div>
        </Card>

        {/* Section: Purchase costs */}
        <Card id="costs" className="p-5">
          <SectionHeader title="Purchase Cost Breakdown" subtitle="All numbers in £ inc VAT where applicable" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Buying price">
              <Input type="number" step="0.01" {...form.register("buyingPrice")} />
            </Field>
            <Field label="Buyer's fee">
              <Input type="number" step="0.01" {...form.register("buyersFee")} />
            </Field>
            <Field label="Inspection charge">
              <Input type="number" step="0.01" {...form.register("inspectionCharge")} />
            </Field>
            <Field label="Collection fee">
              <Input type="number" step="0.01" {...form.register("collectionFee")} />
            </Field>
            <Field label="Delivery fee" colspan={2}>
              <Input type="number" step="0.01" {...form.register("deliveryFee")} />
            </Field>
          </div>
        </Card>

        {/* Section: Stocking */}
        <Card id="stocking" className="p-5">
          <SectionHeader title="Stocking Plan" subtitle="Auto-fills from finance provider" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="financeProvider"
              label="Finance provider"
              colspan={2}
              options={FINANCE_PROVIDERS.map((p) => ({ value: p.value, label: p.label }))}
            />
            <Field label="Loading fee" muted>
              <Input
                disabled
                value={finance ? `£${finance.loadingFee.toFixed(2)}` : ""}
              />
            </Field>
            <Field label="Daily charge" muted>
              <Input
                disabled
                value={finance ? `£${finance.dailyCharge.toFixed(3)}` : ""}
              />
            </Field>
            <Field label="Unloading fee" muted colspan={2}>
              <Input
                disabled
                value={finance ? `£${finance.unloadingFee.toFixed(2)}` : ""}
              />
            </Field>
          </div>
        </Card>

        {/* Section: Pricing */}
        <Card id="pricing" className="p-5">
          <SectionHeader title="Pricing (Optional)" subtitle="Can be filled in later" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Warranty cost">
              <Input type="number" step="0.01" {...form.register("warrantyCost")} />
            </Field>
            <Field label="Minimum sale price">
              <Input type="number" step="0.01" {...form.register("minimumSalePrice")} />
            </Field>
            <Field label="Listing price" colspan={2}>
              <Input type="number" step="0.01" {...form.register("listingPrice")} />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <Label className="text-xs text-muted-foreground">Notes</Label>
          <Textarea
            placeholder="Optional internal notes about this vehicle…"
            className="mt-2 min-h-20"
          />
        </Card>

        <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t bg-background/80 px-1 py-3 backdrop-blur">
          <Button type="button" variant="outline" disabled>
            Save as Draft
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Submit Vehicle
          </Button>
        </div>
      </div>

      {/* Sticky right sidebar: nav + cost summary */}
      <aside className="sticky top-20 hidden h-fit flex-col gap-3 lg:flex">
        <Card className="p-3 text-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sections
          </h3>
          <nav className="flex flex-col">
            {NAV_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </Card>
        <CostSummaryPanel
          buyingPrice={buyingPrice}
          feesAndCharges={feesAndCharges}
          stockingCharges={stockingCharges}
          prepCosts={0}
          warranty={warranty}
          listingPrice={listingPrice}
        />
      </aside>
    </form>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle ? (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  colspan,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  colspan?: 2;
  muted?: boolean;
}) {
  return (
    <div className={colspan === 2 ? "sm:col-span-2" : undefined}>
      <Label className={muted ? "text-muted-foreground" : undefined}>
        {label}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

import type { Control, FieldValues, Path } from "react-hook-form";

interface SelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  options: { value: string; label: string }[];
  colspan?: 2;
}

function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  colspan,
}: SelectFieldProps<T>) {
  return (
    <div className={colspan === 2 ? "sm:col-span-2" : undefined}>
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={String(field.value ?? "")}
            onValueChange={field.onChange}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} className="capitalize">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}
