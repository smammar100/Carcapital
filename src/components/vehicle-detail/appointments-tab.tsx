"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Users, Zap } from "lucide-react";
import type { Appointment, Customer, Enquiry, User, Vehicle } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { enquiryService } from "@/lib/services/enquiry-service";
import { customerService } from "@/lib/services/customer-service";
import { teamService } from "@/lib/services/team-service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddEnquiryDialog } from "@/components/enquiries/add-enquiry-dialog";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { Panel, Pill, SectionDivider } from "./primitives";
import { cn } from "@/lib/utils";

interface AppointmentsTabProps {
  vehicle: Vehicle;
}

const STATUS_TONE: Record<Enquiry["status"], React.ComponentProps<typeof Pill>["tone"]> = {
  open: "info",
  won: "good",
  lost: "bad",
};

/**
 * Appointments tab (Variation E — focused view). The actionable enquiries lead,
 * with a one-line workflow legend instead of a banner; the cross-vehicle
 * lost-reason analytics + recommended actions sit below in a clearly-labelled,
 * compact block. All the original content is preserved, just decluttered.
 */
export function AppointmentsTab({ vehicle }: AppointmentsTabProps) {
  const { company } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refetch = () => {
    void enquiryService.getForVehicle(vehicle.id).then(setEnquiries);
    void appointmentService.getForVehicle(vehicle.id).then(setAppts);
  };

  useEffect(() => {
    refetch();
    if (company?.id) {
      void customerService.getAll(company.id).then(setCustomers);
      void teamService.getAll(company.id).then(setUsers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id, company?.id]);

  const customerById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Enquiries on this vehicle"
        subtitle="Every interaction with this car. Repeat buyers are de-duped on phone / postcode / email, so they stay connected across vehicles."
        action={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Enquiry
          </Button>
        }
        flush
      >
        <div className="px-4 pb-3">
          <WorkflowLegend />
        </div>
        <EnquiriesTable
          enquiries={enquiries}
          appts={appts}
          customerById={customerById}
          userById={userById}
          onAddEnquiry={() => setDialogOpen(true)}
        />
      </Panel>

      <div>
        <SectionDivider label="Performance · across all vehicles" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <LostReasonInsight />
            <Panel title="Why we lose enquiries" subtitle="Last 90 days · 61 lost enquiries">
              <ReasonBars />
            </Panel>
          </div>
          <RecommendedActions />
        </div>
      </div>

      <AddEnquiryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicleId={vehicle.id}
        onCreated={refetch}
      />
    </div>
  );
}

// ============================================================
// Workflow legend — one line, full context on hover
// ============================================================

const WORKFLOW: {
  num: string;
  label: string;
  meta: string;
  tone: "default" | "good" | "bad";
}[] = [
  { num: "01", label: "Capture", meta: "Enquiry · Phone · Web · Walk-in", tone: "default" },
  { num: "02", label: "Customer Match", meta: "Dedupe · Name · postcode · email", tone: "default" },
  { num: "03", label: "Vehicle Interest", meta: "Link · attach + assign salesperson", tone: "default" },
  { num: "04", label: "Appointment", meta: "Book · viewing · test drive · finance", tone: "default" },
  { num: "05a", label: "Sale", meta: "Outcome · Deposit → Invoice", tone: "good" },
  { num: "05b", label: "Lost", meta: "Outcome · 9 reason categories", tone: "bad" },
];

function WorkflowLegend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {WORKFLOW.map((s, i) => (
        <div key={s.num} className="flex items-center gap-1.5">
          <span
            title={s.meta}
            className={cn(
              "inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5",
              s.tone === "good" &&
                "border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300",
              s.tone === "bad" &&
                "border-rose-300 text-rose-700 dark:border-rose-500/40 dark:text-rose-300",
              s.tone === "default" && "border-border text-muted-foreground",
            )}
          >
            <span className="font-semibold tabular-nums">{s.num}</span>
            {s.label}
          </span>
          {i < WORKFLOW.length - 1 && i !== 4 && (
            <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Enquiries table
// ============================================================

function EnquiriesTable({
  enquiries,
  appts,
  customerById,
  userById,
  onAddEnquiry,
}: {
  enquiries: Enquiry[] | null;
  appts: Appointment[] | null;
  customerById: Map<string, Customer>;
  userById: Map<string, User>;
  onAddEnquiry: () => void;
}) {
  if (enquiries === null || appts === null) {
    return (
      <div className="px-4 py-5">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (enquiries.length === 0 && appts.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <div className="mt-3 text-base font-semibold">
          No enquiries on this vehicle yet
        </div>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          Click <strong className="text-foreground">+ Add Enquiry</strong> —
          we&apos;ll dedup against your existing customers first so repeat buyers
          stay attached to their record.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onAddEnquiry}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add First Enquiry
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Salesperson</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Next Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {enquiries.map((e) => {
          const cust = customerById.get(e.customerId);
          const sp = userById.get(e.salespersonId);
          return (
            <TableRow key={e.id}>
              <TableCell className="font-medium">
                {cust ? `${cust.firstName} ${cust.lastName}` : "—"}
                {cust?.mobilePhone && (
                  <div className="text-xs text-muted-foreground">
                    {cust.mobilePhone}
                  </div>
                )}
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {e.source.replace(/_/g, " ")}
              </TableCell>
              <TableCell className="capitalize">
                {e.type.replace(/_/g, " ")}
              </TableCell>
              <TableCell>{sp?.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatRelativeTime(e.createdAt)}
              </TableCell>
              <TableCell>
                <Pill tone={STATUS_TONE[e.status]}>{e.status}</Pill>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {e.nextActionDueAt ? formatDate(e.nextActionDueAt) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
        {appts.map((a) => (
          <TableRow key={`appt-${a.id}`}>
            <TableCell className="font-medium">{a.customerName}</TableCell>
            <TableCell className="text-muted-foreground">Appointment</TableCell>
            <TableCell>Viewing</TableCell>
            <TableCell className="text-muted-foreground">—</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(a.date)} · {a.time}
            </TableCell>
            <TableCell>
              <Pill tone="info">{a.status}</Pill>
            </TableCell>
            <TableCell className="text-muted-foreground">—</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================
// Lost-reason insight + bars + recommended actions
// ============================================================

function LostReasonInsight() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-violet-200/70 bg-violet-50/70 px-3 py-2.5 dark:border-violet-500/20 dark:bg-violet-500/5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
        <Zap className="h-3.5 w-3.5" />
      </span>
      <div>
        <div className="text-2xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Top finding this period
        </div>
        <p className="mt-0.5 text-xs leading-relaxed">
          <strong>41% of lost enquiries</strong> (25 of 61) over the last 90 days
          were driven by <strong>Price</strong> or <strong>Finance</strong> —
          both operational levers you control directly.
        </p>
      </div>
    </div>
  );
}

const REASONS = [
  { label: "Price", pct: 23, count: 14, desc: "Customer found a better price elsewhere" },
  { label: "Vehicle Sold", pct: 21, count: 13, desc: "We sold it before they returned" },
  { label: "Finance", pct: 18, count: 11, desc: "Finance declined or rate too high" },
  { label: "Contact", pct: 15, count: 9, desc: "Couldn't reach customer for follow-up" },
  { label: "PX", pct: 10, count: 6, desc: "Couldn't agree on part-exchange value" },
  { label: "Other (4 reasons)", pct: 13, count: 8, desc: "Product · People · Purchased · Duplicate" },
];

function ReasonBars() {
  const max = Math.max(...REASONS.map((r) => r.pct));
  return (
    <div className="flex flex-col gap-2.5">
      {REASONS.map((r) => (
        <div
          key={r.label}
          title={r.desc}
          className="grid cursor-default grid-cols-[110px_1fr_auto] items-center gap-3"
        >
          <div className="truncate text-xs font-medium">{r.label}</div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${(r.pct / max) * 100}%` }}
            />
          </div>
          <div className="text-xs tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">{r.pct}%</span> ·{" "}
            {r.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendedActions() {
  const actions = [
    {
      title: "Review pricing on aged stock",
      text: "14 enquiries lost to price this quarter — the largest single bucket. Consider sharper web prices on vehicles over 60 days in stock.",
      cta: "View aged stock",
      href: "/vehicles?sort=oldest",
    },
    {
      title: "Audit finance partner conversion",
      text: "11 enquiries lost to Finance — could indicate one provider is over-declining. Review approval rates by partner.",
      cta: "Open report",
      href: "/admin/activity",
    },
    {
      title: "Implement 24-hour callback rule",
      text: "9 enquiries lost simply because nobody followed up in time. Set a hard SLA — every new enquiry gets a call within 24 hours.",
      cta: "Configure SLA",
      href: "/admin/settings",
    },
  ];
  return (
    <Panel
      title="Recommended actions"
      subtitle="Data-driven next steps based on this period's losses"
    >
      <div className="divide-y divide-border">
        {actions.map((a, i) => (
          <div key={a.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-2xs font-semibold text-background tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{a.title}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {a.text}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={a.href}>{a.cta} →</Link>
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
