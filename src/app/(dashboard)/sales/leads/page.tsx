"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { leadService } from "@/lib/services/lead-service";
import { leadChannelService } from "@/lib/services/lead-channel-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { authService } from "@/lib/services/auth-service";
import { appointmentService } from "@/lib/services/appointment-service";
import { salesService } from "@/lib/services/sales-service";
import type {
  Lead,
  LeadChannel,
  LeadSource,
  LeadStatus,
  UUID,
  User,
  Vehicle,
} from "@/lib/types";
import { ChannelChip, ChannelDropdown } from "@/components/lead-channels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { VehicleImage } from "@/components/shared/vehicle-image";
import {
  type ColumnDef,
  DataGridFooterRow,
  DataGridGroupHeaderRow,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridSkeletonRows,
  DataGridTable,
  DataGridTotalsRow,
  useRowGroups,
  UserCell,
} from "@/components/data-grid";
import { toast } from "@/lib/toast";

const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  appointment_booked: "Appointment Booked",
  lost: "Lost",
};
// Stable refs so useRowGroups' memo doesn't recompute every render.
const leadGroupBy = (l: Lead) => l.status;
const leadGroupLabel = (k: string) => LEAD_STATUS_LABEL[k] ?? k;

interface LeadRow extends Lead {
  assigneeName: string;
}

const SOURCES: LeadSource[] = [
  "website",
  "phone",
  "walk_in",
  "autotrader",
  "ebay",
  "facebook",
  "referral",
  "other",
];

const createSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().optional(),
  vehicleInterest: z.string().min(1),
  vehicleId: z.string(),
  /**
   * Module C · Phase 1 — required channel FK. The legacy `source` enum
   * is derived from the picked channel's slug on submit so existing
   * filters / activity log still work.
   */
  leadChannelId: z.string().min(1, "Please pick a channel"),
  /** Free-text clarification shown only when channel slug is "other". */
  channelOtherReason: z.string().optional(),
  assignedTo: z.string().min(1),
  notes: z.string().optional(),
});
type CreateInput = z.input<typeof createSchema>;
type CreateOutput = z.output<typeof createSchema>;

const apptSchema = z.object({
  date: z.string().min(1),
  time: z.string().min(1),
  specialRequirements: z.string().optional(),
});
type ApptInput = z.input<typeof apptSchema>;
type ApptOutput = z.output<typeof apptSchema>;

