"use client";

/*
 * STYLEGUIDE — the living reference for Car Capital's design system.
 *
 * Everything here reads from the real tokens in globals.css and the real
 * components in src/components/ui, so it can't drift from the app: change a
 * token and this page changes with it. Colour values are resolved at runtime
 * per theme rather than hardcoded, because every semantic token routes through
 * Nord's --n-color-* vars and is a different colour in light vs dark.
 *
 * Sits outside the (dashboard) group so it renders without app chrome. It is
 * still behind auth (middleware protects everything but PUBLIC_PATHS), which
 * is intentional — this is an internal reference, not a public surface.
 */

import * as React from "react";
import { useTheme } from "next-themes";
import {
  ArrowRightIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  TrashIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CopyChip,
  Eyebrow,
  Section,
  SpecRow,
  Specimen,
  SwatchGrid,
  useMounted,
  useResolvedTokens,
} from "./parts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ------------------------------------------------------------------ tokens */

const SURFACE_TOKENS = [
  "background",
  "card",
  "popover",
  "muted",
  "accent",
  "secondary",
  "sidebar",
] as const;

const TEXT_TOKENS = [
  "foreground",
  "muted-foreground",
  "primary-foreground",
  "secondary-foreground",
  "accent-foreground",
] as const;

const STATUS_TOKENS = [
  "primary",
  "destructive",
  "success",
  "warning",
  "info",
] as const;

const STATUS_TEXT_TOKENS = [
  "destructive-foreground",
  "success-foreground",
  "warning-foreground",
  "info-foreground",
] as const;

const LINE_TOKENS = ["border", "input", "ring"] as const;

const CHART_TOKENS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

const ALL_TOKENS = [
  ...SURFACE_TOKENS,
  ...TEXT_TOKENS,
  ...STATUS_TOKENS,
  ...STATUS_TEXT_TOKENS,
  ...LINE_TOKENS,
  ...CHART_TOKENS,
];

const TYPE_SCALE = [
  {
    cls: "text-2xl",
    role: "Display",
    use: "Page and modal <h1>, KPI hero numbers",
    size: "1.5rem / 24px",
    detail: "1.15 · −0.02em",
  },
  {
    cls: "text-base",
    role: "Title",
    use: "Card, panel, dialog and section titles",
    size: "1.125rem / 18px",
    detail: "1.35 · −0.012em",
  },
  {
    cls: "text-sm",
    role: "Body",
    use: "Prose, descriptions, table cells, nav, inputs",
    size: "0.875rem / 14px",
    detail: "1.5 · −0.004em",
  },
  {
    cls: "text-xs",
    role: "Label",
    use: "Eyebrows, captions, meta, table heads",
    size: "0.75rem / 12px",
    detail: "1.4 · +0.008em",
  },
  {
    cls: "text-2xs",
    role: "Micro",
    use: "LOCKED — glyphs in fixed sub-12px boxes only",
    size: "0.625rem / 10px",
    detail: "1 · +0.01em",
  },
] as const;

const RADII = [
  { cls: "rounded-sm", calc: "--radius − 2px" },
  { cls: "rounded-md", calc: "--radius" },
  { cls: "rounded-lg", calc: "--radius + 1px" },
  { cls: "rounded-xl", calc: "--radius + 3px" },
  { cls: "rounded-2xl", calc: "--radius + 5px" },
] as const;

const ELEVATION = [
  { cls: "shadow-xs/5", use: "Inputs, checkboxes, resting cards" },
  { cls: "shadow-sm", use: "Card default, switch thumb" },
  { cls: "shadow-md/5", use: "Tooltips" },
  { cls: "shadow-lg/5", use: "Dialogs, sheets" },
] as const;

const SPACING = [1, 2, 3, 4, 6, 8] as const;

const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "destructive-outline",
  "link",
] as const;

const BUTTON_SIZES = ["xs", "sm", "default", "lg", "xl"] as const;

const BADGE_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "success",
  "warning",
  "error",
  "info",
  "destructive",
] as const;

