import { mockActivityLog } from "@/lib/mock-data";
import type {
  ActivityActionType,
  ActivityLogEntry,
  UUID,
} from "@/lib/types";
import { delay, newId, nowIso } from "./_base";

interface LogInput {
  companyId: UUID;
  userId: UUID;
  vehicleId: UUID | null;
  actionType: ActivityActionType;
  description: string;
  metadata?: Record<string, unknown>;
}

export const activityService = {
  async getAll(companyId: UUID): Promise<ActivityLogEntry[]> {
    // TODO: Supabase: from('activity_log').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    await delay();
    return mockActivityLog
      .filter((e) => e.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getForVehicle(vehicleId: UUID): Promise<ActivityLogEntry[]> {
    // TODO: Supabase: ... .eq('vehicle_id', vehicleId)
    await delay();
    return mockActivityLog
      .filter((e) => e.vehicleId === vehicleId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async log(input: LogInput): Promise<ActivityLogEntry> {
    // TODO: Supabase: insert
    const entry: ActivityLogEntry = {
      id: newId("act"),
      companyId: input.companyId,
      userId: input.userId,
      vehicleId: input.vehicleId,
      actionType: input.actionType,
      description: input.description,
      metadata: input.metadata ?? {},
      createdAt: nowIso(),
    };
    mockActivityLog.unshift(entry);
    return entry;
  },
};
