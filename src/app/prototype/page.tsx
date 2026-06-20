"use client";

import {
  Car,
  Tag,
  Calendar,
  Palette,
  Gauge,
  Cog,
  Fuel,
  Hash,
  Truck,
  Users,
  ShieldCheck,
  KeyRound,
  Lock,
  FileText,
  Wrench,
  Leaf,
  BadgeCheck,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RegPlate } from "@/components/shared/reg-plate";
import { Pill } from "@/components/vehicle-detail/primitives";

/**
 * /prototype — Vehicle Detail "Details" tab redesign. 5 progressively-better
 * variations. Refs (Mobbin): HODINKEE watch-details (zebra spec table),
 * HODINKEE Omega (grouped category columns), Stripe (technical specs rows).
 */

const V = {
  reg: "SA17 WUV",
  makeModel: "Audi A3",
  variant: "1.4 TFSI CoD Sport Sportback 5dr Petrol S Tronic Euro 6 (s/s) (150 ps)",
  year: "2017",
  colour: "Grey",
  body: "Hatchback",
  fuel: "Petrol",
  transmission: "Automatic",
  engine: "—",
  mileage: "32,900 mi",
  stockId: "CC-0004",
  received: "08 Mar 2026",
  seller: "BCA Auction · 07700900000",
  source: "Auction (BCA Auction)",
  serviceHistory: "Partial",
  v5: "Yes",
  keys: "2",
  lockNut: "Present",
  motExpiry: "14 Dec 2026",
  motStatus: "Valid",
  taxStatus: "Untaxed",
  taxDue: "12 Dec 2025",
  co2: "114 g/km",
  euro: "—",
  wheelplan: "2 Axle Rigid Body",
  firstReg: "01 Mar 2017",
  lastV5c: "12 Feb 2023",
};

type Row = { label: string; value: string; icon?: LucideIcon; pill?: "good" | "warn" | "bad" };

const IDENTITY: Row[] = [
  { label: "Make / Model", value: V.makeModel, icon: Car },
  { label: "Variant", value: V.variant, icon: Tag },
  { label: "Year", value: V.year, icon: Calendar },
  { label: "Colour", value: V.colour, icon: Palette },
  { label: "Mileage", value: V.mileage, icon: Gauge },
  { label: "Engine", value: V.engine, icon: Cog },
  { label: "Body", value: V.body, icon: Car },
  { label: "Fuel", value: V.fuel, icon: Fuel },
  { label: "Transmission", value: V.transmission, icon: Cog },
];
const ACQUISITION: Row[] = [
  { label: "Stock ID", value: V.stockId, icon: Hash },
  { label: "Received", value: V.received, icon: Calendar },
  { label: "Seller", value: V.seller, icon: Users },
  { label: "Purchase Source", value: V.source, icon: Truck },
  { label: "Service History", value: V.serviceHistory, icon: Wrench },
];
const DOCS: Row[] = [
  { label: "V5 Received", value: V.v5, icon: FileText },
  { label: "Keys", value: V.keys, icon: KeyRound },
  { label: "Lock Nut", value: V.lockNut, icon: Lock },
  { label: "MOT Expiry", value: V.motExpiry, icon: CalendarClock },
];
const COMPLIANCE: Row[] = [
  { label: "MOT Status", value: V.motStatus, icon: ShieldCheck, pill: "good" },
  { label: "Tax Status", value: V.taxStatus, icon: BadgeCheck, pill: "warn" },
  { label: "Tax Due", value: V.taxDue, icon: CalendarClock },
  { label: "CO₂ Emissions", value: V.co2, icon: Leaf },
  { label: "Euro Status", value: V.euro, icon: Leaf },
  { label: "Wheelplan", value: V.wheelplan, icon: Car },
  { label: "First Registered", value: V.firstReg, icon: Calendar },
  { label: "Last V5C Issued", value: V.lastV5c, icon: FileText },
];

/* ============================================================ page */

export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Prototype — Vehicle Detail “Details” tab · 5 variations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a winner (A–E). CarCap tokens + components, Mobbin-referenced (HODINKEE / Stripe spec sheets). Toggle OS dark mode to preview both.
        </p>
      </header>
      <div className="flex flex-col gap-10">
        <Frame label="A — Zebra spec tables" sub="HODINKEE watch details — tidy striped key/value rows; smallest jump from today">
          <VariationA />
        </Frame>
        <Frame label="B — Grouped category columns" sub="HODINKEE Omega — a category rail on the left, attributes in columns; editorial + dense">
          <VariationB />
        </Frame>
        <Frame label="C — Icon-led definition cards" sub="Stripe specs — each attribute is an icon + label + value tile; compliance carries status pills">
          <VariationC />
        </Frame>
        <Frame label="D — Identity hero + grouped sections" sub="Adds hierarchy: a reg/identity strip on top, then compact grouped cards with status pills">
          <VariationD />
        </Frame>
        <Frame label="E — Hero + spec sheet + status-forward compliance (recommended)" sub="Hero strip · grouped spec rails · compliance as a colour-coded status panel · DVLA/AutoTrader provenance footer">
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
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function ValuePill({ row }: { row: Row }) {
  if (row.pill) return <Pill tone={row.pill}>{row.value}</Pill>;
  return <span className="text-sm tabular-nums">{row.value}</span>;
}

