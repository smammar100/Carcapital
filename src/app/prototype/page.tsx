"use client";

import { Fragment, useState } from "react";
import {
  Search,
  Receipt,
  Undo2,
  CheckCircle2,
  Car,
  TrendingUp,
  Clock,
  History,
  Filter,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /prototype — design comparison surface (auth-free).
 *
 * Current feature: ACTIVITY LOG (/admin/activity). 5 variations stacked
 * vertically. Mock data mirrors the real feed (user, time, description,
 * vehicle reg, action type). References (Mobbin, web): 7shifts (filtered feed
 * with action badges), Airbnb / Todoist (date-grouped dot timeline), Vercel
 * (left filter rail + feed), Employment Hero / Fibery (audit table), Linear
 * (icon-led compact feed).
 */

type Action =
  | "invoice_created"
  | "vehicle_returned"
  | "sale_completed"
  | "vehicle_status_changed"
  | "sale_stage_changed";

type Event = {
  user: string;
  time: string;
  group: string;
  desc: string;
  reg: string;
  action: Action;
};

const EVENTS: Event[] = [
  { user: "Abbas Bhai", time: "1 hour ago", group: "Today", desc: "Invoice REF-2026-0002 (refund) created — Test", reg: "FT19XGM", action: "invoice_created" },
  { user: "Abbas Bhai", time: "1 hour ago", group: "Today", desc: "Return FT19XGM → resolved", reg: "FT19XGM", action: "vehicle_returned" },
  { user: "Abbas Bhai", time: "4 days ago", group: "Earlier", desc: "KF67ATZ sold to Peter Hill", reg: "KF67ATZ", action: "sale_completed" },
  { user: "Abbas Bhai", time: "4 days ago", group: "Earlier", desc: "KF67ATZ → sold", reg: "KF67ATZ", action: "vehicle_status_changed" },
  { user: "Abbas Bhai", time: "4 days ago", group: "Earlier", desc: "KF67ATZ → completed sale", reg: "KF67ATZ", action: "sale_stage_changed" },
  { user: "Sara Malik", time: "4 days ago", group: "Earlier", desc: "LW16RUH sold to Anna Edwards", reg: "LW16RUH", action: "sale_completed" },
  { user: "Sara Malik", time: "4 days ago", group: "Earlier", desc: "LW16RUH → sold", reg: "LW16RUH", action: "vehicle_status_changed" },
  { user: "Sara Malik", time: "4 days ago", group: "Earlier", desc: "LW16RUH → completed sale", reg: "LW16RUH", action: "sale_stage_changed" },
  { user: "Abbas Bhai", time: "4 days ago", group: "Earlier", desc: "KF67ATZ → collection delivery", reg: "KF67ATZ", action: "sale_stage_changed" },
];

const ACT: Record<Action, { label: string; icon: LucideIcon; chip: string; dot: string; tint: string }> = {
  invoice_created: { label: "Invoice Created", icon: Receipt, chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500", tint: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
  vehicle_returned: { label: "Vehicle Returned", icon: Undo2, chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", dot: "bg-rose-500", tint: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" },
  sale_completed: { label: "Sale Completed", icon: CheckCircle2, chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500", tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  vehicle_status_changed: { label: "Vehicle Status Changed", icon: Car, chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", dot: "bg-sky-500", tint: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" },
  sale_stage_changed: { label: "Sale Stage Changed", icon: TrendingUp, chip: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", dot: "bg-blue-500", tint: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" },
};

const GROUPS = ["Today", "Earlier"];

export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Prototype — Activity Log · 6 variations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a winner (A–E). Mock data; real Nord components +
          Mobbin-referenced layouts. Toggle OS dark mode to preview both themes.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        <Frame label="A — Filtered feed + action badges" sub="7shifts — filter bar, avatar rows with colored action badges">
          <VariationA />
        </Frame>
        <Frame label="B — Date-grouped dot timeline" sub="Airbnb / Todoist — grouped by date with a colored dot rail">
          <VariationB />
        </Frame>
        <Frame label="C — Filter rail + feed" sub="Vercel — sticky action-type filters on the left, feed on the right">
          <VariationC />
        </Frame>
        <Frame label="D — Audit table" sub="Employment Hero / Fibery — gridded table, matches Master Sheet">
          <VariationD />
        </Frame>
        <Frame label="E — Icon-led feed + summary" sub="Linear — category icons + a summary strip on top">
          <VariationE />
        </Frame>
        <Frame label="F — GitHub-style timeline" sub="GitHub — continuous rail with colored event icon nodes">
          <VariationF />
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

function PageHead() {
  return (
    <div className="mb-4">
      <h3 className="text-xl font-semibold tracking-tight">Activity Log</h3>
      <p className="text-sm text-muted-foreground">150 entries</p>
    </div>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary", className)}>
      {initials}
    </span>
  );
}

function ActionBadge({ a }: { a: Action }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", ACT[a].chip)}>
      {ACT[a].label}
    </span>
  );
}

function RegChip({ reg }: { reg: string }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground/80">
      {reg}
    </span>
  );
}

function FakeSelect({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex h-9 items-center justify-between rounded-md border border-border bg-background px-3 text-sm">
        {value}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------- A · filtered feed */

function VariationA() {
  return (
    <div>
      <PageHead />
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-4">
        <FakeSelect label="Action" value="All actions" />
        <FakeSelect label="User" value="All users" />
        <FakeSelect label="From" value="mm/dd/yyyy" />
        <FakeSelect label="To" value="mm/dd/yyyy" />
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {EVENTS.map((e, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30">
            <Avatar name={e.user} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{e.user}</span>
                <ActionBadge a={e.action} />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{e.desc}</span>
                <RegChip reg={e.reg} />
              </div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{e.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------- B · date-grouped timeline */

function VariationB() {
  return (
    <div>
      <PageHead />
      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => {
          const items = EVENTS.filter((e) => e.group === g);
          return (
            <div key={g}>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</h4>
              <ol className="flex flex-col">
                {items.map((e, i) => {
                  const meta = ACT[e.action];
                  const Icon = meta.icon;
                  const last = i === items.length - 1;
                  return (
                    <li key={i} className="flex gap-3">
                      {/* icon node + connecting rail */}
                      <div className="flex flex-col items-center">
                        <span className={cn("z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-card", meta.tint)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {!last && <span className="w-px flex-1 bg-border" />}
                      </div>
                      <div className={cn("flex flex-1 items-start justify-between gap-3 pt-1", last ? "pb-0" : "pb-5")}>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">{e.desc}</span>
                            <RegChip reg={e.reg} />
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {meta.label} · {e.user}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{e.time}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- C · filter rail + feed */

function VariationC() {
  const [checks, setChecks] = useState<Record<Action, boolean>>({
    invoice_created: true,
    vehicle_returned: true,
    sale_completed: true,
    vehicle_status_changed: true,
    sale_stage_changed: true,
  });
  const toggle = (a: Action) => setChecks((c) => ({ ...c, [a]: !c[a] }));
  const visible = EVENTS.filter((e) => checks[e.action]);

  return (
    <div>
      <PageHead />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Action type
          </div>
          <div className="flex flex-col gap-1">
            {(Object.keys(ACT) as Action[]).map((a) => (
              <label key={a} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent/40">
                <input type="checkbox" checked={checks[a]} onChange={() => toggle(a)} />
                <span className={cn("h-2 w-2 rounded-full", ACT[a].dot)} />
                <span className="truncate">{ACT[a].label}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <FakeSelect label="Date range" value="Last 7 days" />
          </div>
        </aside>

        <div className="overflow-hidden rounded-lg border border-border">
          <ul className="divide-y divide-border">
            {visible.map((e, i) => {
              const Icon = ACT[e.action].icon;
              return (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30">
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", ACT[e.action].tint)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="font-medium">{e.user}</span>{" "}
                    <span className="text-muted-foreground">{e.desc}</span>
                  </span>
                  <RegChip reg={e.reg} />
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{e.time}</span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="w-full border-t border-border py-2.5 text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground">
            Load more
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ D · audit table */

function VariationD() {
  return (
    <div>
      <PageHead />
      <div className="mb-3 flex items-center justify-end gap-2">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="Search…" className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary" />
        </div>
        <button type="button" className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm">
          <Filter className="h-4 w-4" /> Filters
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[680px] border-collapse text-sm [&_td]:border-r [&_td]:border-border [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-border [&_th:last-child]:border-r-0">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Time</th>
              <th className="px-3 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium">Action</th>
              <th className="px-3 py-2.5 font-medium">Detail</th>
              <th className="px-3 py-2.5 font-medium">Vehicle</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((e, i) => (
              <tr key={i} className="border-b border-border hover:bg-muted/50">
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{e.time}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <Avatar name={e.user} className="h-6 w-6" />
                    {e.user}
                  </span>
                </td>
                <td className="px-3 py-2.5"><ActionBadge a={e.action} /></td>
                <td className="px-3 py-2.5">{e.desc}</td>
                <td className="whitespace-nowrap px-3 py-2.5"><RegChip reg={e.reg} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- E · icon feed + summary */

function VariationE() {
  return (
    <div>
      <PageHead />
      <div className="mb-4 flex flex-wrap gap-3">
        <SummaryStat icon={History} label="Total entries" value="150" />
        <SummaryStat icon={Clock} label="Today" value="2" />
        <SummaryStat icon={CheckCircle2} label="Sales completed" value="2" />
        <SummaryStat icon={Receipt} label="Invoices" value="1" />
      </div>

      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => (
          <Fragment key={g}>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</h4>
              <ul className="flex flex-col gap-1.5">
                {EVENTS.filter((e) => e.group === g).map((e, i) => {
                  const Icon = ACT[e.action].icon;
                  return (
                    <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 hover:bg-accent/30">
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", ACT[e.action].tint)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{e.desc}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{e.user}</span><span>·</span>
                          <span>{ACT[e.action].label}</span>
                        </div>
                      </div>
                      <RegChip reg={e.reg} />
                      <span className="shrink-0 text-xs text-muted-foreground">{e.time}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- F · GitHub timeline */

function VariationF() {
  return (
    <div>
      <PageHead />
      <ol className="flex flex-col">
        {EVENTS.map((e, i) => {
          const meta = ACT[e.action];
          const Icon = meta.icon;
          const last = i === EVENTS.length - 1;
          return (
            <li key={i} className="flex gap-3">
              {/* rail: icon node + connecting line */}
              <div className="flex flex-col items-center">
                <span className={cn("z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-card", meta.tint)}>
                  <Icon className="h-4 w-4" />
                </span>
                {!last && <span className="w-px flex-1 bg-border" />}
              </div>
              {/* event row */}
              <div className={cn("flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 pt-1", last ? "pb-0" : "pb-5")}>
                <Avatar name={e.user} className="h-5 w-5 text-2xs" />
                <span className="text-sm">
                  <span className="font-semibold">{e.user}</span>{" "}
                  <span className="text-muted-foreground">{e.desc}</span>
                </span>
                <RegChip reg={e.reg} />
                <span className="text-xs text-muted-foreground">· {e.time}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
