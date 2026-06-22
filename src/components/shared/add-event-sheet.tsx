"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Car,
  Clock,
  FileText,
  Search,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { workshopService } from "@/lib/services/workshop-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/toast";
export type EventKind = "appointment" | "workshop" | "maintenance";

export interface EventDraft {
  kind: EventKind;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** HH:mm */
  fromTime: string;
  /** HH:mm */
  toTime: string;
  allDay: boolean;
}

const KIND_DOT: Record<EventKind, string> = {
  appointment: "bg-sky-500",
  workshop: "bg-amber-500",
  maintenance: "bg-violet-500",
};

const KINDS: { key: EventKind; label: string }[] = [
  { key: "appointment", label: "Appointment" },
  { key: "workshop", label: "Workshop" },
  { key: "maintenance", label: "Maintenance" },
];

interface AddEventSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill from a clicked / dragged calendar slot. */
  defaultDraft?: EventDraft | null;
  /** Lock the event kind (e.g. the Appointments page only books appointments). */
  lockKind?: EventKind;
  onCreated?: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function durationHours(from: string, to: string): number {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const minutes = th * 60 + tm - (fh * 60 + fm);
  return Math.max(1, Math.round(minutes / 60));
}

/** Default draft when the sheet is opened without a slot (e.g. an Add button). */
function fallbackDraft(lockKind?: EventKind): EventDraft {
  return {
    kind: lockKind ?? "appointment",
    title: "",
    date: toIsoDate(new Date()),
    fromTime: "09:00",
    toTime: "10:00",
    allDay: false,
  };
}

export function AddEventSheet({
  open,
  onOpenChange,
  defaultDraft,
  lockKind,
  onCreated,
}: AddEventSheetProps) {
  const { user, company } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [kind, setKind] = useState<EventKind>(lockKind ?? "appointment");
  const [title, setTitle] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("10:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!company || !open) return;
    void vehicleService.getAll(company.id).then(setVehicles);
  }, [company, open]);

  // Seed the form each time the sheet opens, from the slot draft if present.
  useEffect(() => {
    if (!open) return;
    const seed = defaultDraft ?? fallbackDraft(lockKind);
    setKind(lockKind ?? seed.kind);
    setTitle(seed.title);
    setVehicleId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setDate(seed.date);
    setFromTime(seed.fromTime);
    setToTime(seed.toTime);
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  const selectedVehicle =
    vehicles.find((v) => v.id === vehicleId) ?? null;

  async function handleSave() {
    if (!user || !company) return;
    if (!vehicleId) {
      notify.error("Select a vehicle");
      return;
    }
    if (kind === "appointment" && !customerName.trim()) {
      notify.error("Customer name is required");
      return;
    }
    setSubmitting(true);
    try {
      if (kind === "appointment") {
        await appointmentService.create({
          companyId: company.id,
          vehicleId,
          leadId: null,
          customerName: customerName.trim(),
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
            customerName: customerName.trim() || "Walk-in",
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
      notify.success(
        kind === "appointment" ? "Appointment booked" : "Event created",
      );
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not create event");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <SheetTitle className="text-base">New event</SheetTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            className="h-11 border-0 px-0 text-base font-medium shadow-none focus-visible:ring-0"
          />

          <div className="mt-1 divide-y">
            {/* Kind */}
            {!lockKind ? (
              <FieldRow icon={Tag}>
                <div className="grid grid-cols-3 gap-1.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => setKind(k.key)}
                      className={cn(
                        "flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                        kind === k.key
                          ? "border-foreground/20 bg-muted text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          KIND_DOT[k.key],
                        )}
                      />
                      <span className="truncate">{k.label}</span>
                    </button>
                  ))}
                </div>
              </FieldRow>
            ) : null}

            {/* Vehicle */}
            <FieldRow icon={Car}>
              <Combobox
                items={eligibleVehicles}
                value={selectedVehicle}
                onValueChange={(v: Vehicle | null) =>
                  setVehicleId(v?.id ?? "")
                }
                itemToStringLabel={(v: Vehicle) =>
                  `${v.registration} — ${v.make} ${v.model}`
                }
              >
                <ComboboxInput
                  placeholder="Search registration…"
                  startAddon={<Search />}
                  className="w-full"
                />
                <ComboboxPopup>
                  <ComboboxEmpty>No vehicles match.</ComboboxEmpty>
                  <ComboboxList>
                    {(v: Vehicle) => (
                      <ComboboxItem key={v.id} value={v}>
                        {v.registration} — {v.make} {v.model}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </Combobox>
            </FieldRow>

            {/* Date */}
            <FieldRow icon={CalendarIcon}>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10"
              />
            </FieldRow>

            {/* Time range */}
            <FieldRow icon={Clock}>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="h-10 min-w-0 flex-1"
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  to
                </span>
                <Input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="h-10 min-w-0 flex-1"
                />
              </div>
            </FieldRow>

            {/* Customer (appointments) */}
            {kind === "appointment" ? (
              <FieldRow icon={User}>
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-10"
                  />
                  <Input
                    placeholder="Phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-10"
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-10"
                  />
                </div>
              </FieldRow>
            ) : null}

            {/* Notes */}
            <FieldRow icon={FileText}>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes…"
                rows={4}
                className="resize-none"
              />
            </FieldRow>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Discard"
            onClick={() => onOpenChange(false)}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={submitting}
            onClick={() => void handleSave()}
          >
            {submitting ? "Saving…" : "Create event"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** One icon-gutter row: a muted leading icon + the field(s). */
function FieldRow({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-3">
      <Icon className="mt-2 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
