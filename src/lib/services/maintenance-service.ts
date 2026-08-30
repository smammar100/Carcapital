import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type {
  MaintenanceJob,
  MaintenanceStatus,
  UUID,
  VehicleStatus,
} from "@/lib/types";
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
  scheduledTime:scheduled_time,
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
  /** "HH:mm". Null leaves the job all-day, as everything before GEN-110 was. */
  scheduledTime?: string | null;
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

  async getById(id: UUID): Promise<MaintenanceJob | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("maintenance_jobs")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MaintenanceJob | null;
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<MaintenanceJob> {
    // scheduled_time lands in migration 0048; the generated Supabase types are
    // regenerated separately (`supabase gen types`), so until that runs the
    // column is absent from the insert type. Same cast the lead-channel service
    // uses for the same reason. Remove after the regen.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
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
        scheduled_time: input.scheduledTime ?? null,
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
        | "actualCost"
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
    // Only treat fields whose value actually differs from the stored row as
    // changes — so an edit-dialog save that touched nothing doesn't write a
    // misleading "Job updated" audit note.
    const existing = await this.getById(id);
    const changedKeys = existing
      ? (Object.keys(patch) as (keyof typeof patch)[]).filter(
          (k) => patch[k] !== existing[k as keyof MaintenanceJob],
        )
      : (Object.keys(patch) as (keyof typeof patch)[]);
    if (existing && changedKeys.length === 0) return existing;

    const updates: TableUpdate<"maintenance_jobs"> = {};
    if (patch.vehicleId !== undefined) updates.vehicle_id = patch.vehicleId;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.estimatedDurationHours !== undefined)
      updates.estimated_duration_hours = patch.estimatedDurationHours;
    if (patch.estimatedCost !== undefined)
      updates.estimated_cost = patch.estimatedCost;
    if (patch.actualCost !== undefined)
      updates.actual_cost = patch.actualCost;
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
      content: `Job updated (${changedKeys.join(", ")})`,
    });
    return data as unknown as MaintenanceJob;
  },

  /** Permanently delete a job and its notes. */
  async remove(id: UUID): Promise<void> {
    const supabase = createClient();
    await supabase.from("maintenance_job_notes").delete().eq("job_id", id);
    const { error } = await supabase
      .from("maintenance_jobs")
      .delete()
      .eq("id", id);
    if (error) throw error;
    invalidate(NS);
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
        // When the last open job for a vehicle completes, advance it to
        // photos_pending (v4.1 TC-P2-007). This applies to any pre-prep
        // lifecycle stage — a vehicle still in received/inspection_pending whose
        // jobs are all done should move forward too, not just being_prepared.
        const { count } = await supabase
          .from("maintenance_jobs")
          .select("id", { count: "exact", head: true })
          .eq("vehicle_id", v.id)
          .in("status", ["pending", "in_progress", "stalled"]);
        const advanceFrom: VehicleStatus[] = [
          "received",
          "inspection_pending",
          "being_prepared",
        ];
        if ((count ?? 0) === 0 && advanceFrom.includes(v.status)) {
          await vehicleService.changeStatus(v.id, "photos_pending", actorId);
        }
      }
    }
    return job;
  },
};
