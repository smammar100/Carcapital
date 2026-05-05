import { mockInspectionNotes } from "@/lib/mock-data";
import type { InspectionNote, UUID } from "@/lib/types";
import { delay, newId, nowIso } from "./_base";
import { activityService } from "./activity-service";
import { vehicleService } from "./vehicle-service";

/**
 * Inspection notes — v4.1 §11.5 / Gap 4.
 *
 * Append-only — no edit, no delete. Each note carries author + timestamp.
 */
export const inspectionNoteService = {
  async getForVehicle(vehicleId: UUID): Promise<InspectionNote[]> {
    // TODO: Supabase: from('inspection_notes').select('*').eq('vehicle_id', vehicleId).order('created_at')
    await delay(150);
    return mockInspectionNotes
      .filter((n) => n.vehicleId === vehicleId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async add(input: {
    vehicleId: UUID;
    userId: UUID;
    content: string;
  }): Promise<InspectionNote> {
    // TODO: Supabase: insert + log
    await delay();
    const note: InspectionNote = {
      id: newId("inote"),
      vehicleId: input.vehicleId,
      userId: input.userId,
      content: input.content,
      createdAt: nowIso(),
    };
    mockInspectionNotes.push(note);
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
