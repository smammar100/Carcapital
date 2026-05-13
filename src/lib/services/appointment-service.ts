import { createClient, type TableUpdate } from "@/lib/supabase/client";
import type {
  Appointment,
  AppointmentOutcome,
  AppointmentStatus,
  UUID,
} from "@/lib/types";
import { activityService } from "./activity-service";
import { leadService } from "./lead-service";

const SELECT = `
  id,
  companyId:company_id,
  vehicleId:vehicle_id,
  leadId:lead_id,
  customerName:customer_name,
  customerPhone:customer_phone,
  customerEmail:customer_email,
  date,
  time,
  specialRequirements:special_requirements,
  status,
  outcome,
  notificationsSent:notifications_sent,
  createdBy:created_by,
  createdAt:created_at
`;

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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(SELECT)
      .eq("company_id", companyId)
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as Appointment[];
  },

  async getForDate(companyId: UUID, date: string): Promise<Appointment[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(SELECT)
      .eq("company_id", companyId)
      .eq("date", date);
    if (error) throw error;
    return (data ?? []) as unknown as Appointment[];
  },

  async getForVehicle(vehicleId: UUID): Promise<Appointment[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(SELECT)
      .eq("vehicle_id", vehicleId);
    if (error) throw error;
    return (data ?? []) as unknown as Appointment[];
  },

  async create(input: CreateInput): Promise<Appointment> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        company_id: input.companyId,
        vehicle_id: input.vehicleId,
        lead_id: input.leadId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail,
        date: input.date,
        time: input.time,
        special_requirements: input.specialRequirements,
        status: "upcoming",
        outcome: "pending",
        notifications_sent: { whatsapp: true, email: true },
        created_by: input.createdBy,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const appt = data as unknown as Appointment;
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

  async update(
    id: UUID,
    patch: Partial<
      Pick<
        Appointment,
        | "vehicleId"
        | "customerName"
        | "customerPhone"
        | "customerEmail"
        | "date"
        | "time"
        | "specialRequirements"
      >
    >,
    actorId: UUID,
  ): Promise<Appointment> {
    const supabase = createClient();
    const updates: TableUpdate<"appointments"> = {};
    if (patch.vehicleId !== undefined) updates.vehicle_id = patch.vehicleId;
    if (patch.customerName !== undefined) updates.customer_name = patch.customerName;
    if (patch.customerPhone !== undefined) updates.customer_phone = patch.customerPhone;
    if (patch.customerEmail !== undefined) updates.customer_email = patch.customerEmail;
    if (patch.date !== undefined) updates.date = patch.date;
    if (patch.time !== undefined) updates.time = patch.time;
    if (patch.specialRequirements !== undefined)
      updates.special_requirements = patch.specialRequirements;
    const { data, error } = await supabase
      .from("appointments")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const appt = data as unknown as Appointment;
    await activityService.log({
      companyId: appt.companyId,
      userId: actorId,
      vehicleId: appt.vehicleId,
      actionType: "appointment_updated",
      description: `Appointment updated: ${appt.customerName} on ${appt.date} ${appt.time}`,
      metadata: { appointmentId: id, fields: Object.keys(patch) },
    });
    return appt;
  },

  async setOutcome(
    id: UUID,
    outcome: AppointmentOutcome,
    actorId: UUID,
  ): Promise<Appointment> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({ outcome, status: "completed" })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const appt = data as unknown as Appointment;
    await activityService.log({
      companyId: appt.companyId,
      userId: actorId,
      vehicleId: appt.vehicleId,
      actionType: "appointment_completed",
      description: `${appt.customerName} — outcome: ${outcome.replace("_", " ")}`,
      metadata: { appointmentId: id, outcome },
    });
    return appt;
  },

  async setStatus(id: UUID, status: AppointmentStatus): Promise<Appointment> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as unknown as Appointment;
  },
};
