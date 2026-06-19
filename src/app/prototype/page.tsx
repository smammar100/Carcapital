"use client";

import { useState } from "react";
import {
  MapPin,
  Search,
  Download,
  MoveRight,
  Warehouse,
  ParkingSquare,
  Wrench,
  UserRound,
  Clock,
  ArrowRight,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RegPlate } from "@/components/shared/reg-plate";

/**
 * /prototype — design comparison surface (auth-free).
 *
 * Current feature: LOCATIONS (/admin/locations). 5 variations stacked
 * vertically. Mock data mirrors the real page (stock id, reg, make/model,
 * status, days here, off-site context, Move action). References (Mobbin, web):
 *   A — Deel "Assets": summary stats + location distribution bar + table.
 *   B — Asana dashboard: location metric cards act as the active filter.
 *   C — ClickUp / Programa board: one column per location, cars as cards.
 *   D — Neon / StackAI: split master–detail, location rail + detail table.
 *   E — Shopify / Uvodo: minimal segmented control + refined list rows.
 */

type Loc = "forecourt" | "yard" | "garage" | "staff";
type Status = "listed" | "reserved" | "being_prepared" | "ready" | "sold";

const LOC_META: Record<
  Loc,
  { label: string; icon: LucideIcon; tint: string; dot: string; offsite: boolean }
> = {
  forecourt: {
    label: "Forecourt",
    icon: Warehouse,
    tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    offsite: false,
  },
  yard: {
    label: "Yard",
    icon: ParkingSquare,
    tint: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    dot: "bg-sky-500",
    offsite: false,
  },
  garage: {
    label: "Garage",
    icon: Wrench,
    tint: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
    offsite: true,
  },
  staff: {
    label: "Staff",
    icon: UserRound,
    tint: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
    offsite: true,
  },
};

const STATUS_TONE: Record<Status, string> = {
  listed: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  reserved: "bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300",
  being_prepared:
    "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
  ready: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
  sold: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};
const STATUS_LABEL: Record<Status, string> = {
  listed: "Listed",
  reserved: "Reserved",
  being_prepared: "Being Prepared",
  ready: "Ready",
  sold: "Sold",
};

type Row = {
  id: string;
  stockId: string;
  reg: string;
  make: string;
  model: string;
  status: Status;
  loc: Loc;
  days: string;
  context?: string; // workshop / staff name for off-site
};

const ROWS: Row[] = [
  { id: "1", stockId: "CC-0004", reg: "SA17WUV", make: "Audi", model: "A3", status: "listed", loc: "forecourt", days: "14w 5d" },
  { id: "2", stockId: "CC-0013", reg: "LG68OCH", make: "BMW", model: "3 Series", status: "listed", loc: "forecourt", days: "15w 6d" },
  { id: "3", stockId: "CC-0017", reg: "MT67RLZ", make: "BMW", model: "X1", status: "ready", loc: "forecourt", days: "16w 3d" },
  { id: "4", stockId: "CC-0022", reg: "R500HNT", make: "Fiat", model: "500", status: "reserved", loc: "forecourt", days: "8w 3d" },
  { id: "5", stockId: "CC-0041", reg: "SL68NYZ", make: "Land Rover", model: "RR Evoque", status: "being_prepared", loc: "yard", days: "3w 1d" },
  { id: "6", stockId: "CC-0042", reg: "YF16CUY", make: "Land Rover", model: "RR Evoque", status: "ready", loc: "yard", days: "5d" },
  { id: "7", stockId: "CC-0049", reg: "LW15JGV", make: "Mercedes-Benz", model: "B-Class", status: "being_prepared", loc: "garage", days: "12d", context: "Premier Bodyworks" },
  { id: "8", stockId: "CC-0054", reg: "EX68EYK", make: "Mercedes-Benz", model: "CLA", status: "reserved", loc: "staff", days: "2d", context: "Sikander Ali" },
];

const COUNTS: Record<Loc, number> = { forecourt: 108, yard: 2, garage: 0, staff: 2 };
const TOTAL = 112;
const LOCS: Loc[] = ["forecourt", "yard", "garage", "staff"];

export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Prototype — Locations · 5 variations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a winner (A–E). Mock data; CarCap tokens + components +
          Mobbin-referenced layouts. Toggle OS dark mode to preview both themes.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        <Frame label="A — Overview + distribution bar + table" sub="Deel Assets — summary stats, a 'where everything is' bar, then a filterable table">
          <VariationA />
        </Frame>
        <Frame label="B — Location metric cards as filters" sub="Asana dashboard — big count cards double as the active-location selector">
          <VariationB />
        </Frame>
        <Frame label="C — Board view (column per location)" sub="ClickUp / Programa — each location is a column, cars are draggable cards with a Move affordance">
          <VariationC />
        </Frame>
        <Frame label="D — Split master–detail" sub="Neon / StackAI — location rail on the left with counts + mini bar, detail table on the right">
          <VariationD />
        </Frame>
        <Frame label="E — Minimal segmented list" sub="Shopify / Uvodo — segmented control, prominent search, refined rows with reg plates">
          <VariationE />
        </Frame>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- chrome */

