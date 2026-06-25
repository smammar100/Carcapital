"use client";

/**
 * /prototype — auth-free design lab.
 *
 * 4 redesigns of the External-warranties "pending purchase" alert banner.
 * Variation A is the requested slim, bright-red, full-width top strip; B–D are
 * alternative treatments. Each is shown in the real External page context
 * (title, 4-colour KPI strip, filter chips, a few pending rows) so placement
 * and weight read correctly. Pick a winner (A–D).
 *
 * Built on the app's real tokens/primitives so the winner ports straight in.
 */

import * as React from "react";
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Search,
  Plus,
  ArrowRight,
} from "lucide-react";
import { RegPlate } from "@/components/shared/reg-plate";
import { cn } from "@/lib/utils";

/* ---- shared mock data (mirrors the live External page) ------------------ */

const KPIS = [
  { icon: ShieldCheck, label: "Active warranties", value: 12, hint: "7 in-house · 5 external", bar: "bg-blue-500", ic: "text-blue-600 dark:text-blue-400" },
  { icon: Clock, label: "Pending purchase", value: 3, hint: "Action needed", bar: "bg-amber-500", ic: "text-amber-600 dark:text-amber-400" },
  { icon: ShieldAlert, label: "Open claims", value: 2, hint: "Awaiting resolution", bar: "bg-red-500", ic: "text-red-600 dark:text-red-400" },
  { icon: AlertTriangle, label: "Expiring soon", value: 3, hint: "Active, ending within 30 days", bar: "bg-orange-500", ic: "text-orange-600 dark:text-orange-400" },
];

const FILTERS = [
  { label: "All", count: 5, active: false },
  { label: "Pending purchase", count: 3, active: true },
  { label: "Purchased", count: 2, active: false },
  { label: "Active", count: 5, active: false },
  { label: "Expired", count: 0, active: false },
];

const ROWS = [
  { reg: "WM21KCA", model: "JAGUAR E-PACE", customer: "David Singh", phone: "07700300022", provider: "RAC Warranty", coverage: "22 Apr 2026 → 22 Apr 2027", cost: "£250.00" },
  { reg: "LU17JHZ", model: "BMW 2 Series GRAN TOURER", customer: "Hannah Roberts", phone: "07700300021", provider: "AA Warranty", coverage: "13 Apr 2026 → 13 Apr 2027", cost: "£320.00" },
  { reg: "MV17HFJ", model: "AUDI Q2", customer: "Tom Williams", phone: "07700300020", provider: "Warranty First", coverage: "15 Feb 2026 → 15 Feb 2028", cost: "£280.00" },
];

/* ---- the four banner variations ----------------------------------------- */

// A — slim, bright-red, full-bleed strip pinned to the very top of the page.
function BannerA() {
  return (
    <div className="flex items-center gap-2.5 bg-red-600 px-5 py-2 text-sm text-white">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="font-semibold">3 external warranties pending purchase</span>
      <span className="hidden text-white/85 sm:inline">
        · £850.00 owed to providers · 3 overdue 60+ days
      </span>
      <button
        type="button"
        className="ml-auto inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition hover:bg-white/25"
      >
        View pending only <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// B — slim, bright-red, rounded inline bar (sits where the banner is today).
function BannerB() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm text-white shadow-sm">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="font-semibold">3 external warranties pending purchase</span>
      <span className="text-white/85">£850.00 owed · 3 overdue 60+ days</span>
      <button
        type="button"
        className="ml-auto rounded-md bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-white/90"
      >
        View pending only
      </button>
    </div>
  );
}

// C — light-red callout with a bright-red left accent bar (more substantial).
function BannerC() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-red-300 bg-red-50 py-3 pl-5 pr-4 dark:border-red-500/30 dark:bg-red-500/10">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-red-600" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              3 external warranties pending purchase
            </p>
            <p className="text-xs text-red-700/80 dark:text-red-300/80">
              £850.00 owed to providers · 3 overdue 60+ days
            </p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
        >
          View pending only
        </button>
      </div>
    </div>
  );
}

