"use client";

import {
  Calendar,
  Car,
  Download,
  Filter,
  Hash,
  Palette,
  PoundSterling,
  Plus,
  Settings2,
  SlidersHorizontal,
  Tag,
  Type as TypeIcon,
  Upload,
  Group as GroupIcon,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /prototype — design comparison surface (auth-free).
 *
 * Current feature: MASTER SHEET (wide dense data grid). 5 variations stacked
 * vertically. Mock data. References (Mobbin): Clay / Linear (dense power grid),
 * Airtable (gridlines + row height + sum footer), Neon / Replit (filter-chip
 * query bar + pagination), Attio (sortable headers + aggregation footer),
 * Shopify / Glide (managed inventory + inline edit + frozen column).
 *
 * Every variation includes the shared <FilterBar/> so the filtering UX can be
 * compared across all five grid styles.
 */
export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Prototype — Master Sheet · 5 variations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a winner (A–E). Each shows the same filter bar (applied chips +
          add-condition builder) so you can compare filtering in every grid.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        <Frame label="A — Dense power grid" sub="Clay / Linear">
          <VariationA />
        </Frame>
        <Frame label="B — Airtable spreadsheet" sub="Airtable / Glide">
          <VariationB />
        </Frame>
        <Frame label="C — Query / filter-chip grid" sub="Neon / Replit">
          <VariationC />
        </Frame>
        <Frame label="D — Aggregation grid" sub="Attio">
          <VariationD />
        </Frame>
        <Frame label="E — Managed inventory" sub="Shopify / Glide">
          <VariationE />
        </Frame>
      </div>
    </div>
  );
}

function Frame({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-baseline justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      <div className="bg-card">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- mock data */

type Status = "Ready" | "Listed" | "Prep" | "Inspection" | "Photos";
const STATUS_VARIANT: Record<
  Status,
  "success" | "info" | "warning" | "highlight"
> = {
  Ready: "success",
  Listed: "info",
  Prep: "warning",
  Inspection: "highlight",
  Photos: "highlight",
};

interface Row {
  stock: string;
  reg: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  colour: string;
  mileage: number;
  body: string;
  price: number;
  days: number;
  status: Status;
}

const VEHICLES: Row[] = [
  { stock: "CC-0004", reg: "SA17 WUV", make: "Audi", model: "A3", variant: "1.4 TFSI CoD Sport Sportback 5dr S Tronic", year: 2017, colour: "Grey", mileage: 32900, body: "Hatchback", price: 12995, days: 41, status: "Ready" },
  { stock: "CC-0013", reg: "LG68 OCH", make: "BMW", model: "3 Series", variant: "2.0 318d Sport Saloon 4dr Auto", year: 2018, colour: "Blue", mileage: 68800, body: "Saloon", price: 15750, days: 22, status: "Listed" },
  { stock: "CC-0017", reg: "MT67 RLZ", make: "BMW", model: "X1", variant: "2.0 20i xLine SUV 5dr xDrive", year: 2017, colour: "Silver", mileage: 38500, body: "SUV", price: 16450, days: 63, status: "Prep" },
  { stock: "CC-0018", reg: "NA66 XGM", make: "BMW", model: "X5", variant: "2.0 40e M Sport SUV 5dr Plug-in Hybrid", year: 2016, colour: "Black", mileage: 73500, body: "SUV", price: 21995, days: 12, status: "Inspection" },
  { stock: "CC-0019", reg: "HV67 UPS", make: "Citroen", model: "Grand C4", variant: "1.6 BlueHDi Feel MPV 5dr EAT6", year: 2017, colour: "Blue", mileage: 42150, body: "MPV", price: 9450, days: 88, status: "Ready" },
  { stock: "CC-0022", reg: "RB00 HNT", make: "Fiat", model: "500", variant: "1.2 Lounge Hatchback 3dr Dualogic", year: 2023, colour: "Red", mileage: 62500, body: "Hatchback", price: 8995, days: 5, status: "Photos" },
  { stock: "CC-0023", reg: "WG18 FLB", make: "Ford", model: "EcoSport", variant: "1.0T EcoBoost Zetec SUV 5dr Auto", year: 2018, colour: "Silver", mileage: 51000, body: "SUV", price: 10995, days: 34, status: "Listed" },
];

const TYPE_ICON: Record<string, LucideIcon> = {
  text: TypeIcon,
  num: Hash,
  currency: PoundSterling,
  date: Calendar,
  status: Tag,
  colour: Palette,
  vehicle: Car,
};

const fmtNum = (n: number) => n.toLocaleString("en-GB");
const fmtGBP = (n: number) => `£${n.toLocaleString("en-GB")}`;

/* ------------------------------------------------------------- small pieces */

function StatusBadge({ status }: { status: Status }) {
  return <nord-badge variant={STATUS_VARIANT[status]}>{status}</nord-badge>;
}

function Dot({ status }: { status: Status }) {
  const color: Record<Status, string> = {
    Ready: "var(--n-color-status-success)",
    Listed: "var(--n-color-status-info)",
    Prep: "var(--n-color-status-warning)",
    Inspection: "var(--n-color-accent)",
    Photos: "var(--n-color-accent)",
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color[status] }}
      />
      {status}
    </span>
  );
}