function Frame({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{label}</h2>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">{children}</div>
    </section>
  );
}

function PageHead({ trailing }: { trailing?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MapPin className="size-5" /> Locations
        </h3>
        <p className="text-sm text-muted-foreground">
          Every car has exactly one location.
        </p>
      </div>
      {trailing ?? (
        <span className="text-xs text-muted-foreground">{TOTAL} total active</span>
      )}
    </div>
  );
}

function StatusPill({ s }: { s: Status }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[s])}>
      {STATUS_LABEL[s]}
    </span>
  );
}

function LocChip({ loc }: { loc: Loc }) {
  const m = LOC_META[loc];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", m.tint)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} /> {m.label}
    </span>
  );
}

function MoveBtn({ ghost }: { ghost?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        ghost
          ? "text-muted-foreground hover:bg-muted hover:text-foreground"
          : "border border-border bg-background hover:bg-muted",
      )}
    >
      Move <MoveRight className="size-3.5" />
    </button>
  );
}

function SearchBox({ placeholder = "Search reg or stock ID…", w = "w-64" }: { placeholder?: string; w?: string }) {
  return (
    <div className={cn("relative", w)}>
      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <div className="flex h-9 items-center rounded-md border border-border bg-background pl-8 pr-3 text-sm text-muted-foreground">
        {placeholder}
      </div>
    </div>
  );
}

function ExportBtn() {
  return (
    <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted">
      <Download className="size-3.5" /> Export CSV
    </button>
  );
}

