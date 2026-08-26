"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Appointment,
  AppointmentOutcome,
  UUID,
} from "@/lib/types";
import { appointmentService } from "@/lib/services/appointment-service";
import {
  checkReschedule,
  type SlotRef,
  type WorkingHours,
} from "@/lib/appointment-schedule";

const OUTCOMES: { value: AppointmentOutcome; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "test_drive", label: "Test drive" },
  { value: "offer_made", label: "Offer made" },
  { value: "deposit_taken", label: "Deposit taken" },
  { value: "sold", label: "Sold" },
  { value: "lost", label: "Lost" },
];

interface AppointmentEditDialogProps {
  appointment: Appointment | null;
  /** Every appointment in scope, for clash detection. */
  existing: SlotRef[];
  workingHours: WorkingHours;
  actorId: UUID;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Reschedule / correct an existing appointment (GEN-104).
 *
 * Appointments were previously create-only from this tab, so a viewing booked
 * at the wrong time — the single most routine change in a dealership — meant
 * cancelling and re-booking. Working hours are enforced here exactly as they
 * are on creation (GEN-83), otherwise the edit path quietly reopens that bug.
 */
export function AppointmentEditDialog(props: AppointmentEditDialogProps) {
  if (!props.appointment) return null;
  return (
    <AppointmentEditForm
      key={props.appointment.id}
      {...props}
      appointment={props.appointment}
    />
  );
}

function AppointmentEditForm({
  appointment,
  existing,
  workingHours,
  actorId,
  onOpenChange,
  onSaved,
}: AppointmentEditDialogProps & { appointment: Appointment }) {
  const [date, setDate] = useState(appointment.date.slice(0, 10));
  const [time, setTime] = useState(appointment.time.slice(0, 5));
  const [customerName, setCustomerName] = useState(appointment.customerName);
  const [customerPhone, setCustomerPhone] = useState(appointment.customerPhone);
  const [customerEmail, setCustomerEmail] = useState(appointment.customerEmail);
  const [notes, setNotes] = useState(appointment.specialRequirements ?? "");
  const [outcome, setOutcome] = useState<AppointmentOutcome>(appointment.outcome);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const check = checkReschedule(
    { id: appointment.id, date, time },
    existing,
    workingHours,
    undefined,
    { date: appointment.date, time: appointment.time },
  );

  async function handleSave() {
    if (!check.ok) {
      setError(check.error ?? "That slot is not available.");
      return;
    }

    setSaving(true);
    try {
      await appointmentService.update(
        appointment.id,
        {
          date,
          time,
          customerName,
          customerPhone,
          customerEmail,
          specialRequirements: notes.trim() === "" ? null : notes.trim(),
        },
        actorId,
      );

      // Outcome lives on its own service call because it also closes the
      // appointment — only send it when the user actually changed it.
      if (outcome !== appointment.outcome) {
        await appointmentService.setOutcome(appointment.id, outcome, actorId);
      }

      toast.success("Appointment updated");
      onSaved();
      onOpenChange(false);
    } catch {
      setError("Could not save the appointment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelAppointment() {
    setSaving(true);
    try {
      await appointmentService.setStatus(appointment.id, "cancelled");
      toast.success("Appointment cancelled");
      onSaved();
      onOpenChange(false);
    } catch {
      setError("Could not cancel the appointment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Edit appointment</DialogTitle>
          <DialogDescription>
            Reschedule, correct the customer&apos;s details, or record how it went.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">Date</Label>
              <Input
                id="appt-date"
                type="date"
                aria-label="Date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-time">Time</Label>
              <Input
                id="appt-time"
                type="time"
                aria-label="Time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-name">Customer</Label>
            <Input
              id="appt-name"
              aria-label="Customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-phone">Phone</Label>
              <Input
                id="appt-phone"
                aria-label="Phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-email">Email</Label>
              <Input
                id="appt-email"
                aria-label="Email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-outcome">Outcome</Label>
            <Select
              items={Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label]))}
              value={outcome}
              onValueChange={(v) => setOutcome(v as AppointmentOutcome)}
            >
              <SelectTrigger id="appt-outcome" aria-label="Outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-notes">Notes</Label>
            <Textarea
              id="appt-notes"
              aria-label="Notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* A clash is surfaced but not blocked — two salespeople can run
              parallel viewings; the requirement is that it is never silent. */}
          {!error && check.warning && (
            <p role="status" className="text-xs text-amber-600">
              {check.warning}
            </p>
          )}
          {(error || (!check.ok && check.error)) && (
            <p role="alert" className="text-xs text-destructive">
              {error ?? check.error}
            </p>
          )}
        </DialogPanel>

        <DialogFooter className="justify-between">
          <Button
            variant="destructive-outline"
            onClick={() => void handleCancelAppointment()}
            disabled={saving || appointment.status === "cancelled"}
          >
            Cancel appointment
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Close
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
