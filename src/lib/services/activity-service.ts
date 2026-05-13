import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type {
  ActivityActionType,
  ActivityLogEntry,
  UUID,
} from "@/lib/types";

const SELECT = `
  id,
  companyId:company_id,
  userId:user_id,
  vehicleId:vehicle_id,
  actionType:action_type,
  description,
  metadata,
  createdAt:created_at
`;

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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("activity_log")
      .select(SELECT)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ActivityLogEntry[];
  },

  async getForVehicle(vehicleId: UUID): Promise<ActivityLogEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("activity_log")
      .select(SELECT)
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ActivityLogEntry[];
  },

  async log(input: LogInput): Promise<ActivityLogEntry> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("activity_log")
      .insert({
        company_id: input.companyId,
        user_id: input.userId,
        vehicle_id: input.vehicleId,
        action_type: input.actionType,
        description: input.description,
        metadata: (input.metadata ?? {}) as Json,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as unknown as ActivityLogEntry;
  },
};
