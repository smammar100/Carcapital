import { mockMaintenanceJobs } from "@/lib/mock-data";
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

  async updateStatus(
    id: UUID,
    status: MaintenanceStatus,
    actorId: UUID,
  ): Promise<MaintenanceJob> {
    // TODO: Supabase: update + log activity
    await delay();
    const idx = mockMaintenanceJobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error("Job not found");
    const becameCompleted =
      status === "completed" && mockMaintenanceJobs[idx].status !== "completed";
    mockMaintenanceJobs[idx] = {
      ...mockMaintenanceJobs[idx],
      status,
      completedDate: becameCompleted
        ? nowIso().slice(0, 10)
        : mockMaintenanceJobs[idx].completedDate,
    };
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
      }
    }
    return mockMaintenanceJobs[idx];
  },
};
