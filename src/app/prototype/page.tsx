"use client";

import { useState } from "react";
import {
  Plus,
  Phone,
  CalendarClock,
  Car,
  User as UserIcon,
  ChevronDown,
  CircleDot,
  PhoneCall,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /prototype — "Workshop" gallery. 5 layouts for external walk-in jobs.
 * Each keeps every field: customer, phone, vehicle (reg + desc), job, schedule
 * (date · time), cost, status, assignee, + the Add Workshop Job action.
 * Refs (Mobbin): Walmart Auto Care booking cards, KAYAK/Booking summaries.
 */

type Status = "pending" | "in_progress" | "completed" | "stalled";

interface Job {
  customer: string;
  phone: string;
  reg: string;
  vehicle: string;
  job: string;
  date: string;
  time: string;
  cost: number | null;
  status: Status;
  assignee: string | null;
}

const JOBS: Job[] = [
  { customer: "Tom Khan", phone: "07655 443322", reg: "TU16 VWX", vehicle: "Audi A1 2016", job: "Tyre replacement x2 (outsourced to Quick Tyres)", date: "27 Apr 2026", time: "4:00pm", cost: 195, status: "completed", assignee: "Kami" },
  { customer: "Priya Singh", phone: "07900 112233", reg: "OP18 QRS", vehicle: "VW Polo 2018", job: "Full service", date: "29 Apr 2026", time: "11:00am", cost: 175, status: "completed", assignee: "Sam" },
  { customer: "John Smith", phone: "07712 345678", reg: "AB12 CDE", vehicle: "Vauxhall Corsa 2014", job: "AC re-gas + cabin filter", date: "01 May 2026", time: "2:30pm", cost: 90, status: "in_progress", assignee: "Kami" },
  { customer: "Sarah Patel", phone: "07798 765432", reg: "EF63 GHI", vehicle: "Honda Civic 2013", job: "Brake pads front + rear", date: "02 May 2026", time: "10:00am", cost: 220, status: "pending", assignee: "Sam" },
  { customer: "Mark Lewis", phone: "07811 223344", reg: "JK19 LMN", vehicle: "Ford Focus 2019", job: "Diagnostic — engine light", date: "03 May 2026", time: "9:30am", cost: 60, status: "pending", assignee: null },
  { customer: "Walk-in", phone: "", reg: "MV17 HFJ", vehicle: "Audi Q2", job: "Workshop visit", date: "28 May 2026", time: "3:00pm", cost: null, status: "pending", assignee: null },
];

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500" },
  in_progress: { label: "In Progress", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", dot: "bg-blue-500" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500" },
  stalled: { label: "Stalled", cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", dot: "bg-rose-500" },
};

const fmtCost = (c: number | null) => (c == null ? "—" : `£${c.toFixed(2)}`);
const initials = (n: string) =>
  n === "Walk-in" ? "WI" : n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* -------------------------------------------------------------- shared bits */

function Plate({ reg }: { reg: string }) {
  return (
    <span className="inline-block rounded-[3px] border border-yellow-700/40 bg-[#FFD400] px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-black">
      {reg}
    </span>
  );
}
function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", m.cls)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}
function StatusSelect({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <div className="inline-flex h-8 items-center justify-between gap-2 rounded-md border bg-background px-2 text-xs">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", m.cls)}>
        <span className={cn("size-1.5 rounded-full", m.dot)} />
        {m.label}
      </span>
      <ChevronDown className="size-3.5 text-muted-foreground" />
    </div>
  );
}
function Avatar({ name, lg }: { name: string | null; lg?: boolean }) {
  if (!name)
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-full border border-dashed border-border text-muted-foreground", lg ? "size-9 text-xs" : "size-7 text-2xs")} title="Unassigned">?</span>
    );
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary", lg ? "size-9 text-xs" : "size-7 text-2xs")} title={name}>
      {initials(name)}
    </span>
  );
}
function Cta() {
  return (
    <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      <Plus className="size-4" /> Add Workshop Job
    </button>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Workshop</h2>
          <p className="text-sm text-muted-foreground">
            External, walk-in customer service jobs, kept separate from internal stock preparation.
          </p>
        </div>
        <Cta />
      </div>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- gallery */

const VARIATIONS = [
  { id: "A", label: "Refined table", sub: "Familiar table + customer avatar, status pill, cleaner money column", render: () => <A /> },
  { id: "B", label: "Booking cards", sub: "A card per job — customer, vehicle, schedule, cost, quick call", render: () => <B /> },
  { id: "C", label: "Status board", sub: "Pending → In progress → Completed lanes, drag-ready cards", render: () => <C /> },
  { id: "D", label: "Day agenda", sub: "Grouped by date like a workshop diary — schedule-forward", render: () => <D /> },
  { id: "E", label: "List + detail", sub: "Compact list with a full booking detail panel beside it", render: () => <E /> },
];

export default function PrototypePage() {
  return (
    <div className="min-h-screen bg-muted/30 p-6 text-foreground">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Prototype — Workshop (5 variations)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each keeps every field: customer, phone, vehicle, job, schedule, cost, status, assignee. Toggle OS dark mode.
        </p>
      </header>
      <div className="flex flex-col gap-8">
        {VARIATIONS.map((v) => (
          <section key={v.id} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="grid size-5 place-items-center rounded bg-foreground text-2xs font-bold text-background">{v.id}</span>
              <span className="text-sm font-semibold">{v.label}</span>
              <span className="text-xs text-muted-foreground">{v.sub}</span>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">{v.render()}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- A: refined table */
function A() {
  return (
    <Shell>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Vehicle</th>
              <th className="px-4 py-2.5 font-medium">Job</th>
              <th className="px-4 py-2.5 font-medium">Scheduled</th>
              <th className="px-4 py-2.5 text-right font-medium">Cost</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {JOBS.map((j) => (
              <tr key={j.reg} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={j.assignee ?? j.customer} />
                    <div className="leading-tight">
                      <div className="font-medium">{j.customer}</div>
                      <div className="text-xs text-muted-foreground">{j.phone || "No phone"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Plate reg={j.reg} />
                  <div className="mt-1 text-xs text-muted-foreground">{j.vehicle}</div>
                </td>
                <td className="max-w-[220px] truncate px-4 py-3">{j.job}</td>
                <td className="px-4 py-3 text-muted-foreground">{j.date}<span className="text-foreground"> · {j.time}</span></td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtCost(j.cost)}</td>
                <td className="px-4 py-3"><StatusSelect status={j.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------- B: booking cards */
function B() {
  return (
    <Shell>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {JOBS.map((j) => (
          <div key={j.reg} className="flex flex-col gap-3 rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Avatar name={j.assignee ?? j.customer} lg />
                <div className="leading-tight">
                  <div className="font-medium">{j.customer}</div>
                  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="size-3" />{j.phone || "Walk-in"}
                  </div>
                </div>
              </div>
              <StatusPill status={j.status} />
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <div className="flex items-center justify-between">
                <Plate reg={j.reg} />
                <span className="text-xs text-muted-foreground">{j.vehicle}</span>
              </div>
              <div className="mt-2 text-sm font-medium leading-snug">{j.job}</div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-3.5" />{j.date} · {j.time}</span>
              <span className="text-base font-semibold tabular-nums text-foreground">{fmtCost(j.cost)}</span>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* --------------------------------------------------------------- C: board */
function C() {
  const lanes: { key: Status; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "in_progress", label: "In Progress" },
    { key: "completed", label: "Completed" },
  ];
  return (
    <Shell>
      <div className="grid gap-3 lg:grid-cols-3">
        {lanes.map((lane) => {
          const list = JOBS.filter((j) => j.status === lane.key);
          return (
            <div key={lane.key} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-2.5">
              <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
                <CircleDot className={cn("size-3.5", STATUS_META[lane.key].dot.replace("bg-", "text-"))} />
                <h3 className="text-sm font-semibold">{lane.label}</h3>
                <span className="rounded-full bg-background px-1.5 text-xs font-medium tabular-nums text-muted-foreground">{list.length}</span>
              </div>
              {list.map((j) => (
                <div key={j.reg} className="flex flex-col gap-2 rounded-lg border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{j.customer}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmtCost(j.cost)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plate reg={j.reg} />
                    <span className="truncate text-xs text-muted-foreground">{j.vehicle}</span>
                  </div>
                  <div className="text-sm leading-snug">{j.job}</div>
                  <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-3.5" />{j.date} · {j.time}</span>
                    <Avatar name={j.assignee} />
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* --------------------------------------------------------------- D: day agenda */
function D() {
  const byDate = JOBS.reduce<Record<string, Job[]>>((acc, j) => {
    (acc[j.date] ??= []).push(j);
    return acc;
  }, {});
  return (
    <Shell>
      <div className="flex flex-col gap-4">
        {Object.entries(byDate).map(([date, list]) => (
          <div key={date} className="flex gap-4">
            <div className="w-24 shrink-0 pt-1 text-sm font-semibold text-muted-foreground">{date}</div>
            <div className="flex flex-1 flex-col gap-2">
              {list.map((j) => (
                <div key={j.reg} className="flex items-center gap-4 rounded-lg border bg-background p-3">
                  <div className="w-16 shrink-0 text-sm font-semibold tabular-nums">{j.time}</div>
                  <Avatar name={j.assignee ?? j.customer} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{j.customer}</span>
                      <Plate reg={j.reg} />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{j.job} · {j.vehicle}</div>
                  </div>
                  <span className="hidden shrink-0 text-sm font-semibold tabular-nums sm:block">{fmtCost(j.cost)}</span>
                  <StatusPill status={j.status} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* --------------------------------------------------------------- E: list + detail */
function E() {
  const [sel, setSel] = useState(0);
  const j = JOBS[sel];
  return (
    <Shell>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-1.5">
          {JOBS.map((job, i) => (
            <button
              key={job.reg}
              onClick={() => setSel(i)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                i === sel ? "border-primary bg-primary/5" : "hover:bg-muted/40",
              )}
            >
              <Avatar name={job.assignee ?? job.customer} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{job.customer}</span>
                  <span className={cn("size-2 shrink-0 rounded-full", STATUS_META[job.status].dot)} />
                </div>
                <div className="truncate text-xs text-muted-foreground">{job.reg} · {job.time}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="rounded-xl border bg-background p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{j.customer}</h3>
              <a className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5" />{j.phone || "Walk-in"}
              </a>
            </div>
            <StatusSelect status={j.status} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field icon={Car} label="Vehicle">
              <Plate reg={j.reg} /> <span className="ml-1 text-sm text-muted-foreground">{j.vehicle}</span>
            </Field>
            <Field icon={CalendarClock} label="Scheduled">{j.date} · {j.time}</Field>
            <Field icon={UserIcon} label="Assigned to">{j.assignee ?? "Unassigned"}</Field>
            <Field icon={PhoneCall} label="Cost"><span className="font-semibold tabular-nums">{fmtCost(j.cost)}</span></Field>
            <div className="sm:col-span-2">
              <Field icon={CircleDot} label="Job">{j.job}</Field>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t pt-4">
            <button className="rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted">Edit</button>
            <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Mark complete</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
function Field({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />{label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
