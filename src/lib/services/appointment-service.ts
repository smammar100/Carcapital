import { mockAppointments } from "@/lib/mock-data";
import type {
  Appointment,
  AppointmentOutcome,
  AppointmentStatus,
  UUID,
} from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { leadService } from "./lead-service";

interface CreateInput {
  companyId: UUID;
  vehicleId: UUID;
  leadId: UUID | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: string;
  time: string;
  specialRequirements: string | null;
  createdBy: UUID;
}

export const appointmentService = {
  async getAll(companyId: UUID): Promise<Appointment[]> {
    // TODO: Supabase: from('appointments').select('*').eq('company_id', companyId)
    await delay();
    return mockAppointments
      .filter((a) => a.companyId === companyId)
      .sort((a, b) =>
        a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
      );
  },

  async getForDate(companyId: UUID, date: string): Promise<Appointment[]> {
    // TODO: Supabase: ... .eq('date', date)
    await delay(150);
    return mockAppointments.filter(
      (a) => a.companyId === companyId && a.date === date,
    );
  },

  async getForVehicle(vehicleId: UUID): Promise<Appointment[]> {
    // TODO: Supabase: ... .eq('vehicle_id', vehicleId)
    await delay();
    return mockAppointments.filter((a) => a.vehicleId === vehicleId);
  },

  async create(input: CreateInput): Promise<Appointment> {
    // TODO: Supabase: insert + log + (real) WhatsApp/email
    await delay();
    const appt: Appointment = {
      id: newId("appt"),
      companyId: input.companyId,
      vehicleId: input.vehicleId,
      leadId: input.leadId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      date: input.date,
      time: input.time,
      specialRequirements: input.specialRequirements,
      status: "upcoming",
      outcome: "pending",
      // mock: pretend WhatsApp + email both fire successfully
      notificationsSent: { whatsapp: true, email: true },
      createdBy: input.createdBy,
      createdAt: nowIso(),
    };
    mockAppointments.push(appt);
    if (input.leadId) {
      await leadService.update(input.leadId, {
        status: "appointment_booked",
        appointmentId: appt.id,
      });
    }
    await activityService.log({
      companyId: input.companyId,
      userId: input.createdBy,
      vehicleId: input.vehicleId,
      actionType: "appointment_booked",
      description: `Appointment booked: ${input.customerName} on ${input.date} ${input.time}`,
      metadata: { appointmentId: appt.id },
    });
    return appt;
  },

  async setOutcome(
    id: UUID,
    outcome: AppointmentOutcome,
    actorId: UUID,
  ): Promise<Appointment> {
    // TODO: Supabase: update outcome + status='completed'
    await delay();
    const idx = mockAppointments.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Appointment not found");
    mockAppointments[idx] = {
      ...mockAppointments[idx],
      outcome,
      status: "completed",
    };
    await activityService.log({
      companyId: mockAppointments[idx].companyId,
      userId: actorId,
      vehicleId: mockAppointments[idx].vehicleId,
      actionType: "appointment_completed",
      description: `${mockAppointments[idx].customerName} — outcome: ${outcome.replace("_", " ")}`,
      metadata: { appointmentId: id, outcome },
    });
    return mockAppointments[idx];
  },

  async setStatus(id: UUID, status: AppointmentStatus): Promise<Appointment> {
    // TODO: Supabase: update
    await delay();
    const idx = mockAppointments.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Appointment not found");
    mockAppointments[idx] = { ...mockAppointments[idx], status };
    return mockAppointments[idx];
  },
};
