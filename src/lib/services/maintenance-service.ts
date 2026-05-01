import { mockMaintenanceJobs } from "@/lib/mock-data";
import type { MaintenanceJob, UUID } from "@/lib/types";
import { delay } from "./_base";

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
};
