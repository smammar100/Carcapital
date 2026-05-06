import { mockMaintenanceJobNotes, mockMaintenanceJobs } from "@/lib/mock-data";
import type { MaintenanceJob, MaintenanceStatus, UUID } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

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
    // TODO: Supabase: from('maintenance_jobs').select('*').eq('company_id', companyId)
    await delay();
    return mockMaintenanceJobs
      .filter((j) => j.companyId === companyId)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  },

  async getForDate(companyId: UUID, date: string): Promise<MaintenanceJob[]> {
    // TODO: Supabase: ... .eq('due_date', date)
    await delay(150);
    return mockMaintenanceJobs.filter(
      (j) => j.companyId === companyId && j.dueDate === date,
    );
  },

  async getForVehicle(vehicleId: UUID): Promise<MaintenanceJob[]> {
    // TODO: Supabase: ... .eq('vehicle_id', vehicleId)
    await delay();
    return mockMaintenanceJobs.filter((j) => j.vehicleId === vehicleId);
  },

  async create(input: CreateInput, actorId: UUID): Promise<MaintenanceJob> {
    // TODO: Supabase: insert + log activity
    await delay();
    const job: MaintenanceJob = {
      id: newId("maint"),
      companyId: input.companyId,
      vehicleId: input.vehicleId,
      description: input.description,
      assignedTo: input.assignedTo,
      vendorId: input.vendorId,
      estimatedCost: input.estimatedCost,
      actualCost: null,
      estimatedDurationHours: input.estimatedDurationHours,
      startDate: input.startDate,
      dueDate: input.dueDate,
      completedDate: null,
      status: "pending",
      notes: input.notes,
      createdAt: nowIso(),
    };
    mockMaintenanceJobs.push(job);
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
    // TODO: Supabase: update changed fields + log activity
    await delay();
    const idx = mockMaintenanceJobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error("Job not found");
    mockMaintenanceJobs[idx] = { ...mockMaintenanceJobs[idx], ...patch };
    mockMaintenanceJobNotes.push({
      id: newId("mnote"),
      jobId: id,
      userId: actorId,
      noteType: "note",
      content: `Job updated (${Object.keys(patch).join(", ")})`,
      createdAt: nowIso(),
    });
    return mockMaintenanceJobs[idx];
  },

  async updateStatus(
    id: UUID,
    status: MaintenanceStatus,
    actorId: UUID,
  ): Promise<MaintenanceJob> {
    // TODO: Supabase: update + log activity
    await delay();
    const idx = mockMaintenanceJobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error("Job not found");
    const previousStatus = mockMaintenanceJobs[idx].status;
    const becameCompleted = status === "completed" && previousStatus !== "completed";
    mockMaintenanceJobs[idx] = {
      ...mockMaintenanceJobs[idx],
      status,
      completedDate: becameCompleted
        ? nowIso().slice(0, 10)
        : mockMaintenanceJobs[idx].completedDate,
    };
    // v4.1 §11.7 Gap 5 — auto-create a status_update note on every status change.
    if (previousStatus !== status) {
      mockMaintenanceJobNotes.push({
        id: newId("mnote"),
        jobId: id,
        userId: actorId,
        noteType: "status_update",
        content: `Status changed: ${previousStatus} → ${status}`,
        createdAt: nowIso(),
      });
    }
    if (becameCompleted) {
      const v = await vehicleService.getById(
        mockMaintenanceJobs[idx].vehicleId,
      );
      if (v) {
        await activityService.log({
          companyId: v.companyId,
          userId: actorId,
          vehicleId: v.id,
          actionType: "maintenance_job_completed",
          description: `Maintenance completed for ${v.registration}`,
          metadata: { jobId: id },
        });
        // v4.1 TC-P2-007: when the last open maintenance job for a vehicle
        // completes, the vehicle auto-transitions to photos_pending so the
        // photo-processing step can pick it up.
        const open = mockMaintenanceJobs.filter(
          (j) =>
            j.vehicleId === v.id &&
            (j.status === "pending" || j.status === "in_progress"),
        );
        if (open.length === 0 && v.status === "being_prepared") {
          await vehicleService.changeStatus(v.id, "photos_pending", actorId);
        }
      }
    }
    return mockMaintenanceJobs[idx];
  },
};
