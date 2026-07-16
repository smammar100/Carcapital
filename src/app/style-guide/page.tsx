"use client";

/**
 * /style-guide — the living reference for the Genaro design system.
 *
 * Structured Foundation → Atoms → Components → Templates (atomic design).
 *
 * RULE: this page imports the REAL components and reads the REAL tokens off
 * the running document. Nothing here is a re-creation. If a primitive changes,
 * this page changes with it — a style guide that drifts from the app is worse
 * than none, because it launders stale decisions as current ones. The colour
 * swatches and type specimens resolve their values at runtime via
 * getComputedStyle, so they can never disagree with globals.css either.
 *
 * Auth-free (like /prototype) so design/QA can open it without a session.
 */

import * as React from "react";
import { Car, Download, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegPlate } from "@/components/shared/reg-plate";
import { DaysInStockChip } from "@/components/shared/days-in-stock-chip";
import { EmptyState } from "@/components/shared/empty-state";
import {
  VehicleStatusBadge,
  SalesStageBadge,
} from "@/components/shared/status-badge";
import { BarChart, DonutChart } from "@/components/charts/simple-charts";
import { VEHICLE_STATUSES, SALES_STAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════════ page scaffolding */

const SECTIONS = [
  { id: "foundation", label: "Foundation" },
  { id: "atoms", label: "Atoms" },
  { id: "components", label: "Components" },
  { id: "templates", label: "Templates" },
] as const;

function Section({
  id,
  tier,
  title,
  intro,
  children,
}: {
  id: string;
  tier: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-border pt-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {tier}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>
      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </section>
  );
}

/** One documented item: a title, optional note, and the live specimen. */
function Spec({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {note && (
          <p className="text-xs text-muted-foreground [text-wrap:pretty]">
            {note}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Inline code / token name. */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground">
      {children}
    </code>
  );
}

/* ══════════════════════════════════════════════ Foundation — colour */

/**
 * Resolve CSS custom properties to real sRGB bytes by painting them, so the
 * printed values can never disagree with globals.css. Re-resolves whenever the
 * theme flips (the .dark class toggles or the OS scheme changes) so the text
 * stays accurate in both modes without a reload.
 */
function useResolvedColors(vars: string[]) {
  const [map, setMap] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    const resolve = () => {
      const probe = document.createElement("div");
      document.body.appendChild(probe);
      const next: Record<string, string> = {};
      for (const v of vars) {
        probe.style.color = "";
        probe.style.color = `var(${v})`;
        next[v] = getComputedStyle(probe).color;
      }
      probe.remove();
      setMap(next);
    };
    resolve();
    const obs = new MutationObserver(resolve);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", resolve);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", resolve);
    };
  }, [vars]);
  return map;
}

const SEMANTIC_TOKENS: { name: string; role: string; pairs?: string }[] = [
  { name: "--background", role: "App canvas behind every page" },
  { name: "--foreground", role: "Primary body text" },
  { name: "--card", role: "Every table, card, kanban column and list card" },
  { name: "--muted", role: "Recessive fills — never a card surface" },
  { name: "--muted-foreground", role: "Secondary text, labels, table headers" },
  { name: "--primary", role: "Brand accent, primary actions, selection" },
  { name: "--primary-foreground", role: "Text on --primary" },
  { name: "--border", role: "Hairlines, gridlines, dividers" },
  { name: "--destructive", role: "Danger surfaces + solid danger buttons" },
  {
    name: "--destructive-foreground",
    role: "Danger TEXT on light surfaces — not text on --destructive",
  },
  { name: "--success", role: "Positive status surfaces" },
  { name: "--warning", role: "Caution status surfaces" },
  { name: "--info", role: "Informational status surfaces" },
];

const CHART_TOKENS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

