"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Repeat,
  Save,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { workshopService } from "@/lib/services/workshop-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type EventKind = "appointment" | "workshop" | "maintenance";

type EventCategory = {
  key: EventKind;
  label: string;
  swatchClass: string;
};

const CATEGORIES: EventCategory[] = [
  { key: "appointment", label: "Appointment", swatchClass: "bg-[#0ea5e9]" },
  { key: "workshop", label: "Workshop walk-in", swatchClass: "bg-[#f59e0b]" },
  { key: "maintenance", label: "Maintenance job", swatchClass: "bg-[#a855f7]" },
];

interface AddEventSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  onCreated?: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatLongDate(iso: string): string {
  const [y, m, dd] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  return d.toLocaleDateString("en-GB", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function AddEventSheet({
  open,
  onOpenChange,
  defaultDate,
  onCreated,
}: AddEventSheetProps) {
  const { user, company } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [kind, setKind] = useState<EventKind>("appointment");
  const [title, setTitle] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [date, setDate] = useState(() => toIsoDate(defaultDate ?? new Date()));
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("10:00");
  const [recurrence, setRecurrence] = useState("none");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!company || !open) return;
    void vehicleService.getAll(company.id).then(setVehicles);
  }, [company, open]);

  useEffect(() => {
    if (defaultDate) setDate(toIsoDate(defaultDate));
  }, [defaultDate]);

  function reset() {
    setKind("appointment");
    setTitle("");
    setVehicleId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setFromTime("09:00");
    setToTime("10:00");
    setRecurrence("none");
    setNotes("");
  }

  async function handleSave() {
    if (!user || !company) return;
    if (!vehicleId) {
      toast.error("Select a vehicle");
      return;
    }
    setSubmitting(true);
    try {
      if (kind === "appointment") {
        if (!customerName) {
          toast.error("Customer name required");
          setSubmitting(false);
          return;
        }
        await appointmentService.create({
          companyId: company.id,
          vehicleId,
          leadId: null,
          customerName,
          customerPhone,
          customerEmail,
          date,
          time: fromTime,
          specialRequirements: notes || null,
          createdBy: user.id,
        });
      } else if (kind === "workshop") {
        const v = vehicles.find((x) => x.id === vehicleId);
        await workshopService.create(
          {
            companyId: company.id,
            customerName: customerName || "Walk-in",
            customerPhone: customerPhone || "",
            vehicleReg: v?.registration ?? "",
            vehicleDescription: v ? `${v.make} ${v.model}` : "",
            description: title || "Workshop visit",
            assignedTo: null,
            estimatedCost: null,
            scheduledDate: date,
            scheduledTime: fromTime,
            notes: notes || null,
          },
          user.id,
        );
      } else {
        await maintenanceService.create(
          {
            companyId: company.id,
            vehicleId,
            description: title || "New maintenance job",
            assignedTo: null,
            vendorId: null,
            estimatedCost: null,
            estimatedDurationHours: durationHours(fromTime, toTime),
            startDate: null,
            dueDate: date,
            notes: notes || null,
          },
          user.id,
        );
      }
      toast.success("Event created");
      reset();
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create event");
    } finally {
      setSubmitting(false);
    }
  }

  const category = useMemo(
    () => CATEGORIES.find((c) => c.key === kind) ?? CATEGORIES[0],
    [kind],
  );
  const eligibleVehicles = useMemo(() => {
    if (kind === "appointment") {
      return vehicles.filter(
        (v) =>
          v.status === "listed" ||
          v.status === "ready" ||
          v.status === "reserved",
      );
    }
    return vehicles;
  }, [vehicles, kind]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="sm:max-w-[400px] gap-0 p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h2 className="text-h3 font-bold text-foreground">Add Event</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title (e.g. Test drive)"
              className="h-11 rounded-md text-sm font-medium"
            />

            <FieldCard>
              <div className="flex items-center gap-2 px-3 py-3">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Date and Time
                </span>
              </div>
              <div className="border-t" />
              <div className="flex flex-col gap-3 px-3 py-3">
                <FieldRow label="On">
                  <div className="relative flex-1">
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-10 rounded-md pr-9 text-sm font-medium"
                    />
                    <CalendarIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </FieldRow>
                <FieldRow label="From">
                  <Input
                    type="time"
                    value={fromTime}
                    onChange={(e) => setFromTime(e.target.value)}
                    className="h-10 flex-1 rounded-md text-sm font-medium"
                  />
                </FieldRow>
                <FieldRow label="To">
                  <Input
                    type="time"
                    value={toTime}
                    onChange={(e) => setToTime(e.target.value)}
                    className="h-10 flex-1 rounded-md text-sm font-medium"
                  />
                </FieldRow>
                <FieldRow label="Vehicle">
                  <Select value={vehicleId} onValueChange={setVehicleId}>
                    <SelectTrigger className="h-10 flex-1 rounded-md text-sm font-medium">
                      <SelectValue placeholder="Pick a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleVehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registration} — {v.make} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
            </FieldCard>

            <FieldCard>
              <div className="flex items-center gap-2 px-3 py-3">
                <Repeat className="size-4 text-muted-foreground" />
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger className="border-0 px-0 shadow-none h-auto py-0 text-sm font-medium text-muted-foreground focus-visible:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Does not repeat</SelectItem>
                    <SelectItem value="daily">Everyday</SelectItem>
                    <SelectItem value="weekly">Every week</SelectItem>
                    <SelectItem value="monthly">Every month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FieldCard>

            {kind === "appointment" ? (
              <FieldCard>
                <div className="flex items-center gap-2 px-3 py-3">
                  <Video className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Customer
                  </span>
                </div>
                <div className="border-t" />
                <div className="flex flex-col gap-3 px-3 py-3">
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-10 rounded-md text-sm font-medium"
                  />
                  <Input
                    placeholder="Phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-10 rounded-md text-sm font-medium"
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-10 rounded-md text-sm font-medium"
                  />
                </div>
              </FieldCard>
            ) : null}

            <FieldCard
              className={cn(
                "border-2",
                kind === "appointment" && "border-[#0ea5e9]/60",
                kind === "workshop" && "border-[#f59e0b]/60",
                kind === "maintenance" && "border-[#a855f7]/60",
              )}
            >
              <div className="flex flex-col gap-2 px-3 py-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Set calendar or event
                  </span>
                </div>
                <div className="flex flex-col">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setKind(cat.key)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                        kind === cat.key
                          ? "bg-muted"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "size-3.5 shrink-0 rounded-[3px]",
                          cat.swatchClass,
                        )}
                      />
                      <span className="flex-1 text-sm font-semibold text-foreground">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </FieldCard>

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={6}
              className="resize-none rounded-md bg-muted/40 text-sm font-medium"
            />

            <div className="text-[11px] text-muted-foreground">
              Selected calendar:{" "}
              <span className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    "inline-block size-2.5 rounded-[2px]",
                    category.swatchClass,
                  )}
                />
                <span className="font-medium text-foreground">
                  {category.label}
                </span>
              </span>{" "}
              · {formatLongDate(date)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Discard"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1"
            onClick={() => {
              const [h, m] = fromTime.split(":").map(Number);
              const next = new Date();
              next.setHours(h + 1, m, 0, 0);
              setFromTime(`${pad(next.getHours())}:${pad(next.getMinutes())}`);
              const endH = next.getHours() + 1;
              setToTime(`${pad(endH)}:${pad(next.getMinutes())}`);
            }}
          >
            <Clock className="size-4" />
            Reschedule
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 gap-1"
            disabled={submitting}
            onClick={() => void handleSave()}
          >
            <Save className="size-4" />
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-background shadow-[0_1px_1px_rgba(18,18,18,0.05)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-sm font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function durationHours(from: string, to: string): number {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const minutes = th * 60 + tm - (fh * 60 + fm);
  return Math.max(1, Math.round(minutes / 60));
}