/* ---------- shared distribution bar ---------- */
function DistributionBar({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {LOCS.map((l) => {
          const pct = (COUNTS[l] / TOTAL) * 100;
          if (pct === 0) return null;
          return <span key={l} className={LOC_META[l].dot} style={{ width: `${pct}%` }} />;
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {LOCS.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", LOC_META[l].dot)} />
            {LOC_META[l].label}
            <span className="font-medium text-foreground tabular-nums">{COUNTS[l]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================ A · overview + distribution */

function VariationA() {
  const [active, setActive] = useState<Loc>("forecourt");
  const rows = ROWS.filter((r) => r.loc === active);
  return (
    <div>
      <PageHead />

      {/* summary stat row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LOCS.map((l) => {
          const m = LOC_META[l];
          const Icon = m.icon;
          return (
            <div key={l} className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", m.tint)}>
                <Icon className="size-4" />
              </span>
              <div>
                <div className="text-xs text-muted-foreground">{m.label}{m.offsite ? " · off-site" : ""}</div>
                <div className="text-lg font-semibold tabular-nums">{COUNTS[l]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* distribution overview */}
      <div className="mb-4 rounded-lg border border-border bg-background px-4 py-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Where everything is · {TOTAL} active</div>
        <DistributionBar />
      </div>

      {/* tab chips + table */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {LOCS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setActive(l)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
              active === l ? "border-foreground/30 bg-foreground/5 font-medium" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {LOC_META[l].label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{COUNTS[l]}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <SearchBox />
          <ExportBtn />
        </div>
      </div>

      <TableCard rows={rows} showContext={LOC_META[active].offsite} />
    </div>
  );
}

/* ============================================ B · metric cards as filters */

function VariationB() {
  const [active, setActive] = useState<Loc>("forecourt");
  const rows = ROWS.filter((r) => r.loc === active);
  return (
    <div>
      <PageHead />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {LOCS.map((l) => {
          const m = LOC_META[l];
          const Icon = m.icon;
          const on = active === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setActive(l)}
              className={cn(
                "group rounded-xl border bg-background p-4 text-left transition-all",
                on ? "border-foreground/40 ring-2 ring-foreground/10" : "border-border hover:border-foreground/20 hover:shadow-sm",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("grid size-9 place-items-center rounded-lg", m.tint)}>
                  <Icon className="size-4" />
                </span>
                {m.offsite && <span className={cn("size-2 rounded-full", m.dot)} title="Off-site" />}
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums">{COUNTS[l]}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">{m.label}</div>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <h4 className="text-sm font-semibold">{LOC_META[active].label}</h4>
        <span className="text-xs text-muted-foreground">{COUNTS[active]} cars</span>
        <div className="ml-auto flex items-center gap-2">
          <SearchBox w="w-56" />
          <ExportBtn />
        </div>
      </div>
      <TableCard rows={rows} showContext={LOC_META[active].offsite} />
    </div>
  );
}

/* ============================================ C · board view */

function VariationC() {
  return (
    <div>
      <PageHead
        trailing={
          <div className="flex items-center gap-2">
            <SearchBox w="w-56" />
            <ExportBtn />
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {LOCS.map((l) => {
          const m = LOC_META[l];
          const Icon = m.icon;
          const cards = ROWS.filter((r) => r.loc === l);
          return (
            <div key={l} className="flex flex-col rounded-xl border border-border bg-muted/30">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <span className={cn("grid size-6 place-items-center rounded-md", m.tint)}>
                  <Icon className="size-3.5" />
                </span>
                <span className="text-sm font-semibold">{m.label}</span>
                <span className="rounded-full bg-background px-1.5 text-xs font-medium tabular-nums text-muted-foreground">{COUNTS[l]}</span>
                {m.offsite && <span className={cn("ml-auto size-2 rounded-full", m.dot)} title="Off-site" />}
              </div>
              <div className="flex flex-col gap-2 p-2">
                {cards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs italic text-muted-foreground">
                    No cars here
                  </div>
                ) : (
                  cards.map((r) => (
                    <div key={r.id} className="group rounded-lg border border-border bg-card p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <RegPlate registration={r.reg} size="sm" />
                        <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                          <Clock className="size-3" />{r.days}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-medium leading-tight">{r.make} {r.model}</div>
                      <div className="text-xs text-muted-foreground">{r.stockId}</div>
                      {r.context && <div className="mt-1 text-xs text-muted-foreground">{r.context}</div>}
                      <div className="mt-2 flex items-center justify-between">
                        <StatusPill s={r.status} />
                        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100">
                          Move <ArrowRight className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <button type="button" className="inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:bg-background">
                  <Plus className="size-3.5" /> Move car here
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================ D · split master–detail */

function VariationD() {
  const [active, setActive] = useState<Loc>("forecourt");
  const rows = ROWS.filter((r) => r.loc === active);
  const m = LOC_META[active];
  return (
    <div>
      <PageHead />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        {/* rail */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Distribution</div>
            <DistributionBar />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            {LOCS.map((l) => {
              const lm = LOC_META[l];
              const Icon = lm.icon;
              const on = active === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setActive(l)}
                  className={cn(
                    "flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors",
                    on ? "border-foreground bg-muted/60" : "border-transparent hover:bg-muted/40",
                  )}
                >
                  <span className={cn("grid size-8 place-items-center rounded-lg", lm.tint)}>
                    <Icon className="size-4" />
                  </span>
                  <span className={cn("text-sm", on ? "font-semibold" : "font-medium")}>{lm.label}</span>
                  {lm.offsite && <span className={cn("size-1.5 rounded-full", lm.dot)} />}
                  <span className="ml-auto text-sm tabular-nums text-muted-foreground">{COUNTS[l]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* detail */}
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={cn("grid size-7 place-items-center rounded-lg", m.tint)}>
              <m.icon className="size-4" />
            </span>
            <h4 className="text-base font-semibold">{m.label}</h4>
            <span className="text-xs text-muted-foreground">{COUNTS[active]} cars</span>
            <div className="ml-auto flex items-center gap-2">
              <SearchBox w="w-52" />
              <ExportBtn />
            </div>
          </div>
          <TableCard rows={rows} showContext={m.offsite} />
        </div>
      </div>
    </div>
  );
}

/* ============================================ E · minimal segmented list */

function VariationE() {
  const [active, setActive] = useState<Loc>("forecourt");
  const rows = ROWS.filter((r) => r.loc === active);
  return (
    <div>
      <PageHead />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* segmented control */}
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          {LOCS.map((l) => {
            const on = active === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setActive(l)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  on ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {LOC_META[l].label}
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-muted" : "bg-background/60")}>{COUNTS[l]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <SearchBox w="w-56" />
          <ExportBtn />
        </div>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm italic text-muted-foreground">No cars at {LOC_META[active].label}.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
              <RegPlate registration={r.reg} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.make} {r.model}</div>
                <div className="text-xs text-muted-foreground">
                  {r.stockId}{r.context ? ` · ${r.context}` : ""}
                </div>
              </div>
              <StatusPill s={r.status} />
              <span className="inline-flex w-16 items-center justify-end gap-1 text-xs tabular-nums text-muted-foreground">
                <Clock className="size-3" />{r.days}
              </span>
              <MoveBtn ghost />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* ---------- shared table card (A / B / D) ---------- */

function TableCard({ rows, showContext }: { rows: Row[]; showContext: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Stock ID</th>
            <th className="px-3 py-2 text-left font-medium">Reg</th>
            <th className="px-3 py-2 text-left font-medium">Make / Model</th>
            {showContext && <th className="px-3 py-2 text-left font-medium">Workshop / Staff</th>}
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Days here</th>
            <th className="px-3 py-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showContext ? 7 : 6} className="px-3 py-8 text-center text-sm italic text-muted-foreground">
                No cars here.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t transition-colors hover:bg-muted/30">
                <td className="px-3 py-2.5 font-medium">{r.stockId}</td>
                <td className="px-3 py-2.5"><RegPlate registration={r.reg} size="sm" /></td>
                <td className="px-3 py-2.5">{r.make} {r.model}</td>
                {showContext && <td className="px-3 py-2.5 text-muted-foreground">{r.context ?? "—"}</td>}
                <td className="px-3 py-2.5"><StatusPill s={r.status} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.days}</td>
                <td className="px-3 py-2.5 text-right"><MoveBtn ghost /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
