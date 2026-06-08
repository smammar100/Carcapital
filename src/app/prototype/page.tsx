"use client";

import { cn } from "@/lib/utils";

/**
 * /prototype — design comparison surface (auth-free).
 *
 * Current feature: DASHBOARD. 5 variations stacked vertically. Mock data only —
 * pure design comparison. References (Mobbin): Base44 / Shopify (KPI overview),
 * StackAI / Navattic / Whop (stats + sparklines), Adaline / Lovable (sidebar
 * rail), bento grids. See the `prototype` skill.
 */
export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Prototype — Dashboard · 5 variations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a winner (A–E). Mock data; real Nord components +
          Mobbin-referenced layouts. Toggle OS dark mode to preview both themes.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        <Frame label="A — Classic ops overview" sub="Base44 / Shopify">
          <VariationA />
        </Frame>
        <Frame label="B — Stats with sparklines" sub="StackAI / Navattic / Whop">
          <VariationB />
        </Frame>
        <Frame label="C — Bento grid" sub="modern bento dashboard">
          <VariationC />
        </Frame>
        <Frame label="D — Sidebar-stat layout" sub="Adaline / Lovable">
          <VariationD />
        </Frame>
        <Frame label="E — Table-first console" sub="operational, table-led">
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
      <div className="bg-background">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- mock data */

const KPIS = [
  { label: "Cars in stock", value: "107", delta: "+4", up: true },
  { label: "In readiness", value: "18", delta: "+6", up: true },
  { label: "Sold this month", value: "23", delta: "+12%", up: true },
  { label: "New leads (24h)", value: "9", delta: "+3", up: true },
  { label: "Open claims", value: "2", delta: "-1", up: true },
  { label: "Avg days in stock", value: "34d", delta: "-5%", up: true },
];

type Stage = "New lead" | "Test drive" | "Offer made" | "Completed" | "Lost";
const STAGE_VARIANT: Record<
  Stage,
  "info" | "warning" | "success" | "neutral" | "danger"
> = {
  "New lead": "info",
  "Test drive": "warning",
  "Offer made": "warning",
  Completed: "success",
  Lost: "neutral",
};
const DEALS: {
  reg: string;
  stock: string;
  car: string;
  customer: string;
  stage: Stage;
  total: string;
  date: string;
}[] = [
  { reg: "LU17 JHZ", stock: "CC-0012", car: "Audi A3", customer: "Aisha Khan", stage: "New lead", total: "—", date: "01 Jun" },
  { reg: "LX18 FTN", stock: "CC-0001", car: "Audi A1", customer: "James Wilson", stage: "Test drive", total: "—", date: "31 May" },
  { reg: "BW17 NLL", stock: "CC-0009", car: "BMW 1 Series", customer: "Mary Johnson", stage: "Completed", total: "£3,300", date: "16 May" },
  { reg: "LM16 RUH", stock: "CC-0002", car: "VW Golf", customer: "Anna Edwards", stage: "Offer made", total: "£12,800", date: "29 Apr" },
  { reg: "KF67 ATZ", stock: "CC-0010", car: "Ford Focus", customer: "Peter Hill", stage: "Completed", total: "£2,175", date: "26 Apr" },
  { reg: "LB64 ZHM", stock: "CC-0006", car: "Mini Cooper", customer: "Charlotte Reed", stage: "Lost", total: "£36,000", date: "23 Apr" },
];

const TASKS = [
  { label: "Cars to prep for forecourt", count: 9 },
  { label: "Inspections pending", count: 3 },
  { label: "Vehicle returns to review", count: 1 },
  { label: "Adverts awaiting photos", count: 5 },
];

/* ------------------------------------------------------------- mini pieces */

