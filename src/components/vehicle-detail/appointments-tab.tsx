"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Users, Zap } from "lucide-react";
import type { Appointment, Enquiry, User, Vehicle } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { enquiryService } from "@/lib/services/enquiry-service";
import { customerService } from "@/lib/services/customer-service";
import { teamService } from "@/lib/services/team-service";
import type { Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddEnquiryDialog } from "@/components/enquiries/add-enquiry-dialog";
import { formatDate, formatRelative } from "@/lib/formatters";
import { InfoCard, PanelCard, Pill, SectionDivider } from "./primitives";
import { cn } from "@/lib/utils";

interface AppointmentsTabProps {
  vehicle: Vehicle;
}

const STATUS_TONE: Record<Enquiry["status"], React.ComponentProps<typeof Pill>["tone"]> = {
  open: "info",
  won: "good",
  lost: "bad",
};

const STATUS_LABEL: Record<Enquiry["status"], string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};

/**
 * Appointments tab — the customer-first sales surface for this vehicle.
 * Layout, top to bottom:
 *   1. "What this tracks" info card
 *   2. Five-step Enquiry → Sale workflow visual
 *   3. Active enquiries table (with empty-state + "Add Enquiry" CTA)
 *   4. Section divider — Performance Analysis
 *   5. Lost-Reason breakdown grid (synthesized; v4.2 report)
 *   6. Recommended actions card (data-driven next steps)
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
  const userById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  return (
    <div className="flex flex-col">
      <InfoCard
        icon={<Users className="h-4.5 w-4.5" />}
        title="What this tab tracks"
      >
        Every customer interaction tied to this vehicle — initial enquiry,
        follow-up calls, booked viewings, test drives, deposit, sale or loss.
        Each enquiry attaches to a <strong>customer record</strong> that&apos;s
        de-duplicated on phone, postcode, or email, so repeat buyers and
        trade-in conversations stay connected across vehicles.
      </InfoCard>

      <PanelCard
        title="Enquiry → Sale Workflow"
        subtitle="Every enquiry follows this five-step path to either a Sale or a recorded Lost-reason"
      >
        <WorkflowVisual />
      </PanelCard>

      <PanelCard
        title="Active Enquiries on this Vehicle"
        subtitle="Customer-search-first dedup means repeat buyers don't get re-created as new leads"
        trailing={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Enquiry
          </Button>
        }
        bodyClassName="p-0"
      >
        <EnquiriesTable
          enquiries={enquiries}
          appts={appts}
          customerById={customerById}
          userById={userById}
          onAddEnquiry={() => setDialogOpen(true)}
        />
      </PanelCard>

      <SectionDivider label="Performance Analysis · across all vehicles" />
      <LostReasonInsight />
      <LostReasonBreakdown />
      <RecommendedActions />

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
// Workflow visual — 5 steps + arrow
// ============================================================

function WorkflowVisual() {
  const steps = [
    {
      num: "01 ENQUIRY",
      label: "Capture",
      meta: "Phone · Web · Walk-in · AutoTrader · Facebook",
    },
    {
      num: "02 DEDUPE",
      label: "Customer Match",
      meta: "Search by name · postcode · email · phone",
    },
    {
      num: "03 LINK",
      label: "Vehicle Interest",
      meta: "Attach to stock + assign salesperson",
    },
    {
      num: "04 BOOK",
      label: "Appointment",
      meta: "Viewing · test drive · finance check",
    },
  ];
  return (
    <div className="flex flex-wrap items-stretch gap-1 overflow-x-auto pb-1 sm:flex-nowrap">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-stretch gap-1">
          <FlowStep
            num={s.num}
            label={s.label}
            meta={s.meta}
            variant="default"
          />
          {i < steps.length - 1 && (
            <span className="flex items-center px-1 text-muted-foreground">→</span>
          )}
        </div>
      ))}
      <span className="flex items-center px-1 text-muted-foreground">→</span>
      <div className="flex items-stretch gap-1">
        <FlowStep
          num="05a OUTCOME"
          label="✓ Sale"
          meta="Deposit → Invoice"
          variant="ok"
        />
        <FlowStep
          num="05b OUTCOME"
          label="✗ Lost"
          meta="9 reason categories"
          variant="lost"
        />
      </div>
    </div>
  );
}

function FlowStep({
  num,
  label,
  meta,
  variant,
}: {
  num: string;
  label: string;
  meta: string;
  variant: "default" | "ok" | "lost";
}) {
  return (
    <div
      className={cn(
        "min-w-[130px] rounded-lg border p-3",
        variant === "default" && "border-border bg-muted/30",
        variant === "ok" && "border-emerald-200 bg-emerald-50",
        variant === "lost" && "border-rose-200 bg-rose-50",
      )}
    >
      <div
        className={cn(
          "font-mono text-[10px] font-semibold tracking-wider",
          variant === "default" && "text-muted-foreground",
          variant === "ok" && "text-emerald-700",
          variant === "lost" && "text-rose-700",
        )}
      >
        {num}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[12.5px] font-semibold",
          variant === "ok" && "text-emerald-700",
          variant === "lost" && "text-rose-700",
        )}
      >
        {label}
      </div>
      <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
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
      <div className="px-5 py-5">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (enquiries.length === 0 && appts.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <div className="mt-3 text-base font-semibold">
          No enquiries on this vehicle yet
        </div>
        <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] leading-relaxed text-muted-foreground">
          Click <strong className="text-violet-700">+ Add Enquiry</strong> —
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
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b bg-muted/30 text-left">
          <Th>Customer</Th>
          <Th>Source</Th>
          <Th>Type</Th>
          <Th>Salesperson</Th>
          <Th>Date</Th>
          <Th>Status</Th>
          <Th>Next Action</Th>
        </tr>
      </thead>
      <tbody>
        {enquiries.map((e) => {
          const cust = customerById.get(e.customerId);
          const sp = userById.get(e.salespersonId);
          return (
            <tr key={e.id} className="border-b last:border-b-0 hover:bg-muted/20">
              <Td className="font-medium">
                {cust ? `${cust.firstName} ${cust.lastName}` : "—"}
                {cust?.mobilePhone && (
                  <span className="ml-2 text-[11.5px] text-muted-foreground">
                    {cust.mobilePhone}
                  </span>
                )}
              </Td>
              <Td className="capitalize text-muted-foreground">
                {e.source.replace(/_/g, " ")}
              </Td>
              <Td className="capitalize">{e.type.replace(/_/g, " ")}</Td>
              <Td>{sp?.name ?? "—"}</Td>
              <Td className="font-mono text-muted-foreground">
                {formatRelative(e.createdAt)}
              </Td>
              <Td>
                <Pill tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Pill>
              </Td>
              <Td className="text-muted-foreground">
                {e.nextActionDueAt ? formatDate(e.nextActionDueAt) : "—"}
              </Td>
            </tr>
          );
        })}
        {appts.map((a) => (
          <tr key={`appt-${a.id}`} className="border-b last:border-b-0 hover:bg-muted/20">
            <Td className="font-medium">{a.customerName}</Td>
            <Td className="text-muted-foreground">Appointment</Td>
            <Td className="text-muted-foreground">Viewing</Td>
            <Td className="text-muted-foreground">—</Td>
            <Td className="font-mono text-muted-foreground">
              {formatDate(a.date)} · {a.time}
            </Td>
            <Td>
              <Pill tone="info">{a.status}</Pill>
            </Td>
            <Td className="text-muted-foreground">—</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================
// Lost-reason insight callout (synthesised company-wide)
// ============================================================

function LostReasonInsight() {
  return (
    <div className="mb-3.5 flex items-start gap-3.5 rounded-xl border border-violet-200 border-l-[3px] border-l-violet-500 bg-violet-50 px-5 py-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
        <Zap className="h-3.5 w-3.5" />
      </div>
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-violet-700">
          Top Finding This Period
        </div>
        <div className="mt-1 text-[13px] leading-relaxed">
          <strong>41% of lost enquiries</strong> (25 of 61) over the last 90
          days were driven by <strong>Price</strong> or{" "}
          <strong>Finance</strong> — both operational levers you control
          directly.
        </div>
      </div>
    </div>
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
    <PanelCard
      title="Lost-Reason Breakdown"
      subtitle="Across all vehicles · last 90 days · 61 lost enquiries total"
      bodyClassName="p-0"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {reasons.map((r, i) => (
          <div
            key={r.label}
            className={cn(
              "border-b border-r p-5",
              (i + 1) % 3 === 0 && "lg:border-r-0",
              i >= reasons.length - 3 && "lg:border-b-0",
            )}
          >
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {r.label}
            </div>
            <div className="mt-1 font-mono text-[22px] font-semibold tracking-tight">
              {r.pct}%
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {r.count} of 61
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {r.desc}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-violet-600"
                style={{ width: `${(r.pct / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </PanelCard>
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
    <PanelCard
      title="Recommended Actions"
      subtitle="Data-driven next steps based on this period's losses"
      bodyClassName="p-0"
    >
      <div>
        {actions.map((a, i) => (
          <div
            key={a.title}
            className={cn(
              "grid grid-cols-[30px_1fr_auto] items-start gap-3.5 px-5 py-4 transition-colors hover:bg-muted/20",
              i < actions.length - 1 && "border-b",
            )}
          >
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-foreground font-mono text-[11px] font-semibold text-[#F5C518]">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div>
              <div className="text-[13px] font-semibold">{a.title}</div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {a.text}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={a.href}>{a.cta} →</Link>
            </Button>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