// D — bright-red ribbon with segmented stats split by hairline dividers.
function BannerD() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm text-white">
      <span className="inline-flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" /> Pending purchase
      </span>
      <span className="h-4 w-px bg-white/30" />
      <span><strong className="font-semibold">3</strong> warranties</span>
      <span className="h-4 w-px bg-white/30" />
      <span><strong className="font-semibold">£850.00</strong> owed</span>
      <span className="h-4 w-px bg-white/30" />
      <span><strong className="font-semibold">3</strong> overdue 60+ days</span>
      <button
        type="button"
        className="ml-auto rounded-md bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-white/90"
      >
        View pending only
      </button>
    </div>
  );
}

/* ---- External page chrome (so each banner reads in context) ------------- */

function ExternalPageMock({
  topStrip,
  inlineBanner,
}: {
  topStrip?: React.ReactNode;
  inlineBanner?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      {topStrip}
      <div className="flex flex-col gap-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">External Warranties</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Third-party warranties sold alongside vehicles. See which still need purchasing from the provider.
            </p>
          </div>
          <button type="button" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New warranty
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((k) => (
            <div key={k.label} className="relative flex flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-card p-4 pl-5">
              <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", k.bar)} />
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <k.icon className={cn("h-3.5 w-3.5", k.ic)} /> {k.label}
              </div>
              <div className="text-2xl font-semibold tabular-nums text-foreground">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.hint}</div>
            </div>
          ))}
        </div>

        {inlineBanner}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex divide-x divide-border overflow-hidden rounded-md border border-border">
            {FILTERS.map((f) => (
              <button key={f.label} type="button" className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition", f.active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50")}>
                {f.label}<span className={cn("text-xs tabular-nums", f.active ? "opacity-90" : "opacity-70")}>{f.count}</span>
              </button>
            ))}
          </div>
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Search customer, vehicle, provider…" className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Vehicle", "Customer", "Provider", "Coverage", "Purchase", "Cost", ""].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><RegPlate registration={r.reg} size="sm" /><span className="truncate text-xs text-muted-foreground">{r.model}</span></div></td>
                  <td className="px-4 py-3"><div className="text-foreground">{r.customer}</div><div className="text-xs tabular-nums text-muted-foreground">{r.phone}</div></td>
                  <td className="px-4 py-3"><span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{r.provider}</span></td>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">{r.coverage}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Pending Purchase</span></td>
                  <td className="px-4 py-3 text-sm tabular-nums text-foreground">{r.cost}</td>
                  <td className="px-4 py-3 text-right"><button type="button" className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Mark purchased</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Frame({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="rounded-md bg-foreground px-2 py-0.5 text-xs font-semibold text-background">{label}</span>
        <span className="text-sm font-medium text-muted-foreground">{name}</span>
      </div>
      {children}
    </section>
  );
}

export default function PrototypePage() {
  return (
    <main className="min-h-screen bg-muted/30 px-6 py-8 lg:px-10">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pending-purchase banner — 4 variations</h2>
          <p className="text-sm text-muted-foreground">Pick a winner (A–D). A is the slim bright-red top strip; B–D are alternatives. Toggle your theme to compare light &amp; dark.</p>
        </div>

        <Frame label="A" name="Slim bright-red top strip (full-width, pinned above the page)">
          <ExternalPageMock topStrip={<BannerA />} />
        </Frame>
        <Frame label="B" name="Slim bright-red inline bar (rounded, in current position)">
          <ExternalPageMock inlineBanner={<BannerB />} />
        </Frame>
        <Frame label="C" name="Light-red callout with bright-red left accent">
          <ExternalPageMock inlineBanner={<BannerC />} />
        </Frame>
        <Frame label="D" name="Bright-red segmented ribbon (stats split by dividers)">
          <ExternalPageMock inlineBanner={<BannerD />} />
        </Frame>
      </div>
    </main>
  );
}
