"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Plus } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { VehicleImage } from "@/components/shared/vehicle-image";
import {
  BigCalendar,
  type CalendarEvent,
} from "@/components/shared/big-calendar";
import { formatDate, formatTime12 } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  upcoming: "#3b82f6",
  completed: "#10b981",
  cancelled: "#94a3b8",
  no_show: "#ef4444",
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
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [drill, setDrill] = useState<Appointment | null>(null);

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

  const events: CalendarEvent[] = useMemo(() => {
    if (!appts) return [];
    return appts.map((a) => {
      const start = new Date(`${a.date}T${a.time}:00`);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 60);
      const v = vehicles.find((x) => x.id === a.vehicleId);
      return {
        id: a.id,
        title: `${a.customerName} · ${v?.registration ?? "—"}`,
        start,
        end,
        resource: { kind: "appointment", color: STATUS_COLOR[a.status] },
      };
    });
  }, [appts, vehicles]);

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
        <Skeleton className="h-72" />
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
            <Card className="p-3">
              <BigCalendar
                events={events}
                onSelectEvent={(e) => {
                  const id = (e as CalendarEvent).id;
                  const a = appts.find((x) => x.id === id);
                  if (a) setDrill(a);
                }}
              />
            </Card>
          </TabsContent>
          <TabsContent value="list" className="mt-3">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appts.map((a) => {
                    const v = vehicles.find((x) => x.id === a.vehicleId);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>{formatDate(a.date)}</TableCell>
                        <TableCell>{formatTime12(a.time)}</TableCell>
                        <TableCell className="font-medium">
                          {a.customerName}
                        </TableCell>
                        <TableCell>
                          {v ? (
                            <Link
                              href={`/vehicles/${v.id}`}
                              className="flex items-center gap-2 hover:underline"
                            >
                              <VehicleImage
                                vehicle={v}
                                variant="thumb"
                                className="w-12"
                              />
                              <RegPlate
                                registration={v.registration}
                                size="sm"
                              />
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {a.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {a.outcome.replace("_", " ")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDrill(a)}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={drill !== null}
        onOpenChange={(o) => {
          if (!o) setDrill(null);
        }}
      >
        <DialogContent className="max-w-md">
          {drill && (
            <>
              <DialogHeader>
                <DialogTitle>{drill.customerName}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">When: </span>
                  {formatDate(drill.date)} · {formatTime12(drill.time)}
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
