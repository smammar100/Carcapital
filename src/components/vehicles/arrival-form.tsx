"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
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
import { dvlaService } from "@/lib/services/dvla-service";
import { FUEL_TYPES } from "@/lib/constants";
import { CostSummaryReceipt } from "./cost-summary-receipt";
import { toast } from "sonner";
import { cn, formatRegPlate } from "@/lib/utils";

const schema = z.object({
  // Step 1 — Vehicle
  registration: z.string().min(2, "Registration required"),
  make: z.string().min(1, "Make required"),
  model: z.string().min(1, "Model required"),
  variant: z.string().optional(),
  mileage: z.coerce.number().int().min(0),
  registrationDate: z.string().optional(),
  costNew: z.coerce.number().min(0).optional(),
  fuelType: z.enum(["petrol", "diesel", "hybrid", "electric"]),
  gearbox: z.enum(["automatic", "manual"]),

  // Step 2 — Source & supplier
  saleOrReturn: z.boolean(),
  vehicleSource: z.enum(["auction", "private", "trade", "dealer", "other"]),
  supplier: z.string().min(1, "Supplier required"),
  vatCalculation: z.enum(["margin", "qualifying", "non_vat"]),

  // Step 3 — Purchase & listing
  purchasedDate: z.string().min(1, "Purchased date required"),
  purchasedPrice: z.coerce.number().min(0),
  location: z.string().optional(),
  saleType: z.enum(["retail_used", "retail_new", "trade", "auction"]),
  websiteDisplay: z.boolean(),
  keytagNumber: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
type FormField = keyof FormInput;

interface StepDef {
  id: number;
  label: string;
  description: string;
  fields: FormField[];
}

const STEPS: StepDef[] = [
  {
    id: 1,
    label: "Vehicle",
    description: "Identity & specs",
    fields: [
      "registration",
      "make",
      "model",
      "variant",
      "mileage",
      "registrationDate",
      "costNew",
      "fuelType",
      "gearbox",
    ],
  },
  {
    id: 2,
    label: "Source",
    description: "Supplier & VAT",
    fields: ["saleOrReturn", "vehicleSource", "supplier", "vatCalculation"],
  },
  {
    id: 3,
    label: "Purchase & Listing",
    description: "Date, price, display",
    fields: [
      "purchasedDate",
      "purchasedPrice",
      "location",
      "saleType",
      "websiteDisplay",
      "keytagNumber",
    ],
  },
];

const VAT_OPTIONS = [
  { value: "margin", label: "Margin Based" },
  { value: "qualifying", label: "Qualifying" },
  { value: "non_vat", label: "Non-VAT" },
];

const SOURCE_OPTIONS = [
  { value: "auction", label: "Auction" },
  { value: "private", label: "Private" },
  { value: "trade", label: "Trade" },
  { value: "dealer", label: "Dealer" },
  { value: "other", label: "Other" },
];

const SALE_TYPE_OPTIONS = [
  { value: "retail_used", label: "Retail – Used Cars" },
  { value: "retail_new", label: "Retail – New Cars" },
  { value: "trade", label: "Trade" },
  { value: "auction", label: "Auction" },
];

export function ArrivalForm() {
  const { user, company } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [dvlaState, setDvlaState] = useState<
    "idle" | "loading" | "found" | "not_found"
  >("idle");

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      registration: "",
      make: "",
      model: "",
      variant: "",
      mileage: 0,
      registrationDate: "",
      costNew: undefined,
      fuelType: "petrol",
      gearbox: "manual",
      saleOrReturn: false,
      vehicleSource: "trade",
      supplier: "",
      vatCalculation: "margin",
      purchasedDate: today,
      purchasedPrice: 0,
      location: "",
      saleType: "retail_used",
      websiteDisplay: true,
      keytagNumber: "",
    },
    mode: "onTouched",
  });

  const watchAll = form.watch();

  async function handleDvlaLookup() {
    const reg = form.getValues("registration");
    if (!reg) {
      toast.info("Enter a registration first");
      return;
    }
    setDvlaState("loading");
    const data = await dvlaService.lookup(formatRegPlate(reg));
    if (data) {
      setDvlaState("found");
      if (data.make) form.setValue("make", data.make);
      if (data.model) form.setValue("model", data.model);
      if (data.fuelType) form.setValue("fuelType", data.fuelType);
    } else {
      setDvlaState("not_found");
    }
  }

  async function handleContinue() {
    const valid = await form.trigger(STEPS[step - 1].fields);
    if (!valid) {
      toast.error("Fix the errors before continuing");
      return;
    }
    if (step < STEPS.length) {
      setStep(step + 1);
    } else {
      void form.handleSubmit(onSubmit)();
    }
  }

  function handleStepClick(target: number) {
    if (target <= step) setStep(target);
  }

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    setSubmitting(true);
    try {
      const reg = formatRegPlate(values.registration);
      const purchasedPrice = values.purchasedPrice;
      const year = values.registrationDate
        ? Number(values.registrationDate.slice(0, 4))
        : new Date().getFullYear() - 3;

      const v = await vehicleService.create(
        {
          companyId: company.id,
          registration: reg,
          tagNumber: values.keytagNumber || null,
          make: values.make.toUpperCase(),
          model: values.model.toUpperCase(),
          variantName: values.variant?.split(" ")[0] ?? null,
          variantCode: values.variant || null,
          year,
          colour: "",
          mileage: values.mileage,
          vehicleType: "car",
          bodyType: "hatchback",
          fuelType: values.fuelType,
          transmission: values.gearbox,
          engineSizeCC: null,
          receivedDate: values.purchasedDate,
          receivedBy: user.id,
          sellerName: values.supplier,
          sellerPhone: "",
          sourceType:
            values.vehicleSource === "trade"
              ? "dealer"
              : values.vehicleSource === "other"
                ? "other"
                : values.vehicleSource,
          purchaseChannel: "supplier",
          localOrImport: "local",
          auctionHouse: values.location || null,
          ownedBy: company.name,
          managedBy: user.id,
          invoiceDate: values.purchasedDate,
          v5Received: false,
          serviceHistory: "unknown",
          numKeys: 2,
          lockNut: false,
          motExpiry: null,
          buyingPrice: purchasedPrice,
          vatOnBuyingPrice: 0,
          buyersFee: null,
          inspectionCharge: null,
          collectionFee: null,
          deliveryFee: null,
          lateStorageFee: null,
          otherCharges: null,
          totalBuyingPrice: purchasedPrice,
          financeProvider: "none",
          loadingFee: 0,
          dailyChargeRate: 0,
          unloadingFee: 0,
          stockingCharges: 0,
          valueAddition: 0,
          warrantyCost: null,
          landedCost: purchasedPrice,
          baseCost: purchasedPrice,
          minimumSalePrice: null,
          listingPrice: null,
          sellingPrice: null,
          dateSold: null,
          sellingAgent: null,
          grossEarning: null,
          status: "received",
          daysInStock: 0,
          imagesCount: 0,
          heroImageUrl: null,
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

  const purchasedPrice = Number(watchAll.purchasedPrice) || 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleContinue();
      }}
      className="flex flex-col gap-4"
    >
      {/* Header — title on the left, DVLA lookup pinned to the page-right */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Add Vehicle</h1>
          <p className="text-sm text-muted-foreground">
            Capture arrival details. DVLA lookup pre-fills make / model / fuel
            from the registration.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDvlaLookup}
          disabled={dvlaState === "loading"}
        >
          {dvlaState === "loading" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : null}
          DVLA Lookup
        </Button>
      </div>

      {/* Stepper — constrained to form column width */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Stepper
          steps={STEPS}
          current={step}
          onSelect={handleStepClick}
          errors={form.formState.errors}
        />
        <div className="hidden lg:block" />
      </div>

      {/* Body — form + cost summary side by side */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {step === 1 && (
            <Card className="p-5">
              <SectionHeader
                title="Vehicle"
                subtitle="Identification & specifications"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Registration"
                  required
                  error={form.formState.errors.registration?.message}
                  colspan={2}
                >
                  <Input
                    {...form.register("registration")}
                    onBlur={() => {
                      void handleDvlaLookup();
                    }}
                    placeholder="GK66 6NX"
                    className="font-mono uppercase tracking-wider"
                  />
                  {dvlaState === "found" && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Auto-populated from
                      DVLA
                    </p>
                  )}
                  {dvlaState === "not_found" && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> DVLA lookup
                      unavailable — fill manually
                    </p>
                  )}
                </Field>
                <Field
                  label="Make"
                  required
                  error={form.formState.errors.make?.message}
                >
                  <Input {...form.register("make")} placeholder="AUDI" />
                </Field>
                <Field
                  label="Model"
                  required
                  error={form.formState.errors.model?.message}
                >
                  <Input {...form.register("model")} placeholder="A3" />
                </Field>
                <Field label="Variant" colspan={2}>
                  <Input
                    {...form.register("variant")}
                    placeholder="1.4 TFSI CoD SE Sportback 5dr"
                  />
                </Field>
                <Field label="Mileage">
                  <Input type="number" {...form.register("mileage")} />
                </Field>
                <Field label="Registration date">
                  <Input type="date" {...form.register("registrationDate")} />
                </Field>
                <Field label="Cost new (£)">
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register("costNew")}
                  />
                </Field>
                <SelectField
                  control={form.control}
                  name="fuelType"
                  label="Fuel type"
                  options={FUEL_TYPES.map((f) => ({ value: f, label: f }))}
                />
                <SelectField
                  control={form.control}
                  name="gearbox"
                  label="Gearbox"
                  colspan={2}
                  options={[
                    { value: "automatic", label: "Automatic" },
                    { value: "manual", label: "Manual" },
                  ]}
                />
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card className="p-5">
              <SectionHeader
                title="Source & Supplier"
                subtitle="Where this car came from and how VAT is handled"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sale or return" colspan={2}>
                  <Controller
                    control={form.control}
                    name="saleOrReturn"
                    render={({ field }) => (
                      <div className="flex h-10 items-center gap-3">
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <span className="text-xs text-muted-foreground">
                          {field.value
                            ? "Yes — held on consignment"
                            : "No — owned outright"}
                        </span>
                      </div>
                    )}
                  />
                </Field>
                <SelectField
                  control={form.control}
                  name="vehicleSource"
                  label="Vehicle source"
                  options={SOURCE_OPTIONS}
                />
                <SelectField
                  control={form.control}
                  name="vatCalculation"
                  label="VAT calculation"
                  options={VAT_OPTIONS}
                />
                <Field
                  label="Supplier"
                  required
                  colspan={2}
                  error={form.formState.errors.supplier?.message}
                >
                  <Input
                    {...form.register("supplier")}
                    placeholder="Supplier name"
                  />
                </Field>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card className="p-5">
              <SectionHeader
                title="Purchase & Listing"
                subtitle="Cost, location, and how it shows on the website"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Purchased date"
                  required
                  error={form.formState.errors.purchasedDate?.message}
                >
                  <Input type="date" {...form.register("purchasedDate")} />
                </Field>
                <Field
                  label="Purchased price (£)"
                  required
                  error={form.formState.errors.purchasedPrice?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register("purchasedPrice")}
                  />
                </Field>
                <Field label="Location" colspan={2}>
                  <Input
                    {...form.register("location")}
                    placeholder="AA / Zuto, BCA Auction…"
                  />
                </Field>
                <SelectField
                  control={form.control}
                  name="saleType"
                  label="Sale type"
                  options={SALE_TYPE_OPTIONS}
                />
                <Field label="Website display">
                  <Controller
                    control={form.control}
                    name="websiteDisplay"
                    render={({ field }) => (
                      <div className="flex h-10 items-center gap-3">
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <span className="text-xs text-muted-foreground">
                          {field.value ? "Visible" : "Hidden"}
                        </span>
                      </div>
                    )}
                  />
                </Field>
                <Field label="Keytag number" colspan={2}>
                  <Input
                    {...form.register("keytagNumber")}
                    placeholder="e.g. K-2451"
                  />
                </Field>
              </div>
            </Card>
          )}

          {/* Action bar */}
          <div className="sticky bottom-0 -mx-1 flex flex-wrap justify-between gap-2 border-t bg-background/80 px-1 py-3 backdrop-blur">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled>
                Save as Draft
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                {step < STEPS.length ? "Continue" : "Add Vehicle"}
              </Button>
            </div>
          </div>
        </div>

        {/* Cost summary — sticky receipt */}
        <CostSummaryReceipt
          buyingPrice={purchasedPrice}
          feesAndCharges={0}
          stockingCharges={0}
          prepCosts={0}
          warranty={0}
          listingPrice={null}
          subtitle={watchAll.purchasedDate || undefined}
          className="sticky top-20 hidden h-fit lg:block"
        />
      </div>
    </form>
  );
}

