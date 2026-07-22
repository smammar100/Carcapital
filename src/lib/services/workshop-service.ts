import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { MaintenanceStatus, UUID, WorkshopJob } from "@/lib/types";
import { activityService } from "./activity-service";

const NS = "workshop:";

const SELECT = `
  id,
  companyId:company_id,
  customerName:customer_name,
  customerPhone:customer_phone,
  vehicleReg:vehicle_reg,
  vehicleDescription:vehicle_description,
  description,
  assignedTo:assigned_to,
  estimatedCost:estimated_cost,
  actualCost:actual_cost,
  scheduledDate:scheduled_date,
  scheduledTime:scheduled_time,
  completedDate:completed_date,
  status,
  notes,
  createdAt:created_at
`;

interface CreateInput {
  companyId: UUID;
  customerName: string;
  customerPhone: string;
  vehicleReg: string;
  vehicleDescription: string;
  description: string;
  assignedTo: UUID | null;
  estimatedCost: number | null;
  scheduledDate: string;
  scheduledTime: string;
  notes: string | null;
}

export const workshopService = {
  async getAll(companyId: UUID): Promise<WorkshopJob[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workshop_jobs")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WorkshopJob[];
    });
  },

  async getForDate(companyId: UUID, date: string): Promise<WorkshopJob[]> {
    return withCache(`${NS}date:${companyId}:${date}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workshop_jobs")
        .select(SELECT)
        .eq("company_id", companyId)
        .eq("scheduled_date", date);
      if (error) throw error;
      return (data ?? []) as unknown as WorkshopJob[];
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<WorkshopJob> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("workshop_jobs")
      .insert({
        company_id: input.companyId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        vehicle_reg: input.vehicleReg.toUpperCase(),
        vehicle_description: input.vehicleDescription,
        description: input.description,
        assigned_to: input.assignedTo,
        estimated_cost: input.estimatedCost,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime,
        status: "pending",
        notes: input.notes,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const job = data as unknown as WorkshopJob;
    invalidate(NS);
    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "workshop_job_created",
      description: `Walk-in workshop job: ${input.customerName} (${input.description})`,
      metadata: { jobId: job.id, vehicleReg: input.vehicleReg },
    });
    return job;
  },

  async update(
    id: UUID,
    patch: Partial<
      Pick<
        WorkshopJob,
        | "customerName"
        | "customerPhone"
        | "vehicleReg"
        | "vehicleDescription"
        | "description"
        | "estimatedCost"
        | "scheduledDate"
        | "scheduledTime"
        | "notes"
        | "assignedTo"
      >
    >,
  ): Promise<WorkshopJob> {
    const supabase = createClient();
    const updates: TableUpdate<"workshop_jobs"> = {};
    if (patch.customerName !== undefined) updates.customer_name = patch.customerName;
    if (patch.customerPhone !== undefined) updates.customer_phone = patch.customerPhone;
    if (patch.vehicleReg !== undefined)
      updates.vehicle_reg = patch.vehicleReg.toUpperCase();
    if (patch.vehicleDescription !== undefined)
      updates.vehicle_description = patch.vehicleDescription;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.estimatedCost !== undefined) updates.estimated_cost = patch.estimatedCost;
    if (patch.scheduledDate !== undefined) updates.scheduled_date = patch.scheduledDate;
    if (patch.scheduledTime !== undefined) updates.scheduled_time = patch.scheduledTime;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.assignedTo !== undefined) updates.assigned_to = patch.assignedTo;

    const { data, error } = await supabase
      .from("workshop_jobs")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as WorkshopJob;
  },

  async updateStatus(
    id: UUID,
    status: MaintenanceStatus,
  ): Promise<WorkshopJob> {
    const supabase = createClient();
    const updates: TableUpdate<"workshop_jobs"> = { status };
    if (status === "completed") {
      updates.completed_date = new Date().toISOString().slice(0, 10);
    } else {
      // Moving back to pending/in_progress/stalled clears the completion date.
      updates.completed_date = null;
    }
    const { data, error } = await supabase
      .from("workshop_jobs")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as WorkshopJob;
  },

  /** Permanently delete a workshop job. */
  async remove(id: UUID): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("workshop_jobs")
      .delete()
      .eq("id", id);
    if (error) throw error;
    invalidate(NS);
  },
};