const NAV = [
  { id: "colour", label: "Colour" },
  { id: "typography", label: "Typography" },
  { id: "shape", label: "Shape & elevation" },
  { id: "spacing", label: "Spacing" },
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Badges" },
  { id: "forms", label: "Forms" },
  { id: "navigation", label: "Navigation" },
  { id: "data", label: "Data" },
  { id: "overlays", label: "Overlays" },
  { id: "feedback", label: "Feedback" },
] as const;

/* --------------------------------------------------------------- the page */

export default function StyleguidePage(): React.ReactElement {
  const values = useResolvedTokens(ALL_TOKENS);
  const active = useActiveSection(NAV.map((n) => n.id));

  return (
    <div className="min-h-full bg-background text-foreground">
      <a
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        href="#content"
      >
        Skip to content
      </a>

      <Header active={active} />

      <div className="container flex gap-10 py-10">
        <SideNav active={active} />

        <main
          className="flex min-w-0 flex-1 flex-col gap-12 pb-24"
          id="content"
          tabIndex={-1}
        >
          <ColourSection values={values} />
          <TypographySection />
          <ShapeSection />
          <SpacingSection />
          <ButtonsSection />
          <BadgesSection />
          <FormsSection />
          <NavigationSection />
          <DataSection />
          <OverlaysSection />
          <FeedbackSection />
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ chrome */

function Header({ active }: { active: string | null }): React.ReactElement {
  return (
    <header className="sticky top-0 z-40 border-border border-b bg-background/88 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="truncate font-semibold text-sm">Styleguide</span>
          <span className="truncate text-muted-foreground text-xs max-sm:hidden">
            Car Capital design system
          </span>
        </div>
        <ThemeSwitch />
      </div>

      {/* Below lg the side rail is gone, so the same jump links ride along as a
          scrolling strip — 11 sections with no nav is a lot of thumb. */}
      <div className="container flex gap-1 overflow-x-auto pb-2 lg:hidden">
        {NAV.map((item) => (
          <a
            aria-current={active === item.id ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-muted-foreground text-xs outline-none transition-[color,background-color] focus-visible:ring-2 focus-visible:ring-ring",
              active === item.id && "bg-accent font-medium text-foreground",
            )}
            href={`#${item.id}`}
            key={item.id}
          >
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}

/**
 * Light and dark are two different products here — every semantic token
 * resolves through a different Nord value — so the page is unusable as a
 * reference without a way to flip and compare.
 */
function ThemeSwitch(): React.ReactElement {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const options = [
    { value: "light", label: "Light", Icon: SunIcon },
    { value: "dark", label: "Dark", Icon: MoonIcon },
    { value: "system", label: "System", Icon: MonitorIcon },
  ] as const;

  return (
    <div
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
      role="group"
    >
      {options.map(({ value, label, Icon }) => {
        // Pre-hydration the resolved theme is unknown; render every option
        // unselected rather than guessing and flashing the wrong one.
        const selected = mounted && theme === value;
        return (
          <button
            aria-label={label}
            aria-pressed={selected}
            className={cn(
              "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color,box-shadow] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              selected && "bg-background text-foreground shadow-sm/5 dark:bg-input",
            )}
            key={value}
            onClick={() => setTheme(value)}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

function SideNav({ active }: { active: string | null }): React.ReactElement {
  return (
    <nav
      aria-label="Sections"
      className="sticky top-24 hidden h-fit w-44 shrink-0 flex-col gap-0.5 lg:flex"
    >
      {NAV.map((item) => (
        <a
          aria-current={active === item.id ? "true" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-muted-foreground text-sm outline-none transition-[color,background-color] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            active === item.id && "bg-accent font-medium text-foreground",
          )}
          href={`#${item.id}`}
          key={item.id}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

/** Highlights the section currently nearest the top of the viewport. */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = React.useState<string | null>(ids[0] ?? null);
  const key = ids.join(",");

  React.useEffect(() => {
    const sectionIds = key.split(",");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Top band only: a section counts as "current" once its heading reaches
      // the header, not when any part of it is anywhere on screen.
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);

  return active;
}

/* --------------------------------------------------------------- sections */

function ColourSection({
  values,
}: {
  values: Record<string, string>;
}): React.ReactElement {
  return (
    <Section
      id="colour"
      lede="Semantic tokens only — never a raw hex. Each one bridges to a Nord --n-color-* variable, so a single .dark class flips the Tailwind utilities and the <nord-*> web components together. Values below are resolved live from the current theme."
      title="Colour"
    >
      <Specimen
        note="The canvas stack. Dark mode preserves the layering rather than inverting it: the raised surface stays lighter than the page behind it."
        title="Surfaces"
      >
        <SwatchGrid names={SURFACE_TOKENS} values={values} />
      </Specimen>

      <Specimen
        note="muted-foreground is pinned to oklch(0.53 0.025 235.3) in light mode — Nord's own weaker text measured 4.41:1 on --muted, under the 4.5 AA floor for the 11–12px text it carries. Only lightness moved, so the tone is unchanged."
        title="Text"
      >
        <SwatchGrid names={TEXT_TOKENS} values={values} />
      </Specimen>

      <Specimen
        note="Solid fills for buttons, dots and chart series. Note destructive-foreground is NOT text-on-destructive — it is the dark red used for error copy on light surfaces; the solid destructive button uses text-white."
        title="Brand & status"
      >
        <SwatchGrid names={STATUS_TOKENS} values={values} />
        <div className="mt-6">
          <SwatchGrid names={STATUS_TEXT_TOKENS} values={values} />
        </div>
      </Specimen>

      <Specimen
        note="Borders are drawn against the page, not the card, so they are shown over --background here."
        title="Lines"
      >
        <SwatchGrid names={LINE_TOKENS} values={values} />
      </Specimen>

      <Specimen
        note="Five series, ordered for categorical use. Beyond five, aggregate into an 'Other' bucket rather than adding a sixth hue."
        title="Charts"
      >
        <SwatchGrid names={CHART_TOKENS} values={values} />
      </Specimen>
    </Section>
  );
}

function TypographySection(): React.ReactElement {
  return (
    <Section
      id="typography"
      lede="Geist Sans, four sizes plus one locked micro size. Emphasis is weight and colour, never a fifth size. Line-height and tracking are tuned per size for Geist's metrics — it has a tall x-height and open default spacing, so it needs less negative tracking than most sans faces."
      title="Typography"
    >
      <Specimen note="Roles, not sizes: pick by what the text is, not how big you want it." title="Scale">
        <div className="flex flex-col">
          {TYPE_SCALE.map((t) => (
            <div
              className="grid gap-x-6 gap-y-1 border-border border-t py-4 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[1fr_14rem]"
              key={t.cls}
            >
              <div className="min-w-0">
                <p className={cn(t.cls, "truncate text-foreground")}>
                  {t.role} — 48 vehicles in stock
                </p>
                <p className="mt-1 text-muted-foreground text-xs">{t.use}</p>
              </div>
              <div className="flex flex-col gap-0.5 sm:items-end sm:text-right">
                <CopyChip className="sm:justify-end" value={t.cls} />
                <span className="font-mono text-muted-foreground text-xs tabular-nums">
                  {t.size}
                </span>
                <span className="font-mono text-muted-foreground text-xs tabular-nums">
                  {t.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Three weights only. font-synthesis is off app-wide, so a weight without a font file fails visibly instead of shipping a faked one."
        title="Weight"
      >
        <SpecRow label="400 · normal">
          <span className="text-sm">Body copy and table cells</span>
        </SpecRow>
        <SpecRow label="500 · medium">
          <span className="font-medium text-sm">Labels, buttons, nav items</span>
        </SpecRow>
        <SpecRow label="600 · semibold">
          <span className="font-semibold text-sm">
            Headings, card titles, &lt;strong&gt;
          </span>
        </SpecRow>
      </Specimen>

      <Specimen
        note="Numbers that stack in a column get tabular figures. Proportional digits make a currency column read as ragged noise."
        title="Numerals"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Eyebrow>Proportional — wrong</Eyebrow>
            <div className="mt-2 flex flex-col text-sm">
              <span>£11,940.00</span>
              <span>£8,275.50</span>
              <span>£141,000.00</span>
            </div>
          </div>
          <div>
            <Eyebrow>tabular-nums — right</Eyebrow>
            <div className="mt-2 flex flex-col text-sm tabular-nums">
              <span>£11,940.00</span>
              <span>£8,275.50</span>
              <span>£141,000.00</span>
            </div>
          </div>
        </div>
      </Specimen>

      <Specimen
        note="Body prose is capped at 65ch. Full-width lines on a 2000px monitor are exhausting to read."
        title="Measure"
      >
        <p className="max-w-[65ch] text-sm">
          A vehicle moves through arrival, preparation, advertising and sale.
          Each stage writes to the same record, so the detail page is the single
          source of truth for where a car is and what it has cost so far.
        </p>
      </Specimen>
    </Section>
  );
}

function ShapeSection(): React.ReactElement {
  return (
    <Section
      id="shape"
      lede="The radius scale is anchored on Nord's --n-border-radius (≈5px) rather than Tailwind's 16px default, so rounded-* utilities match the <nord-*> components exactly. Nested surfaces subtract: inner radius = outer radius − padding."
      title="Shape & elevation"
    >
      <Specimen title="Radius">
        <div className="flex flex-wrap gap-5">
          {RADII.map((r) => (
            <div className="flex flex-col items-center gap-2" key={r.cls}>
              <div
                className={cn(
                  "size-16 border border-border bg-muted",
                  r.cls,
                )}
              />
              <CopyChip value={r.cls} />
              <span className="font-mono text-[0.6875rem] text-muted-foreground">
                {r.calc}
              </span>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Shadows are alpha-layered and paired with a border so they recede into the surface instead of sitting on top of it."
        title="Elevation"
      >
        <div className="flex flex-wrap gap-5">
          {ELEVATION.map((e) => (
            <div className="flex flex-col items-center gap-2" key={e.cls}>
              <div
                className={cn(
                  "size-16 rounded-lg border border-border bg-card",
                  e.cls,
                )}
              />
              <CopyChip value={e.cls} />
              <span className="max-w-28 text-center text-[0.6875rem] text-muted-foreground">
                {e.use}
              </span>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Left: the inner card reuses the parent radius and the corners visibly disagree. Right: inner = outer − padding."
        title="Nested radii"
      >
        <div className="flex flex-wrap gap-6">
          <div className="rounded-2xl border border-border bg-muted p-2">
            <div className="size-24 rounded-2xl border border-border bg-card" />
          </div>
          <div className="rounded-2xl border border-border bg-muted p-2">
            <div className="size-24 rounded-xl border border-border bg-card" />
          </div>
        </div>
      </Specimen>
    </Section>
  );
}

function SpacingSection(): React.ReactElement {
  return (
    <Section
      id="spacing"
      lede="Tailwind's 4px scale. Space siblings with gap on the parent, never margin-bottom on every child — margin leaves a trailing gap after the last item and bleeds past the component boundary."
      title="Spacing"
    >
      <Specimen title="Scale">
        <div className="flex flex-col gap-3">
          {SPACING.map((s) => (
            <div className="flex items-center gap-4" key={s}>
              <span className="w-16 shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
                {s} · {s * 4}px
              </span>
              <div
                className="h-3 rounded-xs bg-primary"
                style={{ width: `${s * 4}px` }}
              />
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Page shell: max-width 1416px, centred, 16px gutters rising to 24px at lg."
        title="Container"
      >
        <CopyChip value="container" />
      </Specimen>
    </Section>
  );
}

function ButtonsSection(): React.ReactElement {
  return (
    <Section
      id="buttons"
      lede="Backed by <nord-button>. One primary action per view — if three buttons carry equal weight, none of them is the next step. Label the outcome (“Save changes”), not the mechanism (“Submit”)."
      title="Buttons"
    >
      <Specimen title="Variants">
        {BUTTON_VARIANTS.map((variant) => (
          <SpecRow key={variant} label={variant}>
            <Button variant={variant}>Save changes</Button>
            <Button disabled variant={variant}>
              Disabled
            </Button>
          </SpecRow>
        ))}
      </Specimen>

      <Specimen title="Sizes">
        {BUTTON_SIZES.map((size) => (
          <SpecRow key={size} label={size}>
            <Button size={size}>Add vehicle</Button>
          </SpecRow>
        ))}
      </Specimen>

      <Specimen
        note="Icon buttons must carry an aria-label — the label describes the action, not the glyph."
        title="Icon & loading"
      >
        <SpecRow label="With icon">
          <Button>
            <PlusIcon />
            Add vehicle
          </Button>
          <Button variant="outline">
            Continue
            <ArrowRightIcon />
          </Button>
        </SpecRow>
        <SpecRow label="Icon only">
          <Button aria-label="Add vehicle" size="icon-sm">
            <PlusIcon />
          </Button>
          <Button aria-label="Add vehicle" size="icon">
            <PlusIcon />
          </Button>
          <Button aria-label="Delete vehicle" size="icon" variant="destructive">
            <TrashIcon />
          </Button>
        </SpecRow>
        <SpecRow label="Loading">
          <Button loading>Saving</Button>
          <Button loading variant="outline">
            Saving
          </Button>
        </SpecRow>
      </Specimen>
    </Section>
  );
}

function BadgesSection(): React.ReactElement {
  return (
    <Section
      id="badges"
      lede="Status and category markers. Status badges use a tinted background with matching text rather than a solid fill, so a table of them stays readable. Never rely on colour alone — the word carries the meaning."
      title="Badges"
    >
      <Specimen title="Variants">
        <div className="flex flex-wrap gap-2">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </Specimen>

      <Specimen title="Sizes">
        <SpecRow label="sm">
          <Badge size="sm" variant="success">
            Sold
          </Badge>
        </SpecRow>
        <SpecRow label="default">
          <Badge variant="success">Sold</Badge>
        </SpecRow>
        <SpecRow label="lg">
          <Badge size="lg" variant="success">
            Sold
          </Badge>
        </SpecRow>
      </Specimen>

      <Specimen
        note="In context: the badge qualifies the row, it does not outshout it."
        title="In use"
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">BMW 320d M Sport</span>
          <Badge variant="warning">In prep</Badge>
          <span className="text-muted-foreground tabular-nums">£18,995</span>
        </div>
      </Specimen>
    </Section>
  );
}

function FormsSection(): React.ReactElement {
  const [checked, setChecked] = React.useState(true);
  const [enabled, setEnabled] = React.useState(true);

  return (
    <Section
      id="forms"
      lede="Every control has a persistent label above it — a placeholder disappears the moment typing starts, exactly when the reminder is needed. Errors show inline next to the offending field, with a border, an icon and text, never colour alone."
      title="Forms"
    >
      <Specimen title="Text input">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-reg">Registration</Label>
            <Input defaultValue="LT19 XKR" id="sg-reg" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-placeholder">Mileage</Label>
            <Input id="sg-placeholder" placeholder="e.g. 42,300" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-invalid">Purchase price</Label>
            <Input aria-invalid defaultValue="-500" id="sg-invalid" />
            <p className="text-destructive-foreground text-xs">
              Purchase price must be greater than £0.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-disabled">VIN</Label>
            <Input
              defaultValue="WBA8E9C50GK000000"
              disabled
              id="sg-disabled"
            />
            <p className="text-muted-foreground text-xs">
              Read-only once the vehicle has arrived.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {(["sm", "default", "lg"] as const).map((size) => (
            <div className="flex flex-col gap-1.5" key={size}>
              <Eyebrow>{size}</Eyebrow>
              <Input placeholder={size} size={size} />
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen title="Textarea & select">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-notes">Notes</Label>
            <Textarea
              id="sg-notes"
              placeholder="Anything the prep team should know"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-source">Source</Label>
            <Select defaultValue="auction">
              <SelectTrigger id="sg-source">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auction">BCA Auction</SelectItem>
                <SelectItem value="dealer">Dealer</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="trade-in">Trade-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Specimen>

      <Specimen
        note="Every control is wrapped in or wired to a label, so the whole row is the hit target — a 16px box on its own is a poor one."
        title="Selection controls"
      >
        <SpecRow label="Checkbox">
          <Label className="cursor-pointer">
            <Checkbox checked={checked} onCheckedChange={setChecked} />
            MOT valid
          </Label>
          <Label className="cursor-pointer">
            <Checkbox indeterminate />
            Partially selected
          </Label>
          <Label className="cursor-not-allowed opacity-64">
            <Checkbox disabled />
            Disabled
          </Label>
        </SpecRow>
        <SpecRow label="Radio">
          <RadioGroup className="flex-row gap-4" defaultValue="standard">
            <RadioItem value="standard">Standard VAT</RadioItem>
            <RadioItem value="margin">Margin scheme</RadioItem>
            <RadioItem disabled value="exempt">
              Exempt
            </RadioItem>
          </RadioGroup>
        </SpecRow>
        <SpecRow label="Switch">
          <Label className="cursor-pointer">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            Publish to Auto Trader
          </Label>
          <Label className="cursor-not-allowed opacity-64">
            <Switch disabled />
            Disabled
          </Label>
        </SpecRow>
      </Specimen>
    </Section>
  );
}

function NavigationSection(): React.ReactElement {
  return (
    <Section
      id="navigation"
      lede="Tabs switch between views of the same thing. If the panels show different objects, that is navigation, not tabs."
      title="Navigation"
    >
      <Specimen title="Tabs — default">
        <Tabs defaultValue="week">
          <TabsList>
            <TabsTab value="week">This week</TabsTab>
            <TabsTab value="month">This month</TabsTab>
            <TabsTab value="year">This year</TabsTab>
          </TabsList>
          <TabsPanel className="pt-4 text-muted-foreground text-sm" value="week">
            6 vehicles sold, £71,850 revenue.
          </TabsPanel>
          <TabsPanel className="pt-4 text-muted-foreground text-sm" value="month">
            23 vehicles sold, £284,300 revenue.
          </TabsPanel>
          <TabsPanel className="pt-4 text-muted-foreground text-sm" value="year">
            271 vehicles sold, £3.4m revenue.
          </TabsPanel>
        </Tabs>
      </Specimen>

      <Specimen
        note="The underline variant is for page-level section switching, where the pill would compete with the page header."
        title="Tabs — underline"
      >
        <Tabs defaultValue="overview">
          <TabsList variant="underline">
            <TabsTab value="overview">Overview</TabsTab>
            <TabsTab value="costs">Costs</TabsTab>
            <TabsTab value="history">History</TabsTab>
          </TabsList>
          <TabsPanel
            className="pt-4 text-muted-foreground text-sm"
            value="overview"
          >
            Vehicle summary and current stage.
          </TabsPanel>
          <TabsPanel className="pt-4 text-muted-foreground text-sm" value="costs">
            Purchase, prep and transport costs.
          </TabsPanel>
          <TabsPanel
            className="pt-4 text-muted-foreground text-sm"
            value="history"
          >
            Every state change, newest first.
          </TabsPanel>
        </Tabs>
      </Specimen>
    </Section>
  );
}

function DataSection(): React.ReactElement {
  const rows = [
    { reg: "LT19 XKR", model: "BMW 320d M Sport", status: "In prep", cost: 14250 },
    { reg: "YE68 PLO", model: "Audi A4 S line", status: "Advertised", cost: 16400 },
    { reg: "MA20 VHT", model: "VW Golf GTI", status: "Sold", cost: 18995 },
  ];

  const variant = (status: string) =>
    status === "Sold" ? "success" : status === "Advertised" ? "info" : "warning";

  return (
    <Section
      id="data"
      lede="Money and counts are right-aligned with tabular figures. Get alignment right and the zebra striping that was compensating for it becomes unnecessary."
      title="Data"
    >
      <Specimen className="p-0" title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Registration</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.reg}>
                <TableCell className="font-mono tabular-nums">{r.reg}</TableCell>
                <TableCell className="font-medium">{r.model}</TableCell>
                <TableCell>
                  <Badge variant={variant(r.status)}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  £{r.cost.toLocaleString("en-GB")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Specimen>

      <Specimen title="Card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Stock on hand</CardTitle>
              <CardDescription>Across all locations</CardDescription>
            </CardHeader>
            <CardPanel>
              <p className="font-semibold text-2xl tabular-nums">48</p>
            </CardPanel>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Average days to sale</CardTitle>
              <CardDescription>Rolling 90 days</CardDescription>
            </CardHeader>
            <CardPanel>
              <p className="font-semibold text-2xl tabular-nums">37</p>
            </CardPanel>
          </Card>
        </div>
      </Specimen>

      <Specimen title="Avatar">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>SA</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
        </div>
      </Specimen>
    </Section>
  );
}

function OverlaysSection(): React.ReactElement {
  return (
    <Section
      id="overlays"
      lede="Dialogs trap focus and sit at z-[900] — Nord's fixed sidebar is at 400 and the top bar at 500, so a bare z-50 backdrop would leave the sidebar lit and clickable behind the modal. Tooltips cannot hold interactive content; use a popover when something inside needs clicking."
      title="Overlays"
    >
      <Specimen title="Dialog">
        <Dialog>
          {/* Button renders <nord-button>, not a native <button>, so Base UI
              must supply the button semantics itself. */}
          <DialogTrigger
            nativeButton={false}
            render={<Button variant="outline" />}
          >
            Open dialog
          </DialogTrigger>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>Delete vehicle</DialogTitle>
              <DialogDescription>
                LT19 XKR and its 12 cost lines will be removed. This cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {/* Destructive action separated from cancel — proximity implies
                  equivalence, and these are not equivalent. */}
              <Button variant="outline">Keep vehicle</Button>
              <Button variant="destructive">Delete vehicle</Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      </Specimen>

      <Specimen title="Popover">
        <Popover>
          <PopoverTrigger
            nativeButton={false}
            render={<Button variant="outline" />}
          >
            Open popover
          </PopoverTrigger>
          <PopoverPopup className="w-72">
            <PopoverTitle>Margin scheme</PopoverTitle>
            <PopoverDescription>
              VAT is charged on the profit margin rather than the full sale
              price.
            </PopoverDescription>
          </PopoverPopup>
        </Popover>
      </Specimen>

      <Specimen title="Tooltip">
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline" />}>
            Hover me
          </TooltipTrigger>
          <TooltipPopup>Days since the vehicle arrived</TooltipPopup>
        </Tooltip>
      </Specimen>
    </Section>
  );
}

function FeedbackSection(): React.ReactElement {
  return (
    <Section
      id="feedback"
      lede="Loading holds the page shape; a spinner collapses it. Empty states say what is missing and what to do next — “No projects found” ends the journey, a next step continues it."
      title="Feedback"
    >
      <Specimen
        note="Skeletons mirror the real layout, so nothing jumps when the data lands."
        title="Skeleton"
      >
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-52" />
        </div>
      </Specimen>

      <Specimen title="Empty state">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-semibold text-base">No vehicles in prep</p>
          <p className="max-w-[42ch] text-muted-foreground text-sm">
            Vehicles appear here once they have arrived and been booked in for
            preparation.
          </p>
          <Button>
            <PlusIcon />
            Book a vehicle in
          </Button>
        </div>
      </Specimen>

      <Specimen
        note="Three signals, not one: colour, icon and text. Colour alone is invisible to a colourblind user."
        title="Error state"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sg-error">Sale price</Label>
          <Input aria-invalid defaultValue="0" id="sg-error" />
          <p className="flex items-center gap-1.5 text-destructive-foreground text-xs">
            <svg
              aria-hidden="true"
              className="size-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            Sale price must be greater than £0.
          </p>
        </div>
      </Specimen>
    </Section>
  );
}
