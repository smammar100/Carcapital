import { mockWorkshopJobs } from "@/lib/mock-data";
import type { UUID, WorkshopJob } from "@/lib/types";
import { delay } from "./_base";

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
};
