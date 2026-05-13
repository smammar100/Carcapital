import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { InspectionNote, UUID } from "@/lib/types";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

const NS = "inspection-notes:";

const SELECT = `
  id,
  vehicleId:vehicle_id,
  userId:user_id,
  content,
  createdAt:created_at
`;

export const inspectionNoteService = {
  async getForVehicle(vehicleId: UUID): Promise<InspectionNote[]> {
    return withCache(`${NS}vehicle:${vehicleId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("inspection_notes")
        .select(SELECT)
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InspectionNote[];
    });
  },

  async add(input: {
    vehicleId: UUID;
    userId: UUID;
    content: string;
  }): Promise<InspectionNote> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("inspection_notes")
      .insert({
        vehicle_id: input.vehicleId,
        user_id: input.userId,
        content: input.content,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const note = data as unknown as InspectionNote;
    invalidate(NS);
    const v = await vehicleService.getById(input.vehicleId);
    if (v) {
      await activityService.log({
        companyId: v.companyId,
        userId: input.userId,
        vehicleId: v.id,
        actionType: "inspection_started",
        description: `Inspection note added: ${input.content.slice(0, 60)}`,
        metadata: { noteId: note.id },
      });
    }
    return note;
  },
};
