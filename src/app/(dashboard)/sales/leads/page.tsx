"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { leadService } from "@/lib/services/lead-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { authService } from "@/lib/services/auth-service";
import { appointmentService } from "@/lib/services/appointment-service";
import type {
  Lead,
  LeadSource,
  LeadStatus,
  User,
  Vehicle,
} from "@/lib/types";
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
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridSkeletonRows,
  DataGridTable,
  UserCell,
} from "@/components/data-grid";
import { toast } from "sonner";

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
  source: z.enum([
    "website",
    "phone",
    "walk_in",
    "autotrader",
    "ebay",
    "facebook",
    "referral",
    "other",
  ]),
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
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [drillLead, setDrillLead] = useState<Lead | null>(null);

  const create = useForm<CreateInput, unknown, CreateOutput>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      vehicleInterest: "",
      vehicleId: "none",
      source: "website",
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
    ]).then(([l, v, u]) => {
      setLeads(l);
      setVehicles(v);
      setUsers(u);
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
      { key: "source", label: "Source", type: "select", width: 130 },
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
    [],
  );

  async function onCreate(values: CreateOutput) {
    if (!user || !company) return;
    await leadService.create(
      {
        companyId: company.id,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail || null,
        vehicleInterest: values.vehicleInterest,
        vehicleId: values.vehicleId === "none" ? null : values.vehicleId,
        source: values.source,
        assignedTo: values.assignedTo,
        notes: values.notes || null,
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {filtered ? `${filtered.length} matching` : "Loading…"}
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Source</Label>
                  <Select
                    value={create.watch("source")}
                    onValueChange={(v) => create.setValue("source", v as LeadSource)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              {filtered.map((l, i) => (
                <DataGridRow
                  key={l.id}
                  row={l}
                  cols={cols}
                  index={i}
                  onClick={(row) => setDrillLead(row)}
                />
              ))}
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
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={capitalize ? "capitalize" : undefined}>{children}</div>
    </div>
  );
}