interface StepperProps {
  steps: StepDef[];
  current: number;
  onSelect: (id: number) => void;
  errors: Record<string, unknown>;
}

function Stepper({ steps, current, onSelect, errors }: StepperProps) {
  return (
    <ol className="flex w-full items-start gap-1 overflow-x-auto pb-2">
      {steps.map((s, idx) => {
        const isComplete = current > s.id;
        const isCurrent = current === s.id;
        const isPast = current >= s.id;
        const stepHasError = s.fields.some((f) => f in errors);
        const clickable = s.id <= current;
        const isLast = idx === steps.length - 1;
        return (
          <li
            key={s.id}
            className={cn(
              "flex min-w-0 items-center gap-2",
              !isLast &&
                "flex-1 after:mt-3.5 after:h-px after:flex-1 after:bg-border",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              disabled={!clickable}
              className={cn(
                "group flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
                clickable && "hover:bg-muted",
                !clickable && "cursor-default opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isCurrent &&
                    "bg-primary text-primary-foreground ring-2 ring-primary/20 ring-offset-2 ring-offset-background",
                  isComplete &&
                    !stepHasError &&
                    "bg-primary text-primary-foreground",
                  !isPast && "bg-muted text-muted-foreground",
                  stepHasError &&
                    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                )}
              >
                {isComplete && !stepHasError ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  s.id
                )}
              </span>
              <span className="hidden min-w-0 flex-col leading-tight sm:flex">
                <span
                  className={cn(
                    "truncate text-xs font-medium",
                    isPast ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {s.description}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
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
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  colspan?: 2;
  muted?: boolean;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className={colspan === 2 ? "sm:col-span-2" : undefined}>
      <Label className={muted ? "text-muted-foreground" : undefined}>
        {label}
        {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
      </Label>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

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
                <SelectItem
                  key={o.value}
                  value={o.value}
                  className="capitalize"
                >
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
