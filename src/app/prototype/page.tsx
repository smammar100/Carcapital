"use client";

import { useState } from "react";
import {
  MapPin,
  Clock,
  ArrowRight,
  Warehouse,
  ParkingSquare,
  Wrench,
  UserRound,
  Map as MapIcon,
  CornerDownRight,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/vehicle-detail/primitives";

/**
 * /prototype — Vehicle Detail "Location" tab redesign. 5 progressively-better
 * variations. Refs (Mobbin): Instacart (status stepper), IKEA (two-col
 * timeline + map + actions), Hers / Fiverr (rich vertical timeline + track card).
 */

type Loc = "forecourt" | "yard" | "garage" | "staff";
const LOC: Record<Loc, { label: string; icon: LucideIcon; dot: string; tint: string; ring: string; offsite: boolean }> = {
  forecourt: { label: "Forecourt", icon: Warehouse, dot: "bg-emerald-500", tint: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", ring: "ring-emerald-200 dark:ring-emerald-900/40", offsite: false },
  yard: { label: "Yard", icon: ParkingSquare, dot: "bg-sky-500", tint: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", ring: "ring-sky-200 dark:ring-sky-900/40", offsite: false },
  garage: { label: "Garage", icon: Wrench, dot: "bg-rose-500", tint: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", ring: "ring-rose-200 dark:ring-rose-900/40", offsite: true },
  staff: { label: "Staff", icon: UserRound, dot: "bg-amber-500", tint: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", ring: "ring-amber-200 dark:ring-amber-900/40", offsite: true },
};
const LOCS: Loc[] = ["forecourt", "yard", "garage", "staff"];
const CURRENT: Loc = "forecourt";

type Ev = { id: string; to: Loc; from: Loc | null; when: string; actor: string; note?: string; context?: string; expected?: string; arrival?: boolean };
const EVENTS: Ev[] = [
  { id: "3", to: "forecourt", from: "garage", when: "2 May 2026 · 14:30", actor: "Raza", note: "Returned from bodywork — ready to sell" },
  { id: "2", to: "garage", from: "forecourt", when: "20 Apr 2026 · 09:10", actor: "Kami", context: "Premier Bodyworks", expected: "Expected back 30 Apr" },
  { id: "1", to: "forecourt", from: null, when: "8 Mar 2026 · 10:00", actor: "Abbas Bhai", arrival: true },
];

const primaryBtn = "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted";

/* ============================================================ page */

export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Prototype — Vehicle Detail “Location” tab · 5 variations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a winner (A–E). CarCap tokens + components, Mobbin-referenced (Instacart / IKEA / Hers). Toggle OS dark mode to preview both.</p>
      </header>
      <div className="flex flex-col gap-10">
        <Frame label="A — Current card + presence strip" sub="Hero + a 4-stop ‘where is it’ strip marking the current location; timeline beneath">
          <VariationA />
        </Frame>
        <Frame label="B — Two-column: map + timeline" sub="IKEA order — left current card with a map panel + stats + Move; right movement timeline">
          <VariationB />
        </Frame>
        <Frame label="C — Location tiles dashboard" sub="Four location tiles (current highlighted, off-site flagged) + a stat row, then the timeline">
          <VariationC />
        </Frame>
        <Frame label="D — Arrival-anchored timeline" sub="Hers — stat header + a rich vertical timeline that always starts at Arrival, so it’s never truly empty">
          <VariationD />
        </Frame>
        <Frame label="E — Hero + presence + timeline + quick move (recommended)" sub="Current card w/ map + stats + quick ‘move to’ chips, a presence strip, and an arrival-anchored timeline with provenance">
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

/* ---- shared bits ---- */

function CurrentHero({ withMap }: { withMap?: boolean }) {
  const m = LOC[CURRENT];
  const Icon = m.icon;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-4 ring-1", m.tint, m.ring)}>
      <div className="flex items-center gap-4">
        <span className="grid size-11 place-items-center rounded-full bg-background shadow-sm"><Icon className="size-5" /></span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{m.label}</span>
            <span className={cn("size-2 rounded-full", m.dot)} />
            {m.offsite && <span className="rounded-full bg-background/70 px-2 py-0.5 text-2xs font-medium">Off-site</span>}
          </div>
          <div className="text-xs text-muted-foreground">Since 8 Mar 2026 · 104 days · 2 movements on record</div>
        </div>
      </div>
      <button className={primaryBtn}>Move <ArrowRight className="size-3.5" /></button>
    </div>
  );
}

function PresenceStrip() {
  return (
    <div className="flex flex-wrap gap-2">
      {LOCS.map((l) => {
        const m = LOC[l];
        const on = l === CURRENT;
        const Icon = m.icon;
        return (
          <div key={l} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", on ? cn("border-transparent ring-1", m.tint, m.ring) : "border-border text-muted-foreground")}>
            <Icon className="size-4" />
            {m.label}
            {on && <span className="rounded-full bg-background/70 px-1.5 text-2xs font-medium">Here now</span>}
            {!on && m.offsite && <span className={cn("size-1.5 rounded-full", m.dot)} />}
          </div>
        );
      })}
    </div>
  );
}

function MapPanel({ className }: { className?: string }) {
  return (
    <div className={cn("relative grid place-items-center overflow-hidden rounded-xl border border-border bg-[radial-gradient(theme(colors.muted.DEFAULT)_1px,transparent_1px)] [background-size:16px_16px]", className)}>
      <div className="flex flex-col items-center gap-1 text-muted-foreground">
        <span className="grid size-10 place-items-center rounded-full bg-background shadow-sm ring-1 ring-border"><MapPin className="size-5 text-emerald-600" /></span>
        <span className="text-xs font-medium">Forecourt · On-site</span>
      </div>
    </div>
  );
}

function Timeline({ dense }: { dense?: boolean }) {
  return (
    <ol className="flex flex-col">
      {EVENTS.map((e, i) => {
        const m = LOC[e.to];
        const Icon = e.arrival ? MapPin : m.icon;
        const last = i === EVENTS.length - 1;
        return (
          <li key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("z-10 grid place-items-center rounded-full ring-4 ring-card", e.arrival ? "size-7 bg-foreground text-background" : "size-7", !e.arrival && m.tint)}>
                {e.arrival ? <CheckCircle2 className="size-4" /> : <Icon className="size-3.5" />}
              </span>
              {!last && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className={cn("flex-1", last ? "pb-0" : dense ? "pb-4" : "pb-5", "pt-0.5")}>
              <div className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-medium">
                  {e.arrival ? "Arrived in stock" : <>{LOC[e.from!].label} <ArrowRight className="inline size-3 align-baseline text-muted-foreground" /> {m.label}</>}
                </span>
                {LOC[e.to].offsite && !e.arrival && <Pill tone={e.to === "garage" ? "bad" : "warn"}>Off-site</Pill>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{e.when} · {e.actor}{e.context ? ` · ${e.context}` : ""}</div>
              {e.expected && <div className="mt-1 text-xs text-amber-600">{e.expected}</div>}
              {e.note && <div className="mt-1.5 rounded-md bg-muted/50 px-3 py-1.5 text-xs">{e.note}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatRow() {
  const stats = [
    { label: "Current", value: LOC[CURRENT].label },
    { label: "Days here", value: "104" },
    { label: "On / off-site", value: "On-site" },
    { label: "Total moves", value: "2" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-background px-4 py-3">
          <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function HistoryHeading() {
  return <h3 className="mb-3 text-sm font-medium">Movement history</h3>;
}

/* ---------------------------------------------------------------- A */
function VariationA() {
  return (
    <div className="flex flex-col gap-5">
      <CurrentHero />
      <PresenceStrip />
      <section><HistoryHeading /><Timeline /></section>
    </div>
  );
}

/* ---------------------------------------------------------------- B */
function VariationB() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-4">
        <MapPanel className="h-44" />
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-2"><span className="text-base font-semibold">Forecourt</span><span className="size-2 rounded-full bg-emerald-500" /></div>
          <div className="mt-0.5 text-xs text-muted-foreground">Since 8 Mar 2026 · 104 days</div>
          <div className="mt-3 flex gap-2"><button className={primaryBtn}>Move <ArrowRight className="size-3.5" /></button><button className={ghostBtn}>History</button></div>
        </div>
      </div>
      <section><HistoryHeading /><Timeline /></section>
    </div>
  );
}

/* ---------------------------------------------------------------- C */
function VariationC() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {LOCS.map((l) => {
          const m = LOC[l]; const on = l === CURRENT; const Icon = m.icon;
          return (
            <div key={l} className={cn("rounded-xl border bg-background p-4", on ? cn("ring-1", m.ring) : "border-border")}>
              <div className="flex items-center justify-between">
                <span className={cn("grid size-9 place-items-center rounded-lg", m.tint)}><Icon className="size-4" /></span>
                {m.offsite && <span className={cn("size-2 rounded-full", m.dot)} title="Off-site" />}
              </div>
              <div className="mt-3 text-sm font-semibold">{m.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{on ? "Here now · 104 days" : m.offsite ? "Off-site" : "On-site"}</div>
            </div>
          );
        })}
      </div>
      <StatRow />
      <section><HistoryHeading /><Timeline dense /></section>
    </div>
  );
}

/* ---------------------------------------------------------------- D */
function VariationD() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatRow />
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <HistoryHeading />
          <button className={primaryBtn}>Move <ArrowRight className="size-3.5" /></button>
        </div>
        <div className="rounded-xl border border-border bg-background p-5"><Timeline /></div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- E */
function VariationE() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 ring-1 ring-emerald-200 dark:ring-emerald-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-300"><Warehouse className="size-5" /></span>
              <div>
                <div className="flex items-center gap-2"><span className="text-base font-semibold">Forecourt</span><span className="size-2 rounded-full bg-emerald-500" /></div>
                <div className="text-xs text-muted-foreground">Since 8 Mar 2026 · 104 days · on-site</div>
              </div>
            </div>
            <button className={primaryBtn}>Move <ArrowRight className="size-3.5" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Quick move to</span>
            {LOCS.filter((l) => l !== CURRENT).map((l) => {
              const m = LOC[l]; const Icon = m.icon;
              return <button key={l} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"><Icon className="size-3.5" />{m.label}{m.offsite && <span className={cn("size-1.5 rounded-full", m.dot)} />}</button>;
            })}
          </div>
        </div>
        <MapPanel className="min-h-[140px]" />
      </div>
      <PresenceStrip />
      <section>
        <div className="mb-3 flex items-center gap-2"><HistoryHeading /><span className="text-xs text-muted-foreground">· 2 movements since arrival</span></div>
        <div className="rounded-xl border border-border bg-background p-5"><Timeline /></div>
        <p className="mt-2 flex items-center gap-1 text-2xs text-muted-foreground"><CornerDownRight className="size-3" /> Every move is logged with who, when, and where — used for off-site tracking & audits.</p>
      </section>
    </div>
  );
}