/* ---------------------------------------------------------------- A */
function ZebraTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={cn(i % 2 === 1 && "bg-muted/40")}>
              <th scope="row" className="w-2/5 px-4 py-2.5 text-left align-top font-medium text-muted-foreground">{r.label}</th>
              <td className="px-4 py-2.5"><ValuePill row={r} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function VariationA() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div><SectionLabel>Vehicle Details</SectionLabel><ZebraTable rows={[...IDENTITY, ...ACQUISITION, ...DOCS]} /></div>
      <div><SectionLabel>Registration & Compliance</SectionLabel><ZebraTable rows={COMPLIANCE} /></div>
    </div>
  );
}

/* ---------------------------------------------------------------- B */
function GroupBlock({ label, rows, cols = 3 }: { label: string; rows: Row[]; cols?: number }) {
  return (
    <div className="grid gap-4 border-t border-border py-5 first:border-t-0 first:pt-0 md:grid-cols-[140px_1fr]">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("grid gap-x-8 gap-y-4 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
        {rows.map((r) => (
          <div key={r.label}>
            <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</div>
            <div className="mt-1"><ValuePill row={r} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
function VariationB() {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <GroupBlock label="Identity" rows={IDENTITY} />
      <GroupBlock label="Acquisition" rows={ACQUISITION} />
      <GroupBlock label="Documentation" rows={DOCS} />
      <GroupBlock label="Compliance" rows={COMPLIANCE} />
    </div>
  );
}

/* ---------------------------------------------------------------- C */
function IconTile({ r }: { r: Row }) {
  const Icon = r.icon ?? Car;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span>
      <div className="min-w-0">
        <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</div>
        <div className="mt-0.5 truncate text-sm"><ValuePill row={r} /></div>
      </div>
    </div>
  );
}
function VariationC() {
  return (
    <div className="flex flex-col gap-6">
      <div><SectionLabel>Vehicle Details</SectionLabel>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{[...IDENTITY, ...ACQUISITION, ...DOCS].map((r) => <IconTile key={r.label} r={r} />)}</div>
      </div>
      <div><SectionLabel>Registration & Compliance</SectionLabel>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">{COMPLIANCE.map((r) => <IconTile key={r.label} r={r} />)}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- D + E shared hero */
function IdentityHero({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-4", !compact && "sm:p-5")}>
      <div className="flex items-center gap-3">
        <RegPlate registration={V.reg} size="lg" />
        <div>
          <div className="text-lg font-semibold leading-tight">{V.year} {V.makeModel}</div>
          <div className="max-w-md text-xs text-muted-foreground">{V.variant}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="neutral">{V.stockId}</Pill>
        <Pill tone="neutral">{V.mileage}</Pill>
        <Pill tone="neutral">{V.fuel}</Pill>
        <Pill tone="neutral">{V.transmission}</Pill>
        <Pill tone="neutral">{V.colour}</Pill>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- D */
function MiniCard({ title, icon: Icon, rows }: { title: string; icon: LucideIcon; rows: Row[] }) {
  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Icon className="size-4 text-muted-foreground" /><span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <span className="text-right text-sm"><ValuePill row={r} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}
function VariationD() {
  return (
    <div className="flex flex-col gap-4">
      <IdentityHero />
      <div className="grid gap-4 lg:grid-cols-2">
        <MiniCard title="Identity" icon={Car} rows={IDENTITY} />
        <MiniCard title="Acquisition" icon={Truck} rows={ACQUISITION} />
        <MiniCard title="Documentation" icon={FileText} rows={DOCS} />
        <MiniCard title="Registration & Compliance" icon={ShieldCheck} rows={COMPLIANCE} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- E */
function SpecRail({ label, rows }: { label: string; rows: Row[] }) {
  return (
    <div className="grid gap-3 border-t border-border py-4 first:border-t-0 first:pt-0 md:grid-cols-[120px_1fr]">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/70 pb-1.5">
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <span className="text-right text-sm"><ValuePill row={r} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}
function ComplianceStatus() {
  const tone = (p?: "good" | "warn" | "bad") => p ?? ("neutral" as const);
  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-muted-foreground" /> Registration & Compliance</span>
        <span className="text-2xs text-muted-foreground">via DVLA + DVSA</span>
      </div>
      {/* status row */}
      <div className="grid grid-cols-2 gap-3 border-b border-border p-4 sm:grid-cols-4">
        {[
          { k: "MOT", v: V.motStatus, p: "good" as const },
          { k: "Tax", v: V.taxStatus, p: "warn" as const },
          { k: "CO₂", v: V.co2, p: undefined },
          { k: "Euro", v: V.euro, p: undefined },
        ].map((s) => (
          <div key={s.k} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{s.k}</div>
            <div className="mt-1"><Pill tone={tone(s.p)}>{s.v}</Pill></div>
          </div>
        ))}
      </div>
      <div className="grid gap-x-8 gap-y-3 p-4 sm:grid-cols-2">
        {[
          ["Tax Due", V.taxDue], ["Wheelplan", V.wheelplan],
          ["First Registered", V.firstReg], ["Last V5C Issued", V.lastV5c],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/70 pb-1.5">
            <span className="text-xs text-muted-foreground">{k}</span><span className="text-sm tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function VariationE() {
  return (
    <div className="flex flex-col gap-4">
      <IdentityHero />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-background p-5">
          <SpecRail label="Identity" rows={IDENTITY} />
          <SpecRail label="Acquisition" rows={ACQUISITION} />
          <SpecRail label="Documents" rows={DOCS} />
        </div>
        <ComplianceStatus />
      </div>
      <p className="text-2xs text-muted-foreground">Spec captured at intake from DVLA + AutoTrader · last verified 19 Jun 2026.</p>
    </div>
  );
}
