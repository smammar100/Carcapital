"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Users, Zap } from "lucide-react";
import type { Appointment, Customer, Enquiry, User, Vehicle } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { enquiryService } from "@/lib/services/enquiry-service";
import { customerService } from "@/lib/services/customer-service";
import { teamService } from "@/lib/services/team-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { InfoCard, Panel, Pill, SectionDivider } from "./primitives";
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
 * Appointments tab — the customer-first sales surface for this vehicle.
 * Layout: info card → workflow visual → enquiries table → divider →
 * lost-reason insight + breakdown grid → recommended actions.
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
      <InfoCard
        icon={<Users className="h-4 w-4" />}
        title="What this tab tracks"
      >
        Every customer interaction tied to this vehicle — initial enquiry,
        follow-up calls, booked viewings, test drives, deposit, sale or loss.
        Each enquiry attaches to a <strong>customer record</strong> that&apos;s
        de-duplicated on phone, postcode, or email, so repeat buyers and
        trade-in conversations stay connected across vehicles.
      </InfoCard>

      <Panel
        title="Enquiry → Sale Workflow"
        subtitle="Every enquiry follows this five-step path to either a Sale or a recorded Lost-reason"
      >
        <WorkflowVisual />
      </Panel>

      <Panel
        title="Active Enquiries on this Vehicle"
        subtitle="Customer-search-first dedup means repeat buyers don't get re-created as new leads"
        action={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Enquiry
          </Button>
        }
        flush
      >
        <EnquiriesTable
          enquiries={enquiries}
          appts={appts}
          customerById={customerById}
          userById={userById}
          onAddEnquiry={() => setDialogOpen(true)}
        />
      </Panel>

      <div>
        <SectionDivider label="Performance Analysis · across all vehicles" />
        <div className="flex flex-col gap-4">
          <LostReasonInsight />
          <LostReasonBreakdown />
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
// Workflow visual — 5 steps
// ============================================================

function WorkflowVisual() {
  const steps = [
    { num: "01", title: "ENQUIRY", label: "Capture", meta: "Phone · Web · Walk-in" },
    { num: "02", title: "DEDUPE", label: "Customer Match", meta: "Name · postcode · email" },
    { num: "03", title: "LINK", label: "Vehicle Interest", meta: "Attach + assign salesperson" },
    { num: "04", title: "BOOK", label: "Appointment", meta: "Viewing · test drive · finance" },
  ];
  return (
    <div className="flex flex-wrap items-stretch gap-2 overflow-x-auto pb-1 sm:flex-nowrap">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-stretch gap-2">
          <FlowStep {...s} tone="default" />
          {i < steps.length - 1 && (
            <span className="flex items-center px-1 text-muted-foreground">→</span>
          )}
        </div>
      ))}
      <span className="flex items-center px-1 text-muted-foreground">→</span>
      <div className="flex items-stretch gap-2">
        <FlowStep
          num="05a"
          title="OUTCOME"
          label="Sale"
          meta="Deposit → Invoice"
          tone="good"
        />
        <FlowStep
          num="05b"
          title="OUTCOME"
          label="Lost"
          meta="9 reason categories"
          tone="bad"
        />
      </div>
    </div>
  );
}

function FlowStep({
  num,
  title,
  label,
  meta,
  tone,
}: {
  num: string;
  title: string;
  label: string;
  meta: string;
  tone: "default" | "good" | "bad";
}) {
  return (
    <div
      className={cn(
        "min-w-[140px] rounded-md border p-3",
        tone === "default" && "border-border bg-muted/30",
        tone === "good" &&
          "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5",
        tone === "bad" &&
          "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/5",
      )}
    >
      <div
        className={cn(
          "text-xs font-medium uppercase tracking-wide",
          tone === "default" && "text-muted-foreground",
          tone === "good" && "text-emerald-700 dark:text-emerald-300",
          tone === "bad" && "text-rose-700 dark:text-rose-300",
        )}
      >
        {num} {title}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold",
          tone === "good" && "text-emerald-800 dark:text-emerald-200",
          tone === "bad" && "text-rose-800 dark:text-rose-200",
        )}
      >
        {label}
      </div>
      <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
        {meta}
      </div>
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
          we&apos;ll dedup against your existing customers first so repeat
          buyers stay attached to their record.
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
// Lost-reason insight + breakdown + recommended actions
// ============================================================

function LostReasonInsight() {
  return (
    <Card
      size="sm"
      className="gap-3 border-violet-200/70 bg-violet-50/70 ring-violet-300/20 dark:border-violet-500/20 dark:bg-violet-500/5"
    >
      <CardContent className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Top Finding This Period
          </div>
          <div className="mt-1 text-sm leading-relaxed">
            <strong>41% of lost enquiries</strong> (25 of 61) over the last 90
            days were driven by <strong>Price</strong> or{" "}
            <strong>Finance</strong> — both operational levers you control
            directly.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LostReasonBreakdown() {
  const reasons = [
    { label: "Lost — Price", pct: 23, count: 14, desc: "Customer found a better price elsewhere" },
    { label: "Lost — Vehicle Sold", pct: 21, count: 13, desc: "We sold it before they returned" },
    { label: "Lost — Finance", pct: 18, count: 11, desc: "Finance declined or rate too high" },
    { label: "Lost — Contact", pct: 15, count: 9, desc: "Couldn't reach customer for follow-up" },
    { label: "Lost — PX", pct: 10, count: 6, desc: "Couldn't agree on part-exchange value" },
    { label: "Other (4 reasons)", pct: 13, count: 8, desc: "Product · People · Purchased · Duplicate" },
  ];
  const max = Math.max(...reasons.map((r) => r.pct));
  return (
    <Panel
      title="Lost-Reason Breakdown"
      subtitle="Across all vehicles · last 90 days · 61 lost enquiries total"
      flush
    >
      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
        {reasons.map((r, i) => (
          <div
            key={r.label}
            className={cn(
              "p-4",
              // restore vertical dividers between rows at md+
              i >= 3 && "lg:border-t",
            )}
          >
            <div className="text-xs font-medium text-muted-foreground">
              {r.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {r.pct}%
            </div>
            <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {r.count} of 61
            </div>
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              {r.desc}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${(r.pct / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
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
      title="Recommended Actions"
      subtitle="Data-driven next steps based on this period's losses"
      flush
    >
      <div className="divide-y">
        {actions.map((a, i) => (
          <div
            key={a.title}
            className="grid grid-cols-[28px_1fr_auto] items-start gap-3 px-4 py-4"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background tabular-nums">
              {i + 1}
            </div>
            <div>
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
