import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { DealNote, UUID } from "@/lib/types";
import { activityService } from "./activity-service";
import { salesService } from "./sales-service";

const NS = "deal-notes:";

const SELECT = `
  id,
  dealId:deal_id,
  userId:user_id,
  content,
  createdAt:created_at
`;

/**
 * Timestamped, attributed notes on a sales deal (GEN-74) — append-only, same
 * pattern as inspection-note-service.ts. Distinct from `SalesDeal.notes`,
 * the pre-existing single free-text column.
 */
export const dealNoteService = {
  async getForDeal(dealId: UUID): Promise<DealNote[]> {
    return withCache(`${NS}deal:${dealId}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("deal_notes")
        .select(SELECT)
        .eq("deal_id", dealId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DealNote[];
    });
  },

  async add(input: {
    dealId: UUID;
    userId: UUID;
    content: string;
  }): Promise<DealNote> {
    const content = input.content.trim();
    if (!content) throw new Error("Note can't be empty");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { data, error } = await supabase
      .from("deal_notes")
      .insert({
        deal_id: input.dealId,
        user_id: input.userId,
        content,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const note = data as DealNote;
    invalidate(NS);
    const deal = await salesService.getById(input.dealId);
    if (deal) {
      await activityService.log({
        companyId: deal.companyId,
        userId: input.userId,
        vehicleId: deal.vehicleId,
        actionType: "deal_note_added",
        description: `Deal note added for ${deal.customerName}: ${content.slice(0, 60)}`,
        metadata: { dealId: deal.id, noteId: note.id },
      });
    }
    return note;
  },
};