function Sparkline({ up = true, className }: { up?: boolean; className?: string }) {
  const points = up
    ? "0,30 18,26 36,27 54,18 72,21 90,9 108,6"
    : "0,8 18,12 36,10 54,18 72,15 90,24 108,28";
  const fill = up
    ? "0,30 18,26 36,27 54,18 72,21 90,9 108,6 108,32 0,32"
    : "0,8 18,12 36,10 54,18 72,15 90,24 108,28 108,32 0,32";
  return (
    <svg
      viewBox="0 0 108 32"
      preserveAspectRatio="none"
      className={cn("h-9 w-full", className)}
      aria-hidden="true"
    >
      <polygon points={fill} fill="var(--n-color-accent)" opacity="0.08" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--n-color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function PageHead({ compact }: { compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2
          className={cn(
            "font-semibold tracking-tight",
            compact ? "text-lg" : "text-2xl",
          )}
        >
          Welcome back, Abbas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Today you have <span className="font-medium text-foreground">9 cars</span> to
          prep and <span className="font-medium text-foreground">1 return</span> pending.
        </p>
      </div>
      <div className="flex gap-2">
        <nord-button>
          <nord-icon slot="start" name="interface-download" />
          Export
        </nord-button>
        <nord-button variant="primary">
          <nord-icon slot="start" name="interface-add-small" />
          Add vehicle
        </nord-button>
      </div>
    </div>
  );
}

function StageBadge({ stage }: { stage: Stage }) {
  return <nord-badge variant={STAGE_VARIANT[stage]}>{stage}</nord-badge>;
}

function DealsTable({ rows = DEALS }: { rows?: typeof DEALS }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Vehicle</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-right font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr
              key={d.stock}
              className="border-b border-border/60 last:border-0 hover:bg-accent/40"
            >
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-12 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                    <nord-icon name="generic-truck" size="s" />
                  </span>
                  <div className="leading-tight">
                    <div className="font-mono text-xs font-semibold">{d.reg}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.stock} · {d.car}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">{d.customer}</td>
              <td className="px-3 py-2.5">
                <StageBadge stage={d.stage} />
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{d.total}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                {d.date}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TasksCard() {
  return (
    <nord-card padding="none">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Today</h3>
      </div>
      <ul className="divide-y divide-border">
        {TASKS.map((t) => (
          <li
            key={t.label}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="text-muted-foreground">{t.label}</span>
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {t.count}
            </span>
          </li>
        ))}
      </ul>
    </nord-card>
  );
}

function CardHead({
  title,
  count,
  action = true,
}: {
  title: string;
  count?: number;
  action?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {count != null && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {action && (
        <a href="#" className="text-xs text-link hover:underline">
          View all
        </a>
      )}
    </div>
  );
}

/** Div card matching the Nord surface — used in the bento so we control height
 *  and centering precisely (mirrors the app's real ui/Card). */
function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

const APPTS = [
  { date: "Mon 8", time: "10:00", who: "James Wilson", what: "Test drive · Audi A1" },
  { date: "Mon 8", time: "14:30", who: "Sofia Rossi", what: "Handover · VW Golf" },
  { date: "Tue 9", time: "11:15", who: "Mark Lee", what: "Viewing · BMW 1 Series" },
  { date: "Wed 10", time: "09:30", who: "Priya Shah", what: "Collection · Ford Focus" },
];

const STOCK_SEGMENTS = [
  { label: "Ready to sell", value: 18, color: "var(--n-color-status-success)" },
  { label: "In preparation", value: 41, color: "var(--n-color-status-warning)" },
  { label: "Awaiting inspection", value: 31, color: "var(--n-color-status-info)" },
  { label: "In workshop", value: 17, color: "var(--n-color-accent)" },
];

function Donut() {
  const total = STOCK_SEGMENTS.reduce((s, x) => s + x.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex h-full w-full items-center gap-6">
      <div className="relative flex aspect-square h-full max-h-[230px] min-h-[150px] shrink-0 items-center justify-center">
        <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke="var(--n-color-border)"
            strokeWidth="11"
          />
          {STOCK_SEGMENTS.map((s, i) => {
            const len = (s.value / total) * c;
            const start = STOCK_SEGMENTS.slice(0, i).reduce(
              (acc, x) => acc + (x.value / total) * c,
              0,
            );
            return (
              <circle
                key={s.label}
                cx="55"
                cy="55"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="11"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-start}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">in stock</span>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-3">
        {STOCK_SEGMENTS.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="flex-1 text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const NEWS = [
  {
    tag: "Pricing",
    title: "3 vehicles repriced after market check",
    time: "2h ago",
    thumb:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=160&h=120&q=70",
  },
  {
    tag: "Auction",
    title: "BCA Blackbushe — 12 lots matched your buy box",
    time: "5h ago",
    thumb:
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=160&h=120&q=70",
  },
  {
    tag: "Compliance",
    title: "2 MOTs due within the next 7 days",
    time: "1d ago",
    thumb:
      "https://images.unsplash.com/photo-1676802584541-dc901dcaa815?auto=format&fit=crop&w=160&h=120&q=70",
  },
  {
    tag: "Finance",
    title: "Lender rate card updated for June",
    time: "1d ago",
    thumb:
      "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=160&h=120&q=70",
  },
];

/* ---------------------------------------------------------- A: classic grid */
function VariationA() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHead />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => (
          <div
            key={k.label}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {k.label}
            </span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {k.value}
            </span>
            <span className="text-xs font-medium text-success-foreground">
              {k.delta} vs last month
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <nord-card padding="none">
          <CardHead title="Recent deals" count={DEALS.length} />
          <DealsTable />
        </nord-card>
        <TasksCard />
      </div>
    </div>
  );
}

/* ------------------------------------------------------ B: stats + sparklines */
function VariationB() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHead />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.slice(0, 4).map((k, i) => (
          <div
            key={k.label}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {k.label}
            </span>
            <div className="flex items-end justify-between gap-2">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {k.value}
              </span>
              <span className="pb-1 text-xs font-medium text-success-foreground">
                {k.delta}
              </span>
            </div>
            <Sparkline up={i % 2 === 0} />
          </div>
        ))}
      </div>
      <nord-card padding="none">
        <CardHead title="Sales · last 30 days" />
        <div className="p-4">
          <Sparkline className="h-40" />
        </div>
      </nord-card>
      <nord-card padding="none">
        <CardHead title="Recent deals" count={DEALS.length} />
        <DealsTable />
      </nord-card>
    </div>
  );
}

/* ----------------------------------------------------------------- C: bento */
function VariationC() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHead />
      {/* all six metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => (
          <div
            key={k.label}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {k.label}
            </span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {k.value}
            </span>
            <span className="text-xs font-medium text-success-foreground">
              {k.delta}
            </span>
          </div>
        ))}
      </div>
      {/* row 2 — stock overview (donut) + recent deals, equal height */}
      <div className="grid items-stretch gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-5">
          <CardHead title="Stock overview" action={false} />
          <div className="flex flex-1 p-6">
            <Donut />
          </div>
        </Panel>
        <Panel className="lg:col-span-7">
          <CardHead title="Recent deals" count={DEALS.length} />
          <DealsTable rows={DEALS.slice(0, 4)} />
        </Panel>
      </div>
      {/* row 3 — upcoming appointments | today updates | latest news */}
      <div className="grid items-stretch gap-3 lg:grid-cols-3">
        <Panel>
          <CardHead title="Upcoming appointments" count={APPTS.length} />
          <ul className="divide-y divide-border">
            {APPTS.map((a) => (
              <li
                key={a.time + a.who}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <div className="flex w-12 shrink-0 flex-col leading-tight">
                  <span className="text-xs font-semibold tabular-nums">
                    {a.time}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.date}</span>
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate font-medium">{a.who}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {a.what}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <CardHead title="Today's updates" action={false} />
          <ul className="divide-y divide-border">
            {TASKS.map((t) => (
              <li
                key={t.label}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-muted-foreground">{t.label}</span>
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {t.count}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <CardHead title="Latest news" action={false} />
          <ul className="divide-y divide-border">
            {NEWS.map((n) => (
              <li key={n.title} className="flex gap-3 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={n.thumb}
                  alt=""
                  className="h-14 w-20 shrink-0 rounded-md border border-border object-cover"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <nord-badge variant="info">{n.tag}</nord-badge>
                    <span className="text-xs text-muted-foreground">
                      {n.time}
                    </span>
                  </div>
                  <p className="text-sm leading-snug">{n.title}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- D: sidebar-stat */
function VariationD() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHead />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <nord-card padding="none">
            <CardHead title="Sales · last 30 days" />
            <div className="p-4">
              <Sparkline className="h-44" />
            </div>
          </nord-card>
          <nord-card padding="none">
            <CardHead title="Recent deals" count={DEALS.length} />
            <DealsTable />
          </nord-card>
        </div>
        <aside className="flex flex-col gap-3">
          <nord-card padding="none">
            <div className="divide-y divide-border">
              {KPIS.slice(0, 4).map((k) => (
                <div
                  key={k.label}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {k.value}
                  </span>
                </div>
              ))}
            </div>
          </nord-card>
          <TasksCard />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ E: table-first console */
function VariationE() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHead compact />
      <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-card px-5 py-4">
        {KPIS.map((k) => (
          <div key={k.label} className="flex flex-col">
            <span className="text-xs text-muted-foreground">{k.label}</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold tabular-nums">
                {k.value}
              </span>
              <span className="text-xs font-medium text-success-foreground">
                {k.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
      <nord-card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Recent deals</h3>
          <div className="flex items-center gap-2">
            <nord-input
              type="search"
              hideLabel
              label="Search"
              size="s"
              placeholder="Search reg or customer…"
            />
            <nord-button size="s">
              <nord-icon slot="start" name="interface-filter" />
              Filter
            </nord-button>
          </div>
        </div>
        <DealsTable />
      </nord-card>
    </div>
  );
}
