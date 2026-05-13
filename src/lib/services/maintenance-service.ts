import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { MaintenanceJob, MaintenanceStatus, UUID } from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

const NS = "maintenance:";

const SELECT = `
  id,
  companyId:company_id,
  vehicleId:vehicle_id,
  description,
  assignedTo:assigned_to,
  vendorId:vendor_id,
  estimatedCost:estimated_cost,
  actualCost:actual_cost,
  estimatedDurationHours:estimated_duration_hours,
  startDate:start_date,
  dueDate:due_date,
  completedDate:completed_date,
  status,
  notes,
  createdAt:created_at
`;

interface CreateInput {
  companyId: UUID;
  vehicleId: UUID;
  description: string;
  assignedTo: UUID | null;
  vendorId: UUID | null;
  estimatedCost: number | null;
  estimatedDurationHours: number | null;
  startDate: string | null;
  dueDate: string | null;
  notes: string | null;
}

export const maintenanceService = {
  async getAll(companyId: UUID): Promise<MaintenanceJob[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("maintenance_jobs")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as MaintenanceJob[];
    });
  },

  async getForDate(companyId: UUID, date: string): Promise<MaintenanceJob[]> {
    return withCache(`${NS}date:${companyId}:${date}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("maintenance_jobs")
        .select(SELECT)
        .eq("company_id", companyId)
        .eq("due_date", date);
      if (error) throw error;
      return (data ?? []) as unknown as MaintenanceJob[];
    });
  },

  async getForVehicle(vehicleId: UUID): Promise<MaintenanceJob[]> {
    return withCache(`${NS}vehicle:${vehicleId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("maintenance_jobs")
        .select(SELECT)
        .eq("vehicle_id", vehicleId);
      if (error) throw error;
      return (data ?? []) as unknown as MaintenanceJob[];
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<MaintenanceJob> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("maintenance_jobs")
      .insert({
        company_id: input.companyId,
        vehicle_id: input.vehicleId,
        description: input.description,
        assigned_to: input.assignedTo,
        vendor_id: input.vendorId,
        estimated_cost: input.estimatedCost,
        estimated_duration_hours: input.estimatedDurationHours,
        start_date: input.startDate,
        due_date: input.dueDate,
        status: "pending",
        notes: input.notes,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const job = data as unknown as MaintenanceJob;
    invalidate(NS);
    const v = await vehicleService.getById(input.vehicleId);
    if (v) {
      await activityService.log({
        companyId: input.companyId,
        userId: actorId,
        vehicleId: v.id,
        actionType: "maintenance_job_created",
        description: `Maintenance job created for ${v.registration}: ${input.description}`,
        metadata: { jobId: job.id },
      });
    }
    return job;
  },

  async update(
    id: UUID,
    patch: Partial<
      Pick<
        MaintenanceJob,
        | "vehicleId"
        | "description"
        | "estimatedDurationHours"
        | "estimatedCost"
        | "startDate"
        | "dueDate"
        | "notes"
        | "assignedTo"
        | "vendorId"
      >
    >,
    actorId: UUID,
  ): Promise<MaintenanceJob> {
    const supabase = createClient();
    const updates: TableUpdate<"maintenance_jobs"> = {};
    if (patch.vehicleId !== undefined) updates.vehicle_id = patch.vehicleId;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.estimatedDurationHours !== undefined)
      updates.estimated_duration_hours = patch.estimatedDurationHours;
    if (patch.estimatedCost !== undefined)
      updates.estimated_cost = patch.estimatedCost;
    if (patch.startDate !== undefined) updates.start_date = patch.startDate;
    if (patch.dueDate !== undefined) updates.due_date = patch.dueDate;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.assignedTo !== undefined) updates.assigned_to = patch.assignedTo;
    if (patch.vendorId !== undefined) updates.vendor_id = patch.vendorId;

    const { data, error } = await supabase
      .from("maintenance_jobs")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    await supabase.from("maintenance_job_notes").insert({
      job_id: id,
      user_id: actorId,
      note_type: "note",
      content: `Job updated (${Object.keys(patch).join(", ")})`,
    });
    return data as unknown as MaintenanceJob;
  },

  async updateStatus(
    id: UUID,
    status: MaintenanceStatus,
    actorId: UUID,
  ): Promise<MaintenanceJob> {
    const supabase = createClient();
    const { data: prev } = await supabase
      .from("maintenance_jobs")
      .select(SELECT)
      .eq("id", id)
      .single();
    if (!prev) throw new Error("Job not found");
    const previousJob = prev as unknown as MaintenanceJob;
    const previousStatus = previousJob.status;
    const becameCompleted =
      status === "completed" && previousStatus !== "completed";

    const updates: TableUpdate<"maintenance_jobs"> = { status };
    if (becameCompleted) {
      updates.completed_date = new Date().toISOString().slice(0, 10);
    }

    const { data, error } = await supabase
      .from("maintenance_jobs")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const job = data as unknown as MaintenanceJob;
    invalidate(NS);

    if (previousStatus !== status) {
      await supabase.from("maintenance_job_notes").insert({
        job_id: id,
        user_id: actorId,
        note_type: "status_update",
        content: `Status changed: ${previousStatus} → ${status}`,
      });
    }

    if (becameCompleted) {
      const v = await vehicleService.getById(job.vehicleId);
      if (v) {
        await activityService.log({
          companyId: v.companyId,
          userId: actorId,
          vehicleId: v.id,
          actionType: "maintenance_job_completed",
          description: `Maintenance completed for ${v.registration}`,
          metadata: { jobId: id },
        });
        // When the last open job for a vehicle completes and vehicle is in
        // being_prepared, advance to photos_pending (v4.1 TC-P2-007).
        const { count } = await supabase
          .from("maintenance_jobs")
          .select("id", { count: "exact", head: true })
          .eq("vehicle_id", v.id)
          .in("status", ["pending", "in_progress"]);
        if ((count ?? 0) === 0 && v.status === "being_prepared") {
          await vehicleService.changeStatus(v.id, "photos_pending", actorId);
        }
      }
    }
    return job;
  },
};