function Swatch({ token, value }: { token: string; value?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="size-9 shrink-0 rounded-md border border-border"
        style={{ background: `var(${token})` }}
      />
      <span className="flex min-w-0 flex-col">
        <Code>{token}</Code>
        <span className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">
          {value ?? "…"}
        </span>
      </span>
    </div>
  );
}

function ColourFoundation() {
  const tokenNames = React.useMemo(
    () => [...SEMANTIC_TOKENS.map((t) => t.name), ...CHART_TOKENS],
    [],
  );
  const resolved = useResolvedColors(tokenNames);

  return (
    <>
      <Spec
        title="Semantic tokens"
        note="Every colour in the app resolves through these. They bridge to Nord's --n-color-* tokens, so a single .dark class flips the whole system. Values are read live from this document."
        className="!block"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SEMANTIC_TOKENS.map((t) => (
            <div key={t.name} className="flex flex-col gap-1">
              <Swatch token={t.name} value={resolved[t.name]} />
              <p className="text-2xs text-muted-foreground [text-wrap:pretty]">
                {t.role}
              </p>
            </div>
          ))}
        </div>
      </Spec>

      <Spec
        title="Chart palette"
        note="Fixed categorical order, never cycled past 5 — a 6th series folds into “Other”. Assigned by entity, never by rank, so a filter that changes the series count never repaints the survivors."
      >
        {CHART_TOKENS.map((t) => (
          <Swatch key={t} token={t} value={resolved[t]} />
        ))}
      </Spec>

      <Spec
        title="Surface rules"
        note="The single most-violated rule in this codebase, so it is stated explicitly: tables, cards, kanban columns and list cards are ALWAYS --card. --background is the page canvas only. --muted is for recessive fills (chips, tracks, tab strips) — never a card surface."
        className="!block"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { tok: "--background", label: "Page canvas", ok: false },
            { tok: "--card", label: "Tables · cards · columns", ok: true },
            { tok: "--muted", label: "Chips · tracks · tab strips", ok: false },
          ].map((s) => (
            <div
              key={s.tok}
              className="flex flex-col gap-2 rounded-lg border border-border p-3"
              style={{ background: `var(${s.tok})` }}
            >
              <Code>{s.tok}</Code>
              <span className="text-xs text-foreground">{s.label}</span>
              <span className="text-2xs text-muted-foreground">
                {s.ok ? "✓ surface for content" : "✗ never a card surface"}
              </span>
            </div>
          ))}
        </div>
      </Spec>
    </>
  );
}

/* ══════════════════════════════════════════════ Foundation — type */

const TYPE_SCALE = [
  {
    cls: "text-2xl",
    role: "display",
    use: "Page + modal <h1>, KPI hero numbers",
    sample: "Master Sheet",
  },
  {
    cls: "text-base",
    role: "title",
    use: "Card / panel / dialog / section titles, key numbers",
    sample: "Advert Completeness",
  },
  {
    cls: "text-sm",
    role: "body",
    use: "Prose, descriptions, table cells, nav, inputs",
    sample: "The complete record of every vehicle, in one wide grid.",
  },
  {
    cls: "text-xs",
    role: "label",
    use: "Eyebrows, captions, meta, table heads",
    sample: "UNITS SOLD",
  },
  {
    cls: "text-2xs",
    role: "micro — LOCKED",
    use: "Glyphs in fixed sub-12px boxes only",
    sample: "62d",
  },
];

function TypeRow({ cls, role, use, sample }: (typeof TYPE_SCALE)[number]) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [m, setM] = React.useState<string>("");
  React.useEffect(() => {
    if (!ref.current) return;
    const s = getComputedStyle(ref.current);
    setM(
      `${s.fontSize} · ${Math.round((parseFloat(s.lineHeight) / parseFloat(s.fontSize)) * 100) / 100} · ${s.letterSpacing === "normal" ? "0" : s.letterSpacing}`,
    );
  }, []);
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-6">
      <div className="flex w-56 shrink-0 flex-col gap-0.5">
        <Code>{cls}</Code>
        <span className="text-2xs text-muted-foreground">{role}</span>
        <span className="font-mono text-2xs text-muted-foreground">{m}</span>
      </div>
      <span ref={ref} className={cn(cls, "min-w-0 flex-1 truncate font-medium")}>
        {sample}
      </span>
      <span className="hidden max-w-[16rem] shrink-0 text-2xs text-muted-foreground lg:block">
        {use}
      </span>
    </div>
  );
}

