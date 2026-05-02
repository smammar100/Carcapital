import { mockWorkshopJobs } from "@/lib/mock-data";
import type { MaintenanceStatus, UUID, WorkshopJob } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";

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
    // TODO: Supabase: from('workshop_jobs').select('*').eq('company_id', companyId)
    await delay();
    return mockWorkshopJobs
      .filter((j) => j.companyId === companyId)
      .sort((a, b) =>
        a.scheduledDate === b.scheduledDate
          ? a.scheduledTime.localeCompare(b.scheduledTime)
          : a.scheduledDate.localeCompare(b.scheduledDate),
      );
  },

  async getForDate(companyId: UUID, date: string): Promise<WorkshopJob[]> {
    // TODO: Supabase: ... .eq('scheduled_date', date)
    await delay(150);
    return mockWorkshopJobs.filter(
      (j) => j.companyId === companyId && j.scheduledDate === date,
    );
  },

  async create(input: CreateInput, actorId: UUID): Promise<WorkshopJob> {
    // TODO: Supabase: insert + log
    await delay();
    const job: WorkshopJob = {
      id: newId("ws"),
      companyId: input.companyId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      vehicleReg: input.vehicleReg.toUpperCase(),
      vehicleDescription: input.vehicleDescription,
      description: input.description,
      assignedTo: input.assignedTo,
      estimatedCost: input.estimatedCost,
      actualCost: null,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      completedDate: null,
      status: "pending",
      notes: input.notes,
      createdAt: nowIso(),
    };
    mockWorkshopJobs.push(job);
    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "workshop_job_created",
      description: `Walk-in workshop job: ${input.customerName} — ${input.description}`,
      metadata: { jobId: job.id, vehicleReg: input.vehicleReg },
    });
    return job;
  },

  async updateStatus(
    id: UUID,
    status: MaintenanceStatus,
  ): Promise<WorkshopJob> {
    // TODO: Supabase: update
    await delay();
    const idx = mockWorkshopJobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error("Job not found");
    mockWorkshopJobs[idx] = {
      ...mockWorkshopJobs[idx],
      status,
      completedDate:
        status === "completed"
          ? nowIso().slice(0, 10)
          : mockWorkshopJobs[idx].completedDate,
    };
    return mockWorkshopJobs[idx];
  },
};