function VehicleCell({ v }: { v: Row }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-11 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
        <Car className="h-4 w-4" />
      </span>
      <div className="leading-tight">
        <div className="font-mono text-[11px] font-semibold">{v.reg}</div>
        <div className="text-xs text-muted-foreground">
          {v.make} {v.model}
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  children,
  variant,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  variant?: "primary";
}) {
  return (
    <nord-button size="s" variant={variant}>
      <Icon slot="start" className="h-4 w-4" />
      {children}
    </nord-button>
  );
}

/* --------------------------------------------------------------- filter bar */

function FilterChip({
  label,
  op,
  value,
}: {
  label: string;
  op: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">{op}</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        className="ml-0.5 text-muted-foreground hover:text-foreground"
      >
        ✕
      </button>
    </span>
  );
}

/**
 * Shared filter UX shown on every variation: applied-filter chips + an open
 * "add condition" builder (Field · Operator · Value) using real Nord controls.
 */
function FilterBar() {
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Where</span>
        <FilterChip label="Make" op="is" value="Audi, BMW" />
        <FilterChip label="Year" op="≥" value="2017" />
        <FilterChip label="Status" op="is" value="Ready" />
        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
          Matches <span className="font-medium text-foreground">7</span> of 111
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-card p-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Plus className="h-3.5 w-3.5" /> Add filter
        </span>
        <div className="w-36">
          <nord-select size="s" hideLabel label="Field" expand suppressHydrationWarning>
            <option>Make</option>
            <option>Model</option>
            <option>Year</option>
            <option>Colour</option>
            <option>Mileage</option>
            <option>Body</option>
            <option>Price</option>
            <option>Days in stock</option>
            <option>Status</option>
          </nord-select>
        </div>
        <div className="w-32">
          <nord-select size="s" hideLabel label="Operator" expand suppressHydrationWarning>
            <option>is</option>
            <option>is not</option>
            <option>≥</option>
            <option>≤</option>
            <option>contains</option>
          </nord-select>
        </div>
        <div className="w-44">
          <nord-input
            size="s"
            hideLabel
            label="Value"
            placeholder="Value…"
            expand
            suppressHydrationWarning
          />
        </div>
        <nord-button size="s">Cancel</nord-button>
        <nord-button size="s" variant="primary">
          Add
        </nord-button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- A: dense power grid */
function VariationA() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">All vehicles</h2>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            111
          </span>
        </div>
        <div className="flex items-center gap-2">
          <nord-input
            type="search"
            hideLabel
            label="Search"
            size="s"
            placeholder="Search reg or stock…"
          />
          <ToolbarButton icon={Filter}>Filter</ToolbarButton>
          <ToolbarButton icon={Settings2}>Columns 44</ToolbarButton>
          <ToolbarButton icon={Download} variant="primary">
            Export CSV
          </ToolbarButton>
        </div>
      </div>
      <FilterBar />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse whitespace-nowrap text-xs">
          <thead className="sticky top-0 bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="w-9 px-3 py-2">
                <input type="checkbox" className="accent-[var(--n-color-accent)]" />
              </th>
              <th className="w-8 px-2 py-2 text-right font-medium">#</th>
              {[
                { l: "Stock ID", t: "text" },
                { l: "Vehicle", t: "vehicle" },
                { l: "Variant", t: "text" },
                { l: "Year", t: "num" },
                { l: "Colour", t: "colour" },
                { l: "Mileage", t: "num" },
                { l: "Body", t: "text" },
                { l: "Price", t: "currency" },
                { l: "Status", t: "status" },
              ].map((c) => {
                const Ic = TYPE_ICON[c.t];
                return (
                  <th key={c.l} className="px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Ic className="h-3 w-3 opacity-60" />
                      {c.l}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {VEHICLES.map((v, i) => (
              <tr
                key={v.stock}
                className="border-t border-border/60 hover:bg-accent/40"
              >
                <td className="px-3 py-1.5">
                  <input type="checkbox" className="accent-[var(--n-color-accent)]" />
                </td>
                <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">
                  {i + 1}
                </td>
                <td className="px-3 py-1.5 font-mono">{v.stock}</td>
                <td className="px-3 py-1.5">
                  <VehicleCell v={v} />
                </td>
                <td className="max-w-[240px] truncate px-3 py-1.5 text-muted-foreground">
                  {v.variant}
                </td>
                <td className="px-3 py-1.5 tabular-nums">{v.year}</td>
                <td className="px-3 py-1.5">{v.colour}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtNum(v.mileage)}
                </td>
                <td className="px-3 py-1.5">{v.body}</td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                  {fmtGBP(v.price)}
                </td>
                <td className="px-3 py-1.5">
                  <StatusBadge status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- B: airtable spreadsheet */
function VariationB() {
  const COLS = [
    { l: "Stock ID", t: "text", k: (v: Row) => v.stock, mono: true },
    { l: "Make", t: "text", k: (v: Row) => v.make },
    { l: "Model", t: "text", k: (v: Row) => v.model },
    { l: "Year", t: "num", k: (v: Row) => v.year },
    { l: "Colour", t: "colour", k: (v: Row) => v.colour },
    { l: "Mileage", t: "num", k: (v: Row) => fmtNum(v.mileage) },
    { l: "Body", t: "text", k: (v: Row) => v.body },
    { l: "Price", t: "currency", k: (v: Row) => fmtGBP(v.price) },
  ];
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2 text-xs">
        <ToolbarButton icon={Settings2}>Hide fields</ToolbarButton>
        <ToolbarButton icon={Filter}>Filter</ToolbarButton>
        <ToolbarButton icon={GroupIcon}>Group</ToolbarButton>
        <ToolbarButton icon={ArrowUpDown}>Sort</ToolbarButton>
        <ToolbarButton icon={Palette}>Color</ToolbarButton>
        <div className="ml-auto flex items-center gap-1.5">
          <ToolbarButton icon={SlidersHorizontal}>Row height</ToolbarButton>
          <ToolbarButton icon={Download} variant="primary">
            Export
          </ToolbarButton>
        </div>
      </div>
      <FilterBar />
      <div className="overflow-x-auto">
        <table className="border-collapse whitespace-nowrap text-xs [&_td]:border [&_td]:border-border/70 [&_th]:border [&_th]:border-border/70">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="w-9 px-2 py-1.5 text-right">#</th>
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-1.5 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Car className="h-3 w-3 opacity-60" /> Vehicle
                </span>
              </th>
              {COLS.map((c) => {
                const Ic = TYPE_ICON[c.t];
                return (
                  <th key={c.l} className="px-3 py-1.5 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Ic className="h-3 w-3 opacity-60" />
                      {c.l}
                    </span>
                  </th>
                );
              })}
              <th className="px-3 py-1.5 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="h-3 w-3 opacity-60" /> Status
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {VEHICLES.map((v, i) => (
              <tr key={v.stock} className="hover:bg-accent/30">
                <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">
                  {i + 1}
                </td>
                <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                  <span className="font-mono text-[11px] font-semibold">
                    {v.reg}
                  </span>
                </td>
                {COLS.map((c) => (
                  <td
                    key={c.l}
                    className={cn(
                      "px-3 py-1.5",
                      (c.t === "num" || c.t === "currency") &&
                        "text-right tabular-nums",
                      c.mono && "font-mono",
                    )}
                  >
                    {c.k(v)}
                  </td>
                ))}
                <td className="px-3 py-1.5">
                  <StatusBadge status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 text-muted-foreground">
              <td className="px-2 py-1.5" />
              <td className="sticky left-0 z-10 bg-muted/30 px-3 py-1.5 text-xs font-medium">
                111 records
              </td>
              <td className="px-3 py-1.5" colSpan={4} />
              <td className="px-3 py-1.5 text-right text-xs">
                Σ {fmtNum(VEHICLES.reduce((s, v) => s + v.mileage, 0))}
              </td>
              <td className="px-3 py-1.5" />
              <td className="px-3 py-1.5 text-right text-xs">
                Σ {fmtGBP(VEHICLES.reduce((s, v) => s + v.price, 0))}
              </td>
              <td className="px-3 py-1.5" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- C: query / filter-chip grid */
function VariationC() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">All vehicles</h2>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            111
          </span>
        </div>
        <div className="flex items-center gap-2">
          <nord-input
            type="search"
            hideLabel
            label="Search"
            size="s"
            placeholder="Search reg or stock…"
          />
          <ToolbarButton icon={Download} variant="primary">
            Export
          </ToolbarButton>
        </div>
      </div>
      <FilterBar />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse whitespace-nowrap text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              {[
                ["Stock ID", "text"],
                ["Vehicle", "vehicle"],
                ["Variant", "text"],
                ["Year", "integer"],
                ["Colour", "text"],
                ["Mileage", "integer"],
                ["Price", "numeric"],
                ["Status", "enum"],
              ].map(([l, t]) => (
                <th key={l} className="px-3 py-2">
                  <div className="font-medium text-foreground">{l}</div>
                  <div className="text-[10px] font-normal lowercase opacity-60">
                    {t}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VEHICLES.map((v) => (
              <tr
                key={v.stock}
                className="border-t border-border/60 hover:bg-accent/40"
              >
                <td className="px-3 py-2 font-mono">{v.stock}</td>
                <td className="px-3 py-2">
                  <VehicleCell v={v} />
                </td>
                <td className="max-w-[260px] truncate px-3 py-2 text-muted-foreground">
                  {v.variant}
                </td>
                <td className="px-3 py-2 tabular-nums">{v.year}</td>
                <td className="px-3 py-2">{v.colour}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(v.mileage)}</td>
                <td className="px-3 py-2 font-medium tabular-nums">
                  {fmtGBP(v.price)}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">1–7</span> of 111
        </span>
        <div className="flex items-center gap-2">
          <span>Rows per page 50</span>
          <nord-button size="s" disabled>
            <ChevronLeft slot="start" className="h-4 w-4" />
            Prev
          </nord-button>
          <nord-button size="s">
            Next
            <ChevronRight slot="end" className="h-4 w-4" />
          </nord-button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ D: aggregation grid */
function VariationD() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
        <ToolbarButton icon={ArrowUpDown}>Sort</ToolbarButton>
        <ToolbarButton icon={Filter}>Filter</ToolbarButton>
        <ToolbarButton icon={Settings2}>Columns</ToolbarButton>
        <div className="ml-auto flex items-center gap-1.5">
          <ToolbarButton icon={Upload}>Import</ToolbarButton>
          <ToolbarButton icon={Download} variant="primary">
            Export
          </ToolbarButton>
        </div>
      </div>
      <FilterBar />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse whitespace-nowrap text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              {[
                ["Stock ID", false],
                ["Vehicle", false],
                ["Year", true],
                ["Colour", false],
                ["Mileage", true],
                ["Body", false],
                ["Price", true],
                ["Days", true],
                ["Status", false],
              ].map(([l, sortable]) => (
                <th key={l as string} className="px-3 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {l}
                    {sortable && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VEHICLES.map((v) => (
              <tr
                key={v.stock}
                className="border-t border-border/60 hover:bg-accent/40"
              >
                <td className="px-3 py-2 font-mono">{v.stock}</td>
                <td className="px-3 py-2">
                  <VehicleCell v={v} />
                </td>
                <td className="px-3 py-2 tabular-nums">{v.year}</td>
                <td className="px-3 py-2">{v.colour}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtNum(v.mileage)}
                </td>
                <td className="px-3 py-2">{v.body}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {fmtGBP(v.price)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{v.days}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border bg-muted/40 font-medium">
            <tr>
              <td className="px-3 py-2">Count 111</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-muted-foreground tabular-nums">
                2016–2023
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right tabular-nums">
                avg {fmtNum(53000)}
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right tabular-nums">
                Σ {fmtGBP(1418500)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">avg 38</td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- E: managed inventory */
function VariationE() {
  const TABS = ["All 111", "Ready 18", "Listed 41", "Sold 23"];
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 pt-2">
        <div className="flex items-end gap-1">
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              className={cn(
                "border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                i === 0
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pb-1.5">
          <ToolbarButton icon={Upload}>Import</ToolbarButton>
          <ToolbarButton icon={Download}>Export</ToolbarButton>
        </div>
      </div>
      <FilterBar />

      {/* bulk action bar (demo: 3 selected) */}
      <div className="flex items-center gap-3 border-b border-border bg-accent/40 px-4 py-2 text-xs">
        <span className="font-medium">3 selected</span>
        <nord-button size="s">Change status</nord-button>
        <nord-button size="s">Move location</nord-button>
        <nord-button size="s" variant="danger">
          Remove
        </nord-button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse whitespace-nowrap text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-9 px-3 py-2.5">
                <input type="checkbox" className="accent-[var(--n-color-accent)]" />
              </th>
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 font-medium">
                Vehicle
              </th>
              <th className="px-3 py-2.5 font-medium">Year</th>
              <th className="px-3 py-2.5 font-medium">Mileage</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Price (editable)</th>
            </tr>
          </thead>
          <tbody>
            {VEHICLES.map((v, i) => (
              <tr
                key={v.stock}
                className="border-t border-border/60 hover:bg-accent/30"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    defaultChecked={i < 3}
                    className="accent-[var(--n-color-accent)]"
                  />
                </td>
                <td className="sticky left-0 z-10 bg-card px-3 py-2">
                  <VehicleCell v={v} />
                </td>
                <td className="px-3 py-2 tabular-nums">{v.year}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(v.mileage)}</td>
                <td className="px-3 py-2">
                  <Dot status={v.status} />
                </td>
                <td className="px-3 py-2">
                  <div className="ml-auto w-32">
                    <nord-input
                      size="s"
                      hideLabel
                      label="Price"
                      value={String(v.price)}
                      expand
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