function TypeFoundation() {
  return (
    <>
      <Spec
        title="Type scale — 4 sizes + 1 locked micro"
        note="Tuned for Geist Sans. Size · line-height · letter-spacing are read live from each specimen. Emphasis is weight (600) + colour — never a 5th size. Arbitrary values like text-[11px] are a bug, not a choice."
        className="!block"
      >
        <div className="flex flex-col">
          {TYPE_SCALE.map((t) => (
            <TypeRow key={t.cls} {...t} />
          ))}
        </div>
      </Spec>

      <Spec title="Families" note="Geist Sans for UI, Geist Mono for values that must align or be read character-by-character.">
        <div className="flex flex-col gap-1">
          <span className="font-sans text-base">Geist Sans — UI</span>
          <Code>font-sans</Code>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-base">CC-0013 · LG68 OCH</span>
          <Code>font-mono</Code>
        </div>
      </Spec>

      <Spec
        title="Tabular numerals"
        note="Any value that CHANGES gets tabular-nums, or digits of different widths shift the layout as they update. Compare: the top row jitters, the bottom row doesn't."
        className="!block"
      >
        <div className="flex flex-col gap-1 font-medium">
          <span className="text-sm">£1,111.00 → £8,888.00 (proportional)</span>
          <span className="text-sm tabular-nums">
            £1,111.00 → £8,888.00 (tabular-nums)
          </span>
        </div>
      </Spec>
    </>
  );
}

/* ══════════════════════════════════════════════ Foundation — geometry */

function GeometryFoundation() {
  return (
    <>
      <Spec
        title="Radius"
        note="Anchored on Nord's --n-border-radius so Tailwind's rounded-* matches the <nord-*> web components. Nested surfaces should be concentric: outer radius = inner radius + padding."
      >
        {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl"].map(
          (r) => (
            <div key={r} className="flex flex-col items-center gap-1.5">
              <span className={cn("size-12 border border-border bg-muted", r)} />
              <Code>{r}</Code>
            </div>
          ),
        )}
      </Spec>

      <Spec
        title="Elevation"
        note="Shadows carry depth; borders carry structure. Sticky surfaces use a directional shadow to mark the boundary between pinned and scrolling content."
      >
        {["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg"].map((s) => (
          <div key={s} className="flex flex-col items-center gap-1.5">
            <span className={cn("size-12 rounded-lg border border-border bg-card", s)} />
            <Code>{s}</Code>
          </div>
        ))}
      </Spec>
    </>
  );
}

/* ══════════════════════════════════════════════ Atoms */

const BTN_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "link",
  "destructive",
  "destructive-outline",
] as const;
const BTN_SIZES = ["xs", "sm", "default", "lg", "xl"] as const;
const BADGE_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "success",
  "warning",
  "info",
  "error",
  "destructive",
] as const;