export default function LeadsPage() {
  const { user, company } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<LeadChannel[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [drillLead, setDrillLead] = useState<Lead | null>(null);
  const [creatingDeal, setCreatingDeal] = useState(false);

  // The role-based "New Lead" CTA navigates here with ?new=1 — auto-open the
  // create dialog so the CTA lands the user straight in the create flow.
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get("new") === "1") setCreateOpen(true);
  }, [searchParams]);

  const create = useForm<CreateInput, unknown, CreateOutput>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      vehicleInterest: "",
      vehicleId: "none",
      leadChannelId: "",
      channelOtherReason: "",
      assignedTo: "",
      notes: "",
    },
  });

  const appt = useForm<ApptInput, unknown, ApptOutput>({
    resolver: zodResolver(apptSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      time: "10:00",
      specialRequirements: "",
    },
  });

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      leadService.getAll(company.id),
      vehicleService.getAll(company.id),
      authService.getUsersForCompany(company.id),
      leadChannelService.getEnabled(company.id),
    ]).then(([l, v, u, c]) => {
      setLeads(l);
      setVehicles(v);
      setUsers(u);
      setChannels(c);
      const sales = u.find((x) => x.role === "sales");
      if (sales) create.setValue("assignedTo", sales.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const filtered = useMemo<LeadRow[] | null>(() => {
    if (!leads) return null;
    let out = [...leads];
    if (statusFilter !== "all") out = out.filter((l) => l.status === statusFilter);
    if (sourceFilter !== "all") out = out.filter((l) => l.source === sourceFilter);
    return out.map((l) => ({
      ...l,
      assigneeName: users.find((u) => u.id === l.assignedTo)?.name ?? "—",
    }));
  }, [leads, statusFilter, sourceFilter, users]);

  // Resolve channel by id for the Channel cell renderer.
  const channelById = useMemo<Map<UUID, LeadChannel>>(
    () => new Map(channels.map((c) => [c.id, c])),
    [channels],
  );

  const cols = useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        key: "customerName",
        label: "Customer",
        type: "text",
        sticky: true,
        width: 180,
      },
      { key: "customerPhone", label: "Phone", type: "phone", width: 140 },
      {
        key: "vehicleInterest",
        label: "Vehicle interest",
        type: "text",
        width: 240,
      },
      {
        key: "leadChannelId",
        label: "Channel",
        type: "custom",
        width: 150,
        render: (l) => {
          const ch = l.leadChannelId ? channelById.get(l.leadChannelId) : null;
          if (ch) return <ChannelChip channel={ch} compact />;
          // Legacy fallback — lead created before Module C; render the
          // raw `source` value muted so the row still has context.
          return (
            <span className="text-xs capitalize text-muted-foreground">
              {l.source.replace("_", " ")}
            </span>
          );
        },
      },
      { key: "status", label: "Status", type: "leadStatus", width: 150 },
      {
        key: "assignedTo",
        label: "Assigned",
        type: "user",
        width: 160,
        render: (l) => <UserCell name={l.assigneeName} />,
      },
      {
        key: "createdAt",
        label: "Created",
        type: "date",
        width: 120,
        get: (l) => l.createdAt.slice(0, 10),
      },
    ],
    [channelById],
  );

  // Collapsible grouping by lead status (ClickUp-style pipeline view).
  const { groups, isCollapsed, toggle } = useRowGroups(
    filtered ?? undefined,
    leadGroupBy,
    leadGroupLabel,
  );

  async function onCreate(values: CreateOutput) {
    if (!user || !company) return;

    // Derive the legacy lead.source enum from the picked channel's
    // slug so existing filters / activity-log strings keep working.
    // Non-matching slugs (e.g. "repeat_customer") collapse to "other".
    const channel = channels.find((c) => c.id === values.leadChannelId);
    const LEGACY_SOURCES: readonly LeadSource[] = [
      "website",
      "phone",
      "walk_in",
      "autotrader",
      "ebay",
      "facebook",
      "referral",
      "other",
    ];
    const slugAsSource = channel?.slug as LeadSource | undefined;
    const source: LeadSource =
      slugAsSource && LEGACY_SOURCES.includes(slugAsSource)
        ? slugAsSource
        : "other";

    // If "Other" was picked with a clarification, prefix it onto notes.
    const reason = values.channelOtherReason?.trim();
    const notes =
      channel?.slug === "other" && reason
        ? `Channel: ${reason}${values.notes ? `\n\n${values.notes}` : ""}`
        : values.notes || null;

    await leadService.create(
      {
        companyId: company.id,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail || null,
        vehicleInterest: values.vehicleInterest,
        vehicleId: values.vehicleId === "none" ? null : values.vehicleId,
        source,
        leadChannelId: values.leadChannelId,
        assignedTo: values.assignedTo,
        notes: notes || null,
      },
      user.id,
    );
    setLeads(await leadService.getAll(company.id));
    toast.success("Lead created");
    setCreateOpen(false);
    create.reset();
  }

  async function onBookAppt(values: ApptOutput) {
    if (!user || !company || !drillLead || !drillLead.vehicleId) return;
    await appointmentService.create({
      companyId: company.id,
      vehicleId: drillLead.vehicleId,
      leadId: drillLead.id,
      customerName: drillLead.customerName,
      customerPhone: drillLead.customerPhone,
      customerEmail: drillLead.customerEmail ?? "",
      date: values.date,
      time: values.time,
      specialRequirements: values.specialRequirements || null,
      createdBy: user.id,
    });
    toast.success("Appointment booked — WhatsApp + email sent ✓");
    setLeads(await leadService.getAll(company.id));
    setDrillLead(null);
    appt.reset();
  }

  // Convert a lead into a Deal (links lead → deal → vehicle) and open the
  // Pipeline. Requires a linked stock vehicle since a deal is vehicle-scoped.
  async function handleCreateDeal() {
    if (!user || !company || !drillLead || !drillLead.vehicleId) return;
    if (creatingDeal) return;
    setCreatingDeal(true);
    try {
      await salesService.create({
        companyId: company.id,
        vehicleId: drillLead.vehicleId,
        leadId: drillLead.id,
        customerName: drillLead.customerName,
        customerPhone: drillLead.customerPhone,
        customerEmail: drillLead.customerEmail ?? null,
        sellingAgent: drillLead.assignedTo,
      });
      toast.success("Deal ready — opening pipeline");
      setDrillLead(null);
      router.push("/sales/pipeline");
    } finally {
      setCreatingDeal(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Every new buyer enquiry in one list. Capture, assign, and follow up
            so no lead goes cold.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" />
              Create Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Lead</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={create.handleSubmit(onCreate)}
              className="grid gap-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input {...create.register("customerName")} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input {...create.register("customerPhone")} />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" {...create.register("customerEmail")} />
              </div>
              <div>
                <Label>Vehicle</Label>
                <Select
                  value={create.watch("vehicleId")}
                  onValueChange={(v) => {
                    create.setValue("vehicleId", v);
                    if (v !== "none") {
                      const veh = vehicles.find((x) => x.id === v);
                      if (veh)
                        create.setValue(
                          "vehicleInterest",
                          `${veh.make} ${veh.model} (${veh.registration})`,
                        );
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a stock vehicle (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / free text</SelectItem>
                    {vehicles
                      .filter((v) => v.status === "listed" || v.status === "ready")
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registration} — {v.make} {v.model}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vehicle interest</Label>
                <Input {...create.register("vehicleInterest")} />
              </div>
              <div>
                <Label>
                  Lead Channel <span className="text-destructive">*</span>
                </Label>
                <ChannelDropdown
                  channels={channels}
                  value={create.watch("leadChannelId") || undefined}
                  onValueChange={(id) =>
                    create.setValue("leadChannelId", id, { shouldValidate: true })
                  }
                  placeholder="Where did this lead come from?"
                  invalid={!!create.formState.errors.leadChannelId}
                />
                {create.formState.errors.leadChannelId ? (
                  <p className="mt-1 text-xs text-destructive">
                    {create.formState.errors.leadChannelId.message}
                  </p>
                ) : null}
                {/* "Other" clarification — appears only when "other" is picked */}
                {channels.find(
                  (c) => c.id === create.watch("leadChannelId"),
                )?.slug === "other" ? (
                  <Input
                    {...create.register("channelOtherReason")}
                    placeholder="How did they hear about us?"
                    className="mt-2"
                  />
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Assign to</Label>
                  <Select
                    value={create.watch("assignedTo")}
                    onValueChange={(v) => create.setValue("assignedTo", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea {...create.register("notes")} className="min-h-16" />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="appointment_booked">Appointment booked</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v as LeadSource | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!filtered ? (
        // Row-aware skeleton matching the table's column structure.
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              <DataGridSkeletonRows columns={cols} rows={6} />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No leads"
          description="When new enquiries land, they'll appear here."
        />
      ) : (
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              {(groups ?? []).map((g) => (
                <Fragment key={g.key}>
                  <DataGridGroupHeaderRow
                    label={g.label}
                    count={g.rows.length}
                    collapsed={isCollapsed(g.key)}
                    onToggle={() => toggle(g.key)}
                    span={cols.length}
                  />
                  {!isCollapsed(g.key) &&
                    g.rows.map((l, i) => (
                      <DataGridRow
                        key={l.id}
                        row={l}
                        cols={cols}
                        index={i}
                        onClick={(row) => setDrillLead(row)}
                      />
                    ))}
                </Fragment>
              ))}
              <DataGridTotalsRow
                cols={cols}
                total={(c) =>
                  c.key === "customerName"
                    ? `${filtered.length} lead${filtered.length === 1 ? "" : "s"}`
                    : null
                }
              />
              <DataGridFooterRow
                label="New lead"
                span={cols.length}
                onClick={() => setCreateOpen(true)}
              />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}

      {/* Drill modal */}
      <Dialog
        open={drillLead !== null}
        onOpenChange={(o) => {
          if (!o) setDrillLead(null);
        }}
      >
        <DialogContent className="max-w-md">
          {drillLead && (
            <>
              <DialogHeader>
                <DialogTitle>{drillLead.customerName}</DialogTitle>
                <DialogDescription>
                  {drillLead.customerPhone} ·{" "}
                  {drillLead.customerEmail ?? "no email"}
                </DialogDescription>
              </DialogHeader>
              {drillLead.vehicleId &&
                (() => {
                  const v = vehicles.find((x) => x.id === drillLead.vehicleId);
                  return v ? (
                    <VehicleImage vehicle={v} variant="card" />
                  ) : null;
                })()}
              <div className="grid gap-2 text-sm">
                <Field label="Vehicle of interest">
                  {drillLead.vehicleInterest}
                </Field>
                <Field label="Source" capitalize>
                  {drillLead.source.replace("_", " ")}
                </Field>
                <Field label="Status" capitalize>
                  {drillLead.status.replace("_", " ")}
                </Field>
                <Field label="Notes">{drillLead.notes ?? "—"}</Field>
              </div>
              {drillLead.vehicleId && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={creatingDeal}
                  onClick={() => void handleCreateDeal()}
                >
                  <Plus className="mr-1.5 h-4 w-4" />{" "}
                  {creatingDeal ? "Opening…" : "Create deal in pipeline"}
                </Button>
              )}
              {drillLead.status === "appointment_booked" ? (
                <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Appointment already booked.
                </p>
              ) : drillLead.vehicleId ? (
                <form
                  onSubmit={appt.handleSubmit(onBookAppt)}
                  className="grid gap-3 border-t pt-3"
                >
                  <h4 className="text-sm font-semibold">Schedule Test Drive</h4>
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Books a test-drive appointment + adds the event to the
                    Master Calendar (v4.1 §11.13).
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Date</Label>
                      <Input type="date" {...appt.register("date")} />
                    </div>
                    <div>
                      <Label>Time</Label>
                      <Input type="time" {...appt.register("time")} />
                    </div>
                  </div>
                  <div>
                    <Label>Special requirements</Label>
                    <Input {...appt.register("specialRequirements")} />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDrillLead(null)}
                    >
                      Close
                    </Button>
                    <Button type="submit">Book</Button>
                  </DialogFooter>
                </form>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Link this lead to a stock vehicle (via Edit) to book an appointment.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  capitalize,
}: {
  label: string;
  children: React.ReactNode;
  capitalize?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={capitalize ? "capitalize" : undefined}>{children}</div>
    </div>
  );
}
