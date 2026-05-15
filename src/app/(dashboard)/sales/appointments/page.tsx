"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, Pencil, Plus, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type {
  Appointment,
  AppointmentOutcome,
  Vehicle,
} from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
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
import {
  Calendar,
  CalendarFilterChip,
  CalendarToolbar,
  type CalendarTone,
  type CalendarViewMode,
  type WeekCalendarEvent,
} from "@/components/shared/week-calendar";
import {
  type ColumnDef,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridSkeletonRows,
  DataGridTable,
  VehicleCell,
} from "@/components/data-grid";
import { formatDate, formatTime12 } from "@/lib/utils";
import { toast } from "sonner";

interface ApptRow extends Appointment {
  vehicle: Vehicle | null;
}

const STATUS_TONE: Record<string, CalendarTone> = {
  upcoming: "blue",
  completed: "emerald",
  cancelled: "slate",
  no_show: "rose",
};

const STATUS_DOT: Record<string, string> = {
  upcoming: "bg-[#0ea5e9]",
  completed: "bg-[#10b981]",
  cancelled: "bg-[#64748b]",
  no_show: "bg-[#f43f5e]",
};

const STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const schema = z.object({
  vehicleId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  specialRequirements: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const OUTCOMES: AppointmentOutcome[] = [
  "pending",
  "test_drive",
  "offer_made",
  "deposit_taken",
  "sold",
  "lost",
];

export default function AppointmentsPage() {
  const { user, company } = useAuth();
  const router = useRouter();
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [drill, setDrill] = useState<Appointment | null>(null);
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<CalendarViewMode>("weekly");
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({
    upcoming: true,
    completed: true,
    cancelled: true,
    no_show: true,
  });
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      date: new Date().toISOString().slice(0, 10),
      time: "10:00",
      specialRequirements: "",
    },
  });

  const editForm = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      date: "",
      time: "",
      specialRequirements: "",
    },
  });

  useEffect(() => {
    if (drill && editing) {
      editForm.reset({
        vehicleId: drill.vehicleId,
        customerName: drill.customerName,
        customerPhone: drill.customerPhone,
        customerEmail: drill.customerEmail,
        date: drill.date,
        time: drill.time,
        specialRequirements: drill.specialRequirements ?? "",
      });
    }
  }, [drill, editing, editForm]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      appointmentService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([a, v]) => {
      setAppts(a);
      setVehicles(v);
    });
  }, [company]);

  const apptRows = useMemo<ApptRow[] | null>(() => {
    if (!appts) return null;
    return appts.map((a) => ({
      ...a,
      vehicle: vehicles.find((v) => v.id === a.vehicleId) ?? null,
    }));
  }, [appts, vehicles]);

  const cols = useMemo<ColumnDef<ApptRow>[]>(
    () => [
      { key: "date", label: "Date", type: "date", width: 120 },
      {
        key: "time",
        label: "Time",
        type: "text",
        width: 90,
        render: (a) => (
          <span className="tabular-nums">{formatTime12(a.time)}</span>
        ),
      },
      {
        key: "customerName",
        label: "Customer",
        type: "text",
        sticky: true,
        width: 180,
      },
      {
        key: "vehicle",
        label: "Vehicle",
        type: "vehicle",
        width: 200,
        render: (a) => <VehicleCell vehicle={a.vehicle} />,
      },
      {
        key: "status",
        label: "Status",
        type: "appointmentStatus",
        width: 130,
      },
      {
        key: "outcome",
        label: "Outcome",
        type: "appointmentOutcome",
        width: 130,
      },
    ],
    [],
  );

  const events: WeekCalendarEvent[] = useMemo(() => {
    if (!appts) return [];
    return appts
      .filter((a) => statusFilters[a.status])
      .map((a) => {
        const start = new Date(`${a.date}T${a.time}:00`);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 60);
        const v = vehicles.find((x) => x.id === a.vehicleId);
        return {
          id: a.id,
          title: a.customerName,
          start,
          end,
          tone: STATUS_TONE[a.status] ?? "slate",
          meta: v?.registration,
          icon: "📅",
          vehicleId: v?.id,
          vehicleRegistration: v?.registration,
        } satisfies WeekCalendarEvent;
      });
  }, [appts, vehicles, statusFilters]);

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    await appointmentService.create({
      companyId: company.id,
      vehicleId: values.vehicleId,
      leadId: null,
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      customerEmail: values.customerEmail,
      date: values.date,
      time: values.time,
      specialRequirements: values.specialRequirements || null,
      createdBy: user.id,
    });
    setAppts(await appointmentService.getAll(company.id));
    toast.success("Booked — WhatsApp ✓ Email ✓");
    setOpen(false);
    form.reset();
  }

  async function handleOutcome(id: string, outcome: AppointmentOutcome) {
    if (!user || !company) return;
    await appointmentService.setOutcome(id, outcome, user.id);
    setAppts(await appointmentService.getAll(company.id));
    setDrill(null);
    toast.success(`Outcome: ${outcome.replace("_", " ")}`);
  }

  async function handleEdit(values: FormOutput) {
    if (!user || !company || !drill) return;
    const updated = await appointmentService.update(
      drill.id,
      {
        vehicleId: values.vehicleId,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail,
        date: values.date,
        time: values.time,
        specialRequirements: values.specialRequirements || null,
      },
      user.id,
    );
    setAppts(await appointmentService.getAll(company.id));
    setDrill(updated);
    setEditing(false);
    toast.success("Appointment updated");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            Customer test drives and viewings.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" />
              Book Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-3"
            >
              <div>
                <Label>Vehicle</Label>
                <Select
                  value={form.watch("vehicleId")}
                  onValueChange={(v) => form.setValue("vehicleId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a listed / ready vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles
                      .filter(
                        (v) =>
                          v.status === "listed" ||
                          v.status === "ready" ||
                          v.status === "reserved",
                      )
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registration} — {v.make} {v.model}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Customer name</Label>
                  <Input {...form.register("customerName")} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input {...form.register("customerPhone")} />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" {...form.register("customerEmail")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Date</Label>
                  <Input type="date" {...form.register("date")} />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input type="time" {...form.register("time")} />
                </div>
              </div>
              <div>
                <Label>Special requirements</Label>
                <Input {...form.register("specialRequirements")} />
              </div>
              <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                On book: WhatsApp ✓ Email ✓ (mocked)
              </p>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Book</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!appts ? (
        // Row-aware skeleton — same shape as the list tab's table.
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              <DataGridSkeletonRows columns={cols} rows={6} />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      ) : appts.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No appointments yet"
          description="Book one from a lead or directly here."
        />
      ) : (
        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar" className="mt-3">
            <Card className="overflow-hidden p-0" size="sm">
              <CalendarToolbar
                view={view}
                onViewChange={setView}
                currentDate={currentDate}
                onCurrentDateChange={setCurrentDate}
                rightSlot={
                  <>
                    {(
                      Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>
                    ).map((s) => (
                      <CalendarFilterChip
                        key={s}
                        checked={!!statusFilters[s]}
                        onChange={(c) =>
                          setStatusFilters((f) => ({ ...f, [s]: c }))
                        }
                        label={STATUS_LABEL[s]}
                        dotClass={STATUS_DOT[s]}
                      />
                    ))}
                    <button
                      type="button"
                      aria-label="Search appointments"
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <Search className="size-4" />
                    </button>
                  </>
                }
              />
              <Calendar
                view={view}
                events={events}
                currentDate={currentDate}
                onCurrentDateChange={setCurrentDate}
                onSelectEvent={(e) => {
                  const a = appts.find((x) => x.id === e.id);
                  if (a) setDrill(a);
                }}
              />
            </Card>
          </TabsContent>
          <TabsContent value="list" className="mt-3">
            <DataGridShell>
              <DataGridTable cols={cols}>
                <DataGridHeaderRow cols={cols} />
                <tbody>
                  {(apptRows ?? []).map((a, i) => (
                    <DataGridRow
                      key={a.id}
                      row={a}
                      cols={cols}
                      index={i}
                      onClick={(row) => setDrill(row)}
                    />
                  ))}
                </tbody>
              </DataGridTable>
            </DataGridShell>
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={drill !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDrill(null);
            setEditing(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          {drill && !editing && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3 pr-10">
                  <DialogTitle className="flex-1 truncate">
                    {drill.customerName}
                  </DialogTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </DialogHeader>
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">When: </span>
                  {formatDate(drill.date)} · {formatTime12(drill.time)}
                </div>
                <div>
                  <span className="text-muted-foreground">Vehicle: </span>
                  {vehicles.find((v) => v.id === drill.vehicleId)
                    ?.registration ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  {drill.customerPhone}
                </div>
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  {drill.customerEmail}
                </div>
                {drill.specialRequirements && (
                  <div>
                    <span className="text-muted-foreground">Notes: </span>
                    {drill.specialRequirements}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  WhatsApp {drill.notificationsSent.whatsapp ? "✓" : "✗"} ·
                  Email {drill.notificationsSent.email ? "✓" : "✗"}
                </div>
              </div>
              <div>
                <Label>Set outcome</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTCOMES.map((o) => (
                    <Button
                      key={o}
                      type="button"
                      size="sm"
                      variant={o === drill.outcome ? "default" : "outline"}
                      onClick={() => void handleOutcome(drill.id, o)}
                    >
                      {o.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    const id = drill.vehicleId;
                    setDrill(null);
                    router.push(`/vehicles/${id}`);
                  }}
                >
                  View Vehicle
                </Button>
              </DialogFooter>
            </>
          )}
          {drill && editing && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Appointment</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={editForm.handleSubmit(handleEdit)}
                className="grid gap-3"
              >
                <div>
                  <Label>Vehicle</Label>
                  <Select
                    value={editForm.watch("vehicleId")}
                    onValueChange={(v) => editForm.setValue("vehicleId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registration} — {v.make} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Customer name</Label>
                    <Input {...editForm.register("customerName")} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input {...editForm.register("customerPhone")} />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    {...editForm.register("customerEmail")}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" {...editForm.register("date")} />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input type="time" {...editForm.register("time")} />
                  </div>
                </div>
                <div>
                  <Label>Special requirements</Label>
                  <Input {...editForm.register("specialRequirements")} />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

