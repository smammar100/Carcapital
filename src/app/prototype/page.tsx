"use client";

import { useState } from "react";
import {
  LayoutGrid,
  FileText,
  MapPin,
  Coins,
  ListChecks,
  ShieldCheck,
  Camera,
  Megaphone,
  CalendarDays,
  Activity,
  ChevronLeft,
  PanelLeftClose,
  Gauge,
  Warehouse,
  Receipt,
  Users,
  Wrench,
  PoundSterling,
  Clock,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { RegPlate } from "@/components/shared/reg-plate";
import { KpiCard, Pill } from "@/components/vehicle-detail/primitives";

/**
 * /prototype — Vehicle Detail LEFT-TAB options, designed to coexist with the
 * app's existing main left navbar (so the page can show TWO left rails).
 * Refs (Mobbin): Qatalog / GitBook (grouped secondary nav), Zendesk / Circle
 * (secondary rail + back), Mailchimp (collapsible groups), Revolut (panel).
 */

const V = { reg: "EK18 FUT", title: "2023 Ford Fiesta", variant: "ST-Line", stockId: "CC-0118", status: "Received" };

type CheckState = "warn" | "miss";
type Tab = { key: string; label: string; icon: LucideIcon; badge?: string; dot?: CheckState };
const TABS: Tab[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "details", label: "Details", icon: FileText },
  { key: "location", label: "Location", icon: MapPin },
  { key: "financials", label: "Financials", icon: Coins },
  { key: "todo", label: "Things to Do", icon: ListChecks, badge: "3" },
  { key: "inspection", label: "Inspection", icon: ShieldCheck, dot: "warn" },
  { key: "photos", label: "Photos", icon: Camera, badge: "0", dot: "miss" },
  { key: "listing", label: "Listing", icon: Megaphone, dot: "miss" },
  { key: "appointments", label: "Appointments", icon: CalendarDays, badge: "2" },
  { key: "activity", label: "Activity", icon: Activity },
];
const GROUPS: { label: string; keys: string[] }[] = [
  { label: "Vehicle", keys: ["overview", "details", "location"] },
  { label: "Commercial", keys: ["financials", "listing"] },
  { label: "Operations", keys: ["todo", "inspection", "photos", "appointments"] },
  { label: "History", keys: ["activity"] },
];
const DOT: Record<CheckState, string> = { warn: "bg-amber-500", miss: "bg-rose-500" };

/* ---- faux MAIN navbar (the existing app sidebar) ---- */
const MAIN = [
  { label: "Dashboard", icon: Gauge },
  { label: "Master Sheet", icon: FileText },
  { label: "Vehicles", icon: Warehouse, active: true },
  { label: "Locations", icon: MapPin },
  { label: "Invoicing", icon: Receipt },
  { label: "Vendors", icon: Users },
  { label: "Workshop", icon: Wrench },
];

