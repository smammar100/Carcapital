"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Loader2,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import type { AdvertData, Listing, ListingChannel, Vehicle } from "@/lib/types";
import { listingService } from "@/lib/services/listing-service";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Panel, Pill } from "@/components/vehicle-detail/primitives";
import { RegPlate } from "@/components/shared/reg-plate";
import {
  advertCompleteness,
  computeAdvertChecks,
  type AdvertCheck,
} from "@/lib/advert-completeness";
import { FeaturePicker } from "./feature-picker";
import { AdvertPreview } from "./advert-preview";

const LIMITS = {
  attentionGrabber: 30,
  keySellingPoint: 35,
  description: 3000,
  strapline: 999,
  subtitle: 500,
  highlight: 40,
} as const;

const DEFAULT_STRAPLINE =
  "Car Capital UK: quality used cars, competitive finance packages, nationwide delivery and part-exchange welcome. Buy with confidence from a trusted, established dealer.";

const CHANNELS: { key: ListingChannel; label: string; meta: string }[] = [
  { key: "website", label: "Car Capital UK", meta: "thecarcapital.co.uk" },
  { key: "autotrader", label: "AutoTrader", meta: "Profile / full advert" },
  { key: "ebay", label: "eBay Motors", meta: "Classified listing" },
  { key: "facebook", label: "Facebook", meta: "Marketplace" },
];

function splitHighlights(s: string): string[] {
  return s
    .split(/[•\n;,]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 5);
}

interface AdvertEditorProps {
  vehicle: Vehicle;
  listing: Listing | null;
  photoCount: number;
  photoUrl: string | null;
}

