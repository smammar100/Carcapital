import { mockMaintenanceJobNotes, mockMaintenanceJobs } from "@/lib/mock-data";
import type { JobNoteType, MaintenanceJobNote, UUID } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

/**
 * Maintenance / workshop job notes — v4.1 §11.7 / Gap 5.
 *
 * Append-only timeline per job. Note types:
 *  - note            free-form
 *  - call_log        call to vendor / customer
 *  - status_update   auto-created on status change
 *  - vendor_update   update from a vendor
 */
export const maintenanceNoteService = {
  async getForJob(jobId: UUID): Promise<MaintenanceJobNote[]> {
    // TODO: Supabase: from('maintenance_job_notes').select('*').eq('job_id', jobId).order('created_at')
    await delay(100);
    return mockMaintenanceJobNotes
      .filter((n) => n.jobId === jobId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async add(input: {
    jobId: UUID;
    userId: UUID;
    noteType: JobNoteType;
    content: string;
  }): Promise<MaintenanceJobNote> {
    // TODO: Supabase: insert + log
    await delay();
    const note: MaintenanceJobNote = {
      id: newId("mnote"),
      jobId: input.jobId,
      userId: input.userId,
      noteType: input.noteType,
      content: input.content,
      createdAt: nowIso(),
    };
    mockMaintenanceJobNotes.push(note);
    const job = mockMaintenanceJobs.find((j) => j.id === input.jobId);
    if (job) {
      const v = await vehicleService.getById(job.vehicleId);
      if (v) {
        await activityService.log({
          companyId: v.companyId,
          userId: input.userId,
          vehicleId: v.id,
          actionType: "maintenance_job_created",
          description: `Job note (${input.noteType}) added: ${input.content.slice(0, 60)}`,
          metadata: { noteId: note.id, jobId: job.id },
        });
      }
    }
    return note;
  },
};
