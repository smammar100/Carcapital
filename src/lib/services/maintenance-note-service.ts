import { createClient } from "@/lib/supabase/client";
import type { JobNoteType, MaintenanceJobNote, UUID } from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

const SELECT = `
  id,
  jobId:job_id,
  userId:user_id,
  noteType:note_type,
  content,
  createdAt:created_at
`;

export const maintenanceNoteService = {
  async getForJob(jobId: UUID): Promise<MaintenanceJobNote[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("maintenance_job_notes")
      .select(SELECT)
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as MaintenanceJobNote[];
  },

  async add(input: {
    jobId: UUID;
    userId: UUID;
    noteType: JobNoteType;
    content: string;
  }): Promise<MaintenanceJobNote> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("maintenance_job_notes")
      .insert({
        job_id: input.jobId,
        user_id: input.userId,
        note_type: input.noteType,
        content: input.content,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const note = data as unknown as MaintenanceJobNote;
    // Fetch the parent job to find the vehicle, then log activity.
    const { data: job } = await supabase
      .from("maintenance_jobs")
      .select("vehicle_id, company_id")
      .eq("id", input.jobId)
      .maybeSingle();
    if (job) {
      const j = job as { vehicle_id: string; company_id: string };
      const v = await vehicleService.getById(j.vehicle_id);
      if (v) {
        await activityService.log({
          companyId: v.companyId,
          userId: input.userId,
          vehicleId: v.id,
          actionType: "maintenance_job_created",
          description: `Job note (${input.noteType}) added: ${input.content.slice(0, 60)}`,
          metadata: { noteId: note.id, jobId: input.jobId },
        });
      }
    }
    return note;
  },
};