export function AdvertEditor({
  vehicle,
  listing,
  photoCount,
  photoUrl,
}: AdvertEditorProps) {
  const { user, company } = useAuth();
  const router = useRouter();

  const [advert, setAdvert] = useState<AdvertData>(() => {
    const saved = (listing?.advertData ?? {}) as Partial<AdvertData>;
    return {
      attentionGrabber: saved.attentionGrabber ?? "",
      keySellingPoint: saved.keySellingPoint ?? "",
      strapline: saved.strapline ?? "",
      subtitle: saved.subtitle ?? "",
      highlights: saved.highlights?.length
        ? saved.highlights
        : splitHighlights(listing?.specialFeatures ?? ""),
      features: saved.features ?? [],
      taxonomy: saved.taxonomy ?? {},
    };
  });
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState<number>(
    listing?.price ?? vehicle.listingPrice ?? 0,
  );
  const [channels, setChannels] = useState<Record<ListingChannel, boolean>>(
    listing?.channels ?? {
      website: false,
      autotrader: false,
      ebay: false,
      facebook: false,
    },
  );
  const [savedListing, setSavedListing] = useState<Listing | null>(listing);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const checks = computeAdvertChecks(
    vehicle,
    { description, price, channels },
    photoCount,
  );
  const { done, total, pct } = advertCompleteness(checks);

  const status = savedListing?.status ?? "draft";

  function setTax(key: keyof AdvertData["taxonomy"], val: string) {
    setAdvert((a) => ({ ...a, taxonomy: { ...a.taxonomy, [key]: val } }));
  }
  function setHighlight(i: number, val: string) {
    setAdvert((a) => {
      const h = [...a.highlights];
      while (h.length < 5) h.push("");
      h[i] = val;
      return { ...a, highlights: h };
    });
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/listing/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          make: advert.taxonomy.make ?? vehicle.make,
          model: advert.taxonomy.model ?? vehicle.model,
          derivative: advert.taxonomy.derivative ?? vehicle.derivative,
          year: vehicle.year,
          mileage: vehicle.mileage,
          colour: vehicle.colour,
          fuelType: vehicle.fuelType,
          transmission: vehicle.transmission,
          bodyType: vehicle.bodyType,
          price,
          features: advert.features,
        }),
      });
      const data = (await res.json()) as { description?: string; source?: string };
      if (data.description) {
        setDescription(data.description);
        toast.success(
          data.source === "openai"
            ? "Description generated"
            : "Description drafted (template)",
        );
      } else {
        toast.error("No description returned");
      }
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!company || !user) return;
    // Block save when any field is over its shown limit — don't silently
    // persist copy the channels (AutoTrader/website) will reject or truncate.
    const overLimit: string[] = [];
    if (advert.attentionGrabber.length > LIMITS.attentionGrabber)
      overLimit.push("Attention Grabber");
    if (advert.keySellingPoint.length > LIMITS.keySellingPoint)
      overLimit.push("Key Selling Point");
    if (advert.subtitle.length > LIMITS.subtitle) overLimit.push("Subtitle");
    if (advert.strapline.length > LIMITS.strapline) overLimit.push("Strapline");
    if (description.length > LIMITS.description) overLimit.push("Description");
    if (advert.highlights.some((h) => h.length > LIMITS.highlight))
      overLimit.push("Highlights");
    if (overLimit.length > 0) {
      toast.error(
        `Over the character limit: ${overLimit.join(", ")}. Trim before saving.`,
      );
      return;
    }
    setSaving(true);
    try {
      const base =
        savedListing ??
        (await listingService.ensureForVehicle(vehicle, company.id, user.id));
      const highlightsLine = advert.highlights
        .map((h) => h.trim())
        .filter(Boolean)
        .join(" • ");
      // Preserve a custom title if the listing already has one — only fall back
      // to the vehicle-derived default when no title has been set, so editing
      // the advert never discards a hand-written title.
      const defaultTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
      const title = base.title?.trim() ? base.title : defaultTitle;
      const updated = await listingService.update(base.id, {
        title,
        description,
        price,
        specialFeatures: highlightsLine,
        channels,
        advertData: advert,
      });
      setSavedListing(updated);
      toast.success("Advert saved");
      router.push(`/vehicles/${vehicle.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save advert");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky action header */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/vehicles/${vehicle.id}`} aria-label="Back to vehicle">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <RegPlate registration={vehicle.registration} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {[
                price ? formatCurrency(price) : null,
                `${vehicle.mileage.toLocaleString("en-GB")} mi`,
                vehicle.colour,
                vehicle.transmission,
                vehicle.fuelType,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Pill tone={status === "live" ? "good" : "neutral"}>{status}</Pill>
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save Advert
          </Button>
        </div>
      </div>

      {/* Body: form + sticky rail */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* ── Form column ───────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Spotlight */}
          <section id="spotlight" className="scroll-mt-24">
            <Panel
              title="AutoTrader Spotlight"
              subtitle="The bold text buyers see first on the search results card"
            >
              <div className="flex flex-col gap-4">
                <CharField
                  label="Attention Grabber"
                  help="Short hook, e.g. “Just arrived” or “1 owner”."
                  value={advert.attentionGrabber}
                  onChange={(v) =>
                    setAdvert((a) => ({ ...a, attentionGrabber: v }))
                  }
                  max={LIMITS.attentionGrabber}
                  placeholder="Attention grabber…"
                />
                <CharField
                  label="Key Selling Point"
                  help="The single best reason to buy this car."
                  value={advert.keySellingPoint}
                  onChange={(v) =>
                    setAdvert((a) => ({ ...a, keySellingPoint: v }))
                  }
                  max={LIMITS.keySellingPoint}
                  placeholder="Key selling point…"
                />
              </div>
            </Panel>
          </section>

          {/* Taxonomy */}
          <section id="taxonomy" className="scroll-mt-24">
            <Panel
              title="Taxonomy"
              subtitle="Mapped to AutoTrader's hierarchy · synced from your vehicle lookup"
            >
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <TaxInput
                  label="Make"
                  value={advert.taxonomy.make ?? vehicle.make}
                  onChange={(v) => setTax("make", v)}
                />
                <TaxInput
                  label="Model"
                  value={advert.taxonomy.model ?? vehicle.model}
                  onChange={(v) => setTax("model", v)}
                />
                <TaxInput
                  label="Generation"
                  value={advert.taxonomy.generation ?? vehicle.generation ?? ""}
                  onChange={(v) => setTax("generation", v)}
                />
                <TaxInput
                  label="Trim"
                  value={advert.taxonomy.trim ?? vehicle.trim ?? ""}
                  onChange={(v) => setTax("trim", v)}
                />
                <TaxInput
                  label="Fuel Type"
                  value={advert.taxonomy.fuelType ?? vehicle.fuelType}
                  onChange={(v) => setTax("fuelType", v)}
                />
                <TaxInput
                  label="Engine Size"
                  value={
                    advert.taxonomy.engineSize ??
                    (vehicle.engineSizeCC
                      ? `${(vehicle.engineSizeCC / 1000).toFixed(1)}L`
                      : "")
                  }
                  onChange={(v) => setTax("engineSize", v)}
                />
                <TaxInput
                  label="Transmission"
                  value={advert.taxonomy.transmission ?? vehicle.transmission}
                  onChange={(v) => setTax("transmission", v)}
                />
                <TaxInput
                  label="Derivative"
                  value={
                    advert.taxonomy.derivative ?? vehicle.derivative ?? ""
                  }
                  onChange={(v) => setTax("derivative", v)}
                />
              </div>
            </Panel>
          </section>

          {/* Description */}
          <section id="description" className="scroll-mt-24">
            <Panel
              title="Vehicle Description"
              subtitle={`${description.length.toLocaleString()} / ${LIMITS.description.toLocaleString()} chars · the main advert copy`}
              action={
                <Button
                  size="sm"
                  onClick={() => void generate()}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Generate
                </Button>
              }
            >
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the key facts about the vehicle, or hit Generate to draft it with AI."
                className="min-h-44"
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setDescription("")}
                  className="text-xs text-muted-foreground transition hover:text-foreground"
                >
                  Clear text
                </button>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    description.length > LIMITS.description
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {description.length.toLocaleString()} /{" "}
                  {LIMITS.description.toLocaleString()}
                </span>
              </div>
            </Panel>
          </section>

          {/* Strapline */}
          <section id="strapline" className="scroll-mt-24">
            <Panel
              title="Dealer Strapline"
              subtitle="Shown beneath the description on every advert"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAdvert((a) => ({ ...a, strapline: DEFAULT_STRAPLINE }))
                  }
                >
                  Use default
                </Button>
              }
            >
              <Textarea
                value={advert.strapline}
                onChange={(e) =>
                  setAdvert((a) => ({ ...a, strapline: e.target.value }))
                }
                placeholder="Enter dealer strapline here…"
                className="min-h-24"
              />
              <div className="mt-2 text-right text-xs tabular-nums text-muted-foreground">
                {advert.strapline.length} / {LIMITS.strapline}
              </div>
            </Panel>
          </section>

          {/* Website */}
          <section id="website" className="scroll-mt-24">
            <Panel
              title="Website Highlights"
              subtitle="Subtitle + up to 5 bullet points shown on the listing card"
            >
              <div className="flex flex-col gap-4">
                <CharField
                  label="Vehicle Subtitle"
                  value={advert.subtitle}
                  onChange={(v) => setAdvert((a) => ({ ...a, subtitle: v }))}
                  max={LIMITS.subtitle}
                  placeholder="Subtitle text…"
                />
                <div className="grid gap-2">
                  {[0, 1, 2, 3, 4].map((i) => {
                    const val = advert.highlights[i] ?? "";
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-5 text-xs tabular-nums text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Input
                          value={val}
                          onChange={(e) => setHighlight(i, e.target.value)}
                          maxLength={LIMITS.highlight}
                          placeholder={`Highlight ${i + 1}…`}
                          className="h-9"
                        />
                        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                          {val.length}/{LIMITS.highlight}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          </section>

          {/* Equipment */}
          <section id="equipment" className="scroll-mt-24">
            <Panel
              title="Equipment"
              subtitle={`${advert.features.length} feature${advert.features.length === 1 ? "" : "s"} selected`}
            >
              <FeaturePicker
                selected={advert.features}
                onChange={(features) => setAdvert((a) => ({ ...a, features }))}
              />
            </Panel>
          </section>

          {/* Channels & pricing */}
          <section id="channels" className="scroll-mt-24">
            <Panel
              title="Channels & Pricing"
              subtitle="Where this advert appears and at what price"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Advertised Price
                  </label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-muted-foreground">
                      £
                    </span>
                    <Input
                      type="number"
                      value={price || ""}
                      onChange={(e) => setPrice(Number(e.target.value) || 0)}
                      className="h-9 pl-7 tabular-nums"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Floor (minimum)
                  </label>
                  <div className="mt-1 flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                    {vehicle.minimumSalePrice
                      ? formatCurrency(vehicle.minimumSalePrice)
                      : "Not set"}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {CHANNELS.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{c.label}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.meta}
                      </div>
                    </div>
                    <Switch
                      checked={channels[c.key]}
                      onCheckedChange={(v) =>
                        setChannels((ch) => ({ ...ch, [c.key]: v }))
                      }
                    />
                  </label>
                ))}
              </div>
            </Panel>
          </section>

          {/* Footer save bar */}
          <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {done} of {total} advert fields ready · saved as{" "}
              <span className="font-medium text-foreground">{status}</span>
            </span>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save Advert
            </Button>
          </div>
        </div>

        {/* ── Sticky rail ───────────────────────────────────────── */}
        <div
          id="preview"
          className="flex scroll-mt-24 flex-col gap-4 lg:sticky lg:top-24 lg:self-start"
        >
          <Panel title="Live preview" subtitle="How buyers see this advert">
            <AdvertPreview
              vehicle={vehicle}
              advert={advert}
              description={description}
              price={price}
              photoUrl={photoUrl}
            />
          </Panel>

          <Panel
            title="Advert completeness"
            subtitle={`${done} of ${total} ready`}
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {checks.map((c) => (
                <CheckRow key={c.key} check={c} />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────

function CharField({
  label,
  help,
  value,
  onChange,
  max,
  placeholder,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
}) {
  const over = value.length > max;
  return (
    <div className="grid gap-1.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <div className="pt-1.5">
        <div className="text-sm font-medium">{label}</div>
        {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      </div>
      <div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("h-9", over && "border-destructive")}
        />
        <div
          className={cn(
            "mt-1 text-right text-xs tabular-nums",
            over ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {value.length} / {max}
        </div>
      </div>
    </div>
  );
}

function TaxInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9"
      />
    </div>
  );
}

const CHECK_TONE: Record<AdvertCheck["state"], string> = {
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  miss: "bg-muted text-muted-foreground",
};

function CheckRow({ check }: { check: AdvertCheck }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          CHECK_TONE[check.state],
        )}
      >
        {check.state === "done" ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : check.state === "warn" ? (
          <AlertCircle className="h-3 w-3" />
        ) : (
          <X className="h-3 w-3" strokeWidth={3} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium leading-snug">{check.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {check.meta}
        </div>
      </div>
    </div>
  );
}
