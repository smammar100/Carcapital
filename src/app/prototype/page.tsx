"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Wrench,
  Camera,
  PoundSterling,
  Megaphone,
  Check,
  ArrowRight,
  Sparkles,
  Gauge,
  MapPin,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /prototype — Vehicle Detail "Overview" EMPTY STATE (a brand-new vehicle with
 * no advert, no AutoTrader valuation, no KPIs). 5 variations that answer "what
 * should I do first?" Refs (Mobbin): Oyster / Mailchimp (numbered getting-started
 * steps with per-step CTAs + progress), Steep (centered hero + one CTA),
 * Amplitude/Mixpanel (empty widgets with inline CTAs). Presentational only.
 */

const V = { reg: "LN73 KFA", title: "2020 BMW 1 Series", derivative: "118i M Sport 5dr Step Auto", stock: "CC-0119", received: "Received today" };

interface Step { n: number; title: string; desc: string; cta: string; icon: LucideIcon }
const STEPS: Step[] = [
  { n: 1, title: "Inspect the vehicle", desc: "Run the 20-point check to surface faults before prep starts.", cta: "Start Inspection", icon: ClipboardCheck },
  { n: 2, title: "Log prep & repairs", desc: "Turn inspection findings into prep and repair jobs.", cta: "Open Things to Do", icon: Wrench },
  { n: 3, title: "Add photos", desc: "Upload 8+ photos so the advert is complete.", cta: "Add Photos", icon: Camera },
  { n: 4, title: "Check valuation & price", desc: "Review the AutoTrader valuation, then set your price + floor.", cta: "Set Price", icon: PoundSterling },
  { n: 5, title: "Build the advert", desc: "Write the description, highlights and pick channels.", cta: "Build Advert", icon: Megaphone },
];

const primaryBtn = "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted";

/* ============================================================ carousel page */

const VARIATIONS: { id: string; label: string; sub: string; render: () => React.ReactNode }[] = [
  { id: "A", label: "Guided checklist (recommended)", sub: "Oyster/Mailchimp — a 'get this car sale-ready' card: numbered steps, per-step CTAs, progress, step 1 highlighted", render: () => <VariationA /> },
  { id: "B", label: "Centered hero", sub: "Steep — one friendly empty state with a single primary action (Start Inspection) + quick links", render: () => <VariationB /> },
  { id: "C", label: "Empty widgets in place", sub: "Keep the Overview layout — each KPI / valuation / advert card shows its own inline empty state + CTA", render: () => <VariationC /> },
  { id: "D", label: "Journey stepper", sub: "A prep → sale pipeline with 'You are here' at the start and the first action surfaced", render: () => <VariationD /> },
  { id: "E", label: "Hybrid", sub: "Getting-started checklist up top + slim contextual empty cards (valuation, location) so it still reads as Overview", render: () => <VariationE /> },
];

export default function PrototypePage() {
  const [i, setI] = useState(0);
  const cur = VARIATIONS[i];
  const go = (n: number) => setI((n + VARIATIONS.length) % VARIATIONS.length);
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Prototype — Overview empty state (new vehicle)</h1>
        <p className="mt-1 text-sm text-muted-foreground">No advert, no valuation, no KPIs yet — guide the user to the first action. Toggle OS dark mode.</p>
      </header>
      <div className="sticky top-0 z-10 -mx-6 mb-4 flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-6 py-2.5 backdrop-blur">
        <button onClick={() => go(i - 1)} className="grid size-8 place-items-center rounded-md border border-border bg-background hover:bg-muted" aria-label="Previous"><ChevronLeft className="size-4" /></button>
        <div className="flex flex-wrap gap-1">
          {VARIATIONS.map((v, n) => (
            <button key={v.id} onClick={() => setI(n)} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors", n === i ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-muted")}>
              <span className="font-semibold">{v.id}</span><span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => go(i + 1)} className="grid size-8 place-items-center rounded-md border border-border bg-background hover:bg-muted" aria-label="Next"><ChevronRight className="size-4" /></button>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{i + 1} / {VARIATIONS.length}</span>
      </div>
      <section>
        <div className="mb-3"><h2 className="text-sm font-semibold">{cur.id} — {cur.label}</h2><p className="text-xs text-muted-foreground">{cur.sub}</p></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <HeaderStrip />
          <Tabs />
          <div className="mt-4">{cur.render()}</div>
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- shared bits */

function HeaderStrip() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-24 shrink-0 place-items-center rounded-md border border-dashed border-border bg-muted/40 text-2xs text-muted-foreground">No photos</div>
        <div>
          <span className="rounded bg-amber-300 px-2 py-0.5 font-mono text-xs font-bold text-black">{V.reg}</span>
          <div className="mt-1 text-lg font-semibold leading-tight">{V.title}</div>
          <div className="text-2xs text-muted-foreground">{V.derivative} · {V.stock}</div>
          <div className="mt-1 flex items-center gap-2 text-2xs">
            <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Received</span>
            <span className="text-muted-foreground">{V.received}</span>
          </div>
        </div>
      </div>
      <button className={primaryBtn}><ClipboardCheck className="size-4" /> Start Inspection</button>
    </div>
  );
}