function Atoms() {
  const [checked, setChecked] = React.useState(true);
  const [on, setOn] = React.useState(true);

  return (
    <>
      <Spec title="Button — variants" note="One primary action per view. Destructive actions are never the default.">
        {BTN_VARIANTS.map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
      </Spec>

      <Spec title="Button — sizes" note="Sizes step down at the sm breakpoint so touch targets stay ≥44px on mobile.">
        {BTN_SIZES.map((s) => (
          <Button key={s} size={s}>
            {s}
          </Button>
        ))}
      </Spec>

      <Spec title="Button — with icon + icon-only" note="Icon-only buttons must carry an aria-label; the icon alone is not a name.">
        <Button>
          <Plus className="size-4" /> Add Vehicle
        </Button>
        <Button variant="outline">
          <Download className="size-4" /> Export CSV
        </Button>
        <Button variant="ghost" size="icon" aria-label="Filter">
          <SlidersHorizontal className="size-4" />
        </Button>
        <Button variant="destructive-outline" size="icon" aria-label="Delete">
          <Trash2 className="size-4" />
        </Button>
        <Button disabled>Disabled</Button>
      </Spec>

      <Spec title="Badge" note="Status colours are reserved (success / warning / info / error) and never reused as decoration.">
        {BADGE_VARIANTS.map((v) => (
          <Badge key={v} variant={v}>
            {v}
          </Badge>
        ))}
      </Spec>

      <Spec
        title="Text input — states"
        note="Focus and invalid styling are built into the primitive: focus ring from --ring, aria-invalid flips the border/ring to destructive. Never style these per-page."
        className="!block"
      >
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Default</Label>
            <Input placeholder="Search reg, make/model…" />
          </div>
          <div className="grid gap-1.5">
            <Label>Filled</Label>
            <Input defaultValue="LG68 OCH" />
          </div>
          <div className="grid gap-1.5">
            <Label>Disabled</Label>
            <Input placeholder="Unavailable" disabled />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-destructive-foreground">
              Invalid <span className="font-normal">(aria-invalid)</span>
            </Label>
            <Input defaultValue="not-an-email" aria-invalid />
            <p className="text-2xs text-destructive-foreground">
              Enter a valid email address.
            </p>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Textarea</Label>
            <Textarea placeholder="Special requirements…" rows={2} />
          </div>
        </div>
      </Spec>

      <Spec
        title="Numeric · date · time fields"
        note="Numbers, money, dates and times are the native input types styled by the same Input primitive. Numeric values render tabular-nums so they align in columns; money fields put the unit in the label, not the value."
        className="!block"
      >
        <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Number</Label>
            <Input type="number" defaultValue={68800} className="tabular-nums" />
          </div>
          <div className="grid gap-1.5">
            <Label>Price (£)</Label>
            <Input
              type="number"
              min={0}
              step={50}
              defaultValue={13250}
              className="tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Mileage</Label>
            <Input type="number" min={0} placeholder="0" className="tabular-nums" />
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input type="date" defaultValue="2026-07-16" />
          </div>
          <div className="grid gap-1.5">
            <Label>Time — 1h slots, business hours</Label>
            <Input type="time" defaultValue="10:00" min="09:00" max="17:00" step={3600} />
          </div>
          <div className="grid gap-1.5">
            <Label>Registration (mono)</Label>
            <Input defaultValue="LG68 OCH" className="font-mono uppercase" />
          </div>
        </div>
      </Spec>

      <Spec
        title="Select (dropdown) — states"
        note="The app's dropdown is the Base-UI Select composed as Select → SelectTrigger → SelectValue + SelectContent → SelectItem. Same state contract as Input: placeholder, selected, disabled, aria-invalid. Open the first one to see the popup — items show a check on the selected row, and SelectSeparator groups long lists."
        className="!block"
      >
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Placeholder (nothing chosen)</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Pick a stock vehicle…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / free text</SelectItem>
                <SelectSeparator />
                <SelectItem value="cc-0013">LG68 OCH — BMW 3 Series</SelectItem>
                <SelectItem value="cc-0017">MT67 RLZ — BMW X1</SelectItem>
                <SelectItem value="cc-0018">NA66 XGM — BMW X5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Selected value</Label>
            <Select
              defaultValue="dealer"
              items={{
                auction: "BCA Auction",
                dealer: "Dealer",
                private: "Private",
                trade_in: "Trade-in",
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auction">BCA Auction</SelectItem>
                <SelectItem value="dealer">Dealer</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="trade_in">Trade-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Disabled</Label>
            <Select disabled defaultValue="month" items={{ month: "Month" }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-destructive-foreground">
              Invalid <span className="font-normal">(required, empty)</span>
            </Label>
            <Select>
              <SelectTrigger aria-invalid>
                <SelectValue placeholder="Select a vehicle…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cc-0013">LG68 OCH — BMW 3 Series</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-2xs text-destructive-foreground">
              A vehicle is required to generate the invoice.
            </p>
          </div>
        </div>
        <p className="mt-3 text-2xs text-muted-foreground [text-wrap:pretty]">
          Raw native <Code>&lt;select&gt;</Code> elements showing a lowercase
          “all” are a defect, not a variant (see GEN-47) — every dropdown goes
          through this primitive or the shared FilterBar.
        </p>
      </Spec>

      <Spec title="Selection controls">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={checked} onCheckedChange={() => setChecked((v) => !v)} />
          Checkbox
        </label>
        <label className="flex items-center gap-2 text-sm opacity-64">
          <Checkbox checked disabled />
          Checked + disabled
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={on} onCheckedChange={() => setOn((v) => !v)} />
          Switch
        </label>
        <label className="flex items-center gap-2 text-sm opacity-64">
          <Switch disabled />
          Disabled
        </label>
      </Spec>

      <Spec title="Avatar · Skeleton">
        <Avatar>
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>TK</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </Spec>
    </>
  );
}

/* ══════════════════════════════════════════════ Components (domain) */

const AGING = [
  { label: "0–30", value: 12 },
  { label: "31–60", value: 23 },
  { label: "61–90", value: 18 },
  { label: "91–180", value: 9 },
  { label: "180+", value: 4 },
];
const SOURCES = [
  { label: "BCA Auction", value: 9 },
  { label: "Dealer", value: 6 },
  { label: "Private", value: 4 },
  { label: "Trade-in", value: 2 },
];

function Components() {
  return (
    <>
      <Spec
        title="RegPlate"
        note="The UK plate yellow is a real-world artefact, not a brand colour — it is deliberately hardcoded rather than tokenised."
      >
        <RegPlate registration="LG68 OCH" size="sm" />
        <RegPlate registration="LG68 OCH" />
        <RegPlate registration="LG68 OCH" size="lg" />
      </Spec>

      <Spec
        title="Status badges"
        note="Driven by the shared constants, so the guide lists every real status — add one to VEHICLE_STATUSES and it appears here automatically."
      >
        {VEHICLE_STATUSES.map((s) => (
          <VehicleStatusBadge key={s.value} status={s.value} />
        ))}
      </Spec>

      <Spec title="Sales stage badges">
        {SALES_STAGES.map((s) => (
          <SalesStageBadge key={s.value} stage={s.value} />
        ))}
      </Spec>

      <Spec
        title="DaysInStockChip"
        note="Colour encodes urgency, but the number is always present — never colour alone."
      >
        {[3, 20, 45, 80, 140, 200].map((d) => (
          <DaysInStockChip key={d} days={d} />
        ))}
      </Spec>

      <Spec title="Card" note="The white surface for all content. Compare against the page canvas behind it.">
        <Card className="w-56 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Units sold
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">27</p>
          <p className="mt-0.5 text-xs text-muted-foreground">This year</p>
        </Card>
        <Card className="w-56 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Revenue
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">£326k</p>
          <p className="mt-0.5 text-xs text-muted-foreground">+12% vs last yr</p>
        </Card>
      </Spec>

      <Spec title="Tabs" className="!block">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Profitability</TabsTrigger>
            <TabsTrigger value="b">Sales &amp; revenue</TabsTrigger>
            <TabsTrigger value="c">Purchase source</TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="pt-3 text-sm text-muted-foreground">
            Tab strips sit on --muted; the active tab lifts onto the card surface.
          </TabsContent>
          <TabsContent value="b" className="pt-3 text-sm text-muted-foreground">
            Sales &amp; revenue panel.
          </TabsContent>
          <TabsContent value="c" className="pt-3 text-sm text-muted-foreground">
            Purchase source panel.
          </TabsContent>
        </Tabs>
      </Spec>

      <Spec
        title="Charts"
        note="Bounded height + a real Y-axis. Every chart ships beside a table or legend so values are never colour-alone, and each mark carries a native hover tooltip."
        className="!block"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h4 className="mb-3 text-sm font-semibold">Days in stock</h4>
            <BarChart data={AGING} color="var(--chart-4)" height={160} />
          </Card>
          <Card className="p-4">
            <h4 className="mb-3 text-sm font-semibold">Purchase source</h4>
            <DonutChart data={SOURCES} centerLabel="units" />
          </Card>
        </div>
      </Spec>

      <Spec title="EmptyState" className="!block">
        <EmptyState
          icon={Car}
          title="No vehicles match"
          description="Try clearing a filter, or add a vehicle to get started."
          action={
            <Button size="sm">
              <Plus className="size-4" /> Add Vehicle
            </Button>
          }
        />
      </Spec>
    </>
  );
}

/* ══════════════════════════════════════════════ Templates */

const T_ROWS = [
  { id: "CC-0013", reg: "LG68 OCH", v: "BMW 3 SERIES", st: "listed", d: 62 },
  { id: "CC-0017", reg: "MT67 RLZ", v: "BMW X1", st: "reserved", d: 66 },
  { id: "CC-0018", reg: "NA66 XGM", v: "BMW X5", st: "ready", d: 24 },
] as const;

function Templates() {
  return (
    <>
      <Spec
        title="Data grid page"
        note="Page title + actions, a filter row, then one Card holding the table. Header and body are both --card; the header reads as a band through its border and weight, not a fill. Used by Master Sheet, All Vehicles, Invoicing, Closed Deals."
        className="!block"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-semibold">Master Sheet</h4>
              <p className="text-xs text-muted-foreground">
                The complete record of every vehicle. 116 rows.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="size-4" /> Columns
              </Button>
              <Button size="sm">
                <Download className="size-4" /> Export CSV
              </Button>
            </div>
          </div>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-card">
                <tr>
                  {["Stock ID", "Vehicle", "Status", "Days"].map((h) => (
                    <th
                      key={h}
                      className="border-r border-border px-3 py-2 text-left font-medium text-muted-foreground last:border-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-card">
                {T_ROWS.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="border-r border-border px-3 py-2 font-mono">
                      {r.id}
                    </td>
                    <td className="border-r border-border px-3 py-2">
                      <span className="flex items-center gap-2">
                        <RegPlate registration={r.reg} size="sm" />
                        {r.v}
                      </span>
                    </td>
                    <td className="border-r border-border px-3 py-2">
                      <VehicleStatusBadge status={r.st} />
                    </td>
                    <td className="px-3 py-2">
                      <DaysInStockChip days={r.d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </Spec>

      <Spec
        title="List + detail"
        note="A scrolling rail of white list cards beside a detail panel. The selected card carries a primary tint — the only non-white card in the rail. Used by Leads, Workshop, Work List, Returns."
        className="!block"
      >
        <div className="grid w-full gap-4 lg:grid-cols-[260px_1fr]">
          <div className="flex flex-col gap-1.5">
            {["Henry Phillips", "Daniel Lee", "Sophia Martinez"].map((n, i) => (
              <button
                key={n}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 text-left transition-colors",
                  i === 0 && "border-primary bg-primary/5",
                )}
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-2xs">
                    {n.split(" ").map((p) => p[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{n}</span>
                  <span className="truncate text-2xs text-muted-foreground">
                    AUDI A6 SALOON
                  </span>
                </span>
              </button>
            ))}
          </div>
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">Henry Phillips</h4>
              <Badge variant="secondary">Contacted</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Vehicle of interest", "AUDI A6 SALOON"],
                ["Channel", "Referral"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-border p-2.5">
                  <p className="text-2xs text-muted-foreground">{k}</p>
                  <p className="text-sm">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm">
                <Plus className="size-4" /> Create deal
              </Button>
              <Button size="sm" variant="outline">
                Update status
              </Button>
            </div>
          </Card>
        </div>
      </Spec>

      <Spec
        title="Kanban board"
        note="White columns on the page canvas, each bordered so it still reads as a tray now that its cards are white too. Used by Sales Pipeline and Maintenance Pipeline."
        className="!block"
      >
        <div className="grid w-full gap-3 sm:grid-cols-3">
          {[
            { s: "Pending", n: 2 },
            { s: "In Progress", n: 1 },
            { s: "Completed", n: 1 },
          ].map((col) => (
            <div
              key={col.s}
              className="flex min-h-32 flex-col gap-2 rounded-xl border border-border bg-card p-2.5"
            >
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-semibold">{col.s}</span>
                <span className="text-2xs text-muted-foreground">{col.n}</span>
              </div>
              {Array.from({ length: col.n }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-card p-2.5 shadow-xs"
                >
                  <RegPlate registration="SA17 WUV" size="sm" />
                  <span className="text-xs font-medium tabular-nums">£250.00</span>
                  <span className="text-2xs text-muted-foreground">
                    Front wheel bearing
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Spec>

      <Spec
        title="Analytics page"
        note="A KPI row of white cards, then a bounded chart grid. Every hero number is tabular-nums so it doesn't jitter as the period changes. Used by Reports & Analytics and the Dashboard."
        className="!block"
      >
        <div className="flex w-full flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Units sold", "27", "This year"],
              ["Revenue", "£326k", "+12% vs last yr"],
              ["Profit", "£53.7k", "16.5% margin"],
              ["Avg days in stock", "66d", "106 unsold"],
            ].map(([l, v, s]) => (
              <Card key={l} className="p-4">
                <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  {l}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">{s}</p>
              </Card>
            ))}
          </div>
          <Card className="p-4">
            <h4 className="mb-3 text-sm font-semibold">Days in stock</h4>
            <BarChart data={AGING} color="var(--chart-4)" height={150} />
          </Card>
        </div>
      </Spec>
    </>
  );
}

/* ══════════════════════════════════════════════ page */

export default function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-3 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Genaro Style Guide
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground [text-wrap:pretty]">
                The living reference for Car Capital UK. Every specimen below is
                the real component, and every token value is read from this
                document at runtime — so this page cannot drift from the app.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Atomic design</Badge>
              <Badge variant="outline">Light + dark</Badge>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
              >
                <span className="text-muted-foreground">{i + 1}</span>
                {s.label}
              </a>
            ))}
          </nav>
        </header>

        <div className="flex flex-col gap-12 pb-24">
          <Section
            id="foundation"
            tier="1 · Foundation"
            title="Tokens the whole system is built on"
            intro="Colour, type and geometry. Nothing above this layer may invent a value — if it isn't here, it doesn't exist."
          >
            <ColourFoundation />
            <TypeFoundation />
            <GeometryFoundation />
          </Section>

          <Section
            id="atoms"
            tier="2 · Atoms"
            title="Indivisible primitives"
            intro="The smallest building blocks. Every one is imported straight from @/components/ui — what you see is exactly what ships."
          >
            <Atoms />
          </Section>

          <Section
            id="components"
            tier="3 · Components"
            title="Atoms composed into domain pieces"
            intro="Car-Capital-specific molecules. These carry meaning — a reg plate, a status, a days-in-stock chip — not just shape."
          >
            <Components />
          </Section>

          <Section
            id="templates"
            tier="4 · Templates"
            title="The four page shapes"
            intro="Every screen in the app is one of these. The layout owns page padding; pages never add their own."
          >
            <Templates />
          </Section>
        </div>
      </div>
    </div>
  );
}