function MainNav() {
  return (
    <div className="hidden w-[180px] shrink-0 flex-col gap-0.5 rounded-l-xl border-r border-border bg-background p-2 md:flex">
      <div className="mb-2 flex items-center gap-2 px-2 py-1">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-2xs font-bold text-primary-foreground">CC</span>
        <span className="text-sm font-semibold">Car Capital</span>
      </div>
      {MAIN.map((m) => (
        <div key={m.label} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm", m.active ? "bg-muted font-medium text-foreground" : "text-muted-foreground")}>
          <m.icon className="size-4 shrink-0" /> <span className="truncate">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- shared content stub (the active tab body) ---- */
function ContentStub({ pad = true }: { pad?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-4", pad && "p-5")}>
      <div className="flex flex-wrap items-center gap-3">
        <RegPlate registration={V.reg} size="md" />
        <div>
          <div className="text-base font-semibold leading-tight">{V.title}</div>
          <div className="text-xs text-muted-foreground">{V.variant} · {V.stockId}</div>
        </div>
        <Pill tone="info">{V.status}</Pill>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={PoundSterling} label="Web Price" value={formatCurrency(16995)} hint="Floor £14,500" />
        <KpiCard icon={Clock} label="Days in Stock" value={23} hint="£12 / day" />
        <KpiCard icon={TrendingUp} label="AT Retail" value={formatCurrency(17400)} hint="Within market" />
        <KpiCard icon={Coins} label="Net Profit" value={formatCurrency(2946)} hint="Margin scheme" />
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-sm font-semibold">Advert Completeness</div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full w-[43%] rounded-full bg-emerald-500" /></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          {["Make / Model", "Photos", "Description", "Pricing", "MOT", "Channels"].map((x) => (
            <div key={x} className="rounded-md border border-border px-2 py-1.5">{x}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex overflow-hidden rounded-xl border border-border bg-muted/20">{children}</div>;
}

/* ============================================================ page */

export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Prototype — Vehicle Detail left tabs (with the main navbar)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each option shows the existing <strong>main navbar</strong> (left) + the vehicle-detail
          tab rail beside it, so you can judge the two-rail balance. Pick L-A…L-E.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        <Frame label="L-A — Nested secondary rail" sub="Qatalog / GitBook — slim second column with a back link + vehicle context on top, then the tab list">
          <VariationA />
        </Frame>
        <Frame label="L-B — Grouped secondary rail" sub="GitBook / Qatalog — tabs grouped under section headers (Vehicle / Commercial / Operations / History) to tame the long list">
          <VariationB />
        </Frame>
        <Frame label="L-C — In-content tab card (single full-height rail)" sub="Avoids a 2nd full-height rail: tabs live as a sticky card INSIDE the content, so only the main navbar is a true rail">
          <VariationC />
        </Frame>
        <Frame label="L-D — Icon-only rail, expands on hover" sub="Zendesk-style — second rail is icon-only to save width next to the main nav; labels on hover/pin">
          <VariationD />
        </Frame>
        <Frame label="L-E — Context rail (recommended)" sub="Second rail leads with reg plate + photo + status + quick actions, then the tabs — turns the rail into a useful context panel, not just nav">
          <VariationE />
        </Frame>
      </div>
    </div>
  );
}

function Frame({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3"><h2 className="text-sm font-semibold">{label}</h2><p className="text-xs text-muted-foreground">{sub}</p></div>
      {children}
    </section>
  );
}

function TabBtn({ t, active, onClick }: { t: Tab; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
      <t.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="truncate">{t.label}</span>
      {t.badge && <span className={cn("ml-auto rounded-full px-1.5 text-2xs font-medium tabular-nums", active ? "bg-background" : "bg-muted text-muted-foreground")}>{t.badge}</span>}
      {t.dot && !t.badge && <span className={cn("ml-auto size-1.5 rounded-full", DOT[t.dot])} />}
    </button>
  );
}

/* ---------------------------------------------------------------- A */
function VariationA() {
  const [a, setA] = useState("overview");
  return (
    <PageFrame>
      <MainNav />
      <div className="w-[208px] shrink-0 border-r border-border bg-background/60 p-2">
        <button className="mb-2 flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Back to inventory</button>
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2">
          <RegPlate registration={V.reg} size="sm" />
          <div className="min-w-0"><div className="truncate text-xs font-semibold">{V.title}</div><div className="text-2xs text-muted-foreground">{V.stockId}</div></div>
        </div>
        <nav className="flex flex-col gap-0.5">{TABS.map((t) => <TabBtn key={t.key} t={t} active={a === t.key} onClick={() => setA(t.key)} />)}</nav>
      </div>
      <ContentStub />
    </PageFrame>
  );
}

/* ---------------------------------------------------------------- B */
function VariationB() {
  const [a, setA] = useState("overview");
  return (
    <PageFrame>
      <MainNav />
      <div className="w-[208px] shrink-0 border-r border-border bg-background/60 p-2">
        <button className="mb-2 flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Back to inventory</button>
        <nav className="flex flex-col gap-3">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <div className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
              <div className="flex flex-col gap-0.5">
                {g.keys.map((k) => { const t = TABS.find((x) => x.key === k)!; return <TabBtn key={k} t={t} active={a === k} onClick={() => setA(k)} />; })}
              </div>
            </div>
          ))}
        </nav>
      </div>
      <ContentStub />
    </PageFrame>
  );
}

/* ---------------------------------------------------------------- C */
function VariationC() {
  const [a, setA] = useState("overview");
  return (
    <PageFrame>
      <MainNav />
      {/* No 2nd full-height rail — tabs are a card inside the content */}
      <div className="flex min-w-0 flex-1 gap-4 p-5">
        <aside className="hidden w-[200px] shrink-0 lg:block">
          <div className="sticky top-4 rounded-xl border border-border bg-background p-2">
            <nav className="flex flex-col gap-0.5">{TABS.map((t) => <TabBtn key={t.key} t={t} active={a === t.key} onClick={() => setA(t.key)} />)}</nav>
          </div>
        </aside>
        <ContentStub pad={false} />
      </div>
    </PageFrame>
  );
}

/* ---------------------------------------------------------------- D */
function VariationD() {
  const [a, setA] = useState("overview");
  return (
    <PageFrame>
      <MainNav />
      <div className="group/rail w-[56px] shrink-0 overflow-hidden border-r border-border bg-background/60 p-2 transition-[width] duration-200 hover:w-[208px]">
        <div className="mb-2 flex h-7 items-center gap-1.5 px-1.5 text-muted-foreground">
          <PanelLeftClose className="size-4 shrink-0" />
          <span className="whitespace-nowrap text-2xs opacity-0 transition-opacity group-hover/rail:opacity-100">Sections</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {TABS.map((t) => {
            const on = a === t.key;
            return (
              <button key={t.key} onClick={() => setA(t.key)} title={t.label}
                className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm", on ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50")}>
                <span className="relative shrink-0">
                  <t.icon className={cn("size-4", on ? "text-primary" : "text-muted-foreground")} />
                  {t.dot && <span className={cn("absolute -right-0.5 -top-0.5 size-1.5 rounded-full", DOT[t.dot])} />}
                </span>
                <span className="truncate whitespace-nowrap opacity-0 transition-opacity group-hover/rail:opacity-100">{t.label}</span>
                {t.badge && <span className="ml-auto whitespace-nowrap rounded-full bg-muted px-1.5 text-2xs opacity-0 transition-opacity group-hover/rail:opacity-100">{t.badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>
      <ContentStub />
    </PageFrame>
  );
}

/* ---------------------------------------------------------------- E */
function VariationE() {
  const [a, setA] = useState("overview");
  return (
    <PageFrame>
      <MainNav />
      <div className="w-[230px] shrink-0 border-r border-border bg-background/60">
        {/* pinned context */}
        <div className="border-b border-border p-3">
          <button className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Inventory</button>
          <div className="grid h-24 w-full place-items-center rounded-lg bg-muted text-muted-foreground"><Camera className="size-5" /></div>
          <div className="mt-2 flex items-center gap-2"><RegPlate registration={V.reg} size="sm" /><Pill tone="info">{V.status}</Pill></div>
          <div className="mt-1 text-sm font-semibold leading-tight">{V.title}</div>
          <div className="text-2xs text-muted-foreground">{V.variant} · {V.stockId}</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button className="rounded-md border border-border bg-background px-2 py-1 text-2xs font-medium hover:bg-muted">Advert</button>
            <button className="rounded-md bg-primary px-2 py-1 text-2xs font-medium text-primary-foreground hover:bg-primary/90">Inspect</button>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">{TABS.map((t) => <TabBtn key={t.key} t={t} active={a === t.key} onClick={() => setA(t.key)} />)}</nav>
      </div>
      <ContentStub />
    </PageFrame>
  );
}