const TAB_NAMES = ["Overview", "Details", "Location", "Financials", "Things to Do", "Inspection", "Photos", "Listing", "Appointments", "Activity"];
function Tabs() {
  return (
    <div className="mt-3 flex gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1 text-sm">
      {TAB_NAMES.map((t, i) => (
        <span key={t} className={cn("shrink-0 rounded-md px-3 py-1.5", i === 0 ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>{t}</span>
      ))}
    </div>
  );
}

function StepIcon({ icon: Icon, done, active }: { icon: LucideIcon; done?: boolean; active?: boolean }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
      {done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
    </span>
  );
}

/* ---------------------------------------------------------------- A: guided checklist */
function VariationA() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="rounded-xl border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Let&apos;s get this car sale-ready</div>
            <p className="mt-0.5 text-sm text-muted-foreground">5 steps from arrival to live listing. Work top-down — start with the inspection.</p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">0 of 5 done</span>
        </div>
        <div className="mt-4 flex flex-col">
          {STEPS.map((s, i) => (
            <div key={s.n} className={cn("flex items-center gap-3 rounded-lg border px-3 py-3", i === 0 ? "border-primary/40 bg-primary/5" : "border-transparent")}>
              <StepIcon icon={s.icon} active={i === 0} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">{s.title}{i === 0 && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-2xs font-semibold text-primary">Start here</span>}</div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <button className={cn(i === 0 ? primaryBtn : ghostBtn, "shrink-0")}>{s.cta} {i === 0 && <ArrowRight className="size-3.5" />}</button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <EmptyValuation />
        <EmptyLocation />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- B: centered hero */
function VariationB() {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-background px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Rocket className="size-7" /></span>
      <div className="mt-4 text-lg font-semibold">New to stock — let&apos;s get it sale-ready</div>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">There&apos;s no advert, valuation or pricing yet. The first step is a quick inspection — everything else follows from what it finds.</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button className={primaryBtn}><ClipboardCheck className="size-4" /> Start Inspection</button>
        <button className={ghostBtn}><Camera className="size-4" /> Add Photos</button>
        <button className={ghostBtn}><PoundSterling className="size-4" /> Set Price</button>
      </div>
      <div className="mt-6 text-2xs text-muted-foreground">Then: prep &amp; repairs → photos → price → advert → list</div>
    </div>
  );
}

/* ---------------------------------------------------------------- C: empty widgets in place */
function EmptyKpi({ label, hint, icon: Icon }: { label: string; hint: string; icon: LucideIcon }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between"><span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span><Icon className="size-4 text-muted-foreground/50" /></div>
      <div className="mt-1 text-2xl font-semibold text-muted-foreground/40">—</div>
      <div className="text-2xs text-muted-foreground">{hint}</div>
    </div>
  );
}
function VariationC() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <EmptyKpi label="Web Price" hint="Set a price to start" icon={PoundSterling} />
        <EmptyKpi label="Days in Stock" hint="From today" icon={Gauge} />
        <EmptyKpi label="AT Retail Avg" hint="Run valuation" icon={Sparkles} />
        <EmptyKpi label="Net Profit (live)" hint="Needs price + costs" icon={PoundSterling} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="text-sm font-semibold">Advert completeness</div>
          <div className="text-xs text-muted-foreground">Nothing set yet — here&apos;s the path to a live listing.</div>
          <div className="mt-3 flex flex-col gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40">
                <StepIcon icon={s.icon} active={i === 0} />
                <div className="min-w-0 flex-1"><div className="text-sm font-medium">{s.title}</div><div className="text-2xs text-muted-foreground">{s.desc}</div></div>
                <button className={cn(i === 0 ? primaryBtn : "text-xs text-primary hover:underline", "shrink-0")}>{i === 0 ? s.cta : "Open →"}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4"><EmptyValuation /><EmptyLocation /></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- D: journey stepper */
function VariationD() {
  const journey = [
    { label: "Received", icon: Check, state: "done" as const },
    { label: "Inspect", icon: ClipboardCheck, state: "active" as const },
    { label: "Prep", icon: Wrench, state: "todo" as const },
    { label: "Photos", icon: Camera, state: "todo" as const },
    { label: "Price", icon: PoundSterling, state: "todo" as const },
    { label: "Advert", icon: Megaphone, state: "todo" as const },
  ];
  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <div className="text-base font-semibold">This car&apos;s journey to sold</div>
      <p className="mt-0.5 text-sm text-muted-foreground">It just arrived. Next up: the inspection.</p>
      <div className="mt-6 flex items-start gap-1 overflow-x-auto pb-2">
        {journey.map((j, i) => (
          <div key={j.label} className="flex items-start gap-1">
            <div className="flex w-24 flex-col items-center gap-1.5 text-center">
              <span className={cn("grid size-10 place-items-center rounded-full", j.state === "done" ? "bg-emerald-500 text-white" : j.state === "active" ? "bg-primary text-primary-foreground ring-4 ring-primary/15" : "bg-muted text-muted-foreground")}><j.icon className="size-4" /></span>
              <span className={cn("text-xs font-medium", j.state === "todo" && "text-muted-foreground")}>{j.label}</span>
              {j.state === "active" && <span className="text-2xs font-semibold text-primary">You are here</span>}
            </div>
            {i < journey.length - 1 && <div className={cn("mt-5 h-0.5 w-8 shrink-0 rounded", j.state === "done" ? "bg-emerald-500" : "bg-border")} />}
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <StepIcon icon={ClipboardCheck} active />
          <div><div className="text-sm font-medium">Start with the inspection</div><p className="text-xs text-muted-foreground">A 20-point check surfaces faults so prep, pricing and the advert are accurate.</p></div>
        </div>
        <button className={cn(primaryBtn, "shrink-0")}>Start Inspection <ArrowRight className="size-3.5" /></button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- E: hybrid */
function VariationE() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-base font-semibold">Get this car sale-ready</div><p className="mt-0.5 text-sm text-muted-foreground">Nothing set up yet — follow the steps from the inspection onward.</p></div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">0 / 5</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className={cn("flex items-start gap-2.5 rounded-lg border p-3", i === 0 ? "border-primary/40 bg-primary/5" : "border-border")}>
              <StepIcon icon={s.icon} active={i === 0} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{s.title}</div>
                <p className="mb-2 text-2xs text-muted-foreground">{s.desc}</p>
                <button className={cn(i === 0 ? primaryBtn : "text-xs text-primary hover:underline")}>{i === 0 ? s.cta : s.cta}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2"><EmptyValuation /><EmptyLocation /></div>
    </div>
  );
}

/* ---------------------------------------------------------------- shared empty cards */
function EmptyValuation() {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between"><span className="text-sm font-semibold">AutoTrader Valuation</span><Sparkles className="size-4 text-muted-foreground" /></div>
      <div className="mt-3 grid place-items-center rounded-lg border border-dashed border-border py-6 text-center">
        <Sparkles className="size-6 text-muted-foreground/40" />
        <div className="mt-2 text-sm font-medium">No valuation yet</div>
        <p className="mt-0.5 max-w-[14rem] text-2xs text-muted-foreground">Pull live trade, part-ex and retail prices for this reg.</p>
        <button className={cn(ghostBtn, "mt-3")}><Sparkles className="size-3.5" /> Run valuation</button>
      </div>
    </div>
  );
}
function EmptyLocation() {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><span className="text-sm font-semibold">Location</span></div>
      <div className="mt-2 text-sm">Currently at: <span className="font-medium">Forecourt</span></div>
      <div className="text-2xs text-muted-foreground">Since today · no movements yet</div>
    </div>
  );
}
