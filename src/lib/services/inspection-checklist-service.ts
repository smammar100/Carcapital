import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { InspectionChecklistItem, UUID } from "@/lib/types";
import { activityService } from "./activity-service";

const NS = "inspection-checklist:";

const SELECT = `
  id,
  companyId:company_id,
  number,
  item,
  statusOptions:status_options,
  sortOrder:sort_order,
  createdAt:created_at,
  updatedAt:updated_at
`;

interface CreateInput {
  companyId: UUID;
  item: string;
  statusOptions: string[];
}

type ItemPatch = Partial<Pick<InspectionChecklistItem, "item" | "statusOptions">>;

/**
 * Configurable inspection checklist (GEN-78).
 *
 * The 20-point checklist used to be a TypeScript constant, so adding or
 * renaming a point meant a deploy. Points are rows now — per company,
 * addable, editable, reorderable and deletable from Settings.
 *
 * `inspection_checks` rows are historical snapshots (they carry their own
 * `check_item` text and `status`), not a live join to this table — deleting
 * a checklist item here never touches an inspection already recorded, it
 * only stops that point appearing on inspections started afterwards.
 *
 * `inspection_checklist_items` is new (migration 0042) and not yet in the
 * generated `database.types.ts` — cast the client to `any`, same as
 * `external-invoice-service.ts`, until `supabase gen types` runs.
 */
export const inspectionChecklistService = {
  /** Every checklist item for a company, in display order. */
  async getAll(companyId: UUID): Promise<InspectionChecklistItem[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("inspection_checklist_items")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InspectionChecklistItem[];
    });
  },

  async create(
    input: CreateInput,
    actorId: UUID,
  ): Promise<InspectionChecklistItem> {
    const item = input.item.trim();
    if (!item) throw new Error("Item name is required");
    const statusOptions = input.statusOptions
      .map((s) => s.trim())
      .filter(Boolean);
    if (statusOptions.length === 0) {
      throw new Error("At least one status option is required");
    }

    const existing = await inspectionChecklistService.getAll(input.companyId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { data, error } = await supabase
      .from("inspection_checklist_items")
      .insert({
        company_id: input.companyId,
        // Numbers are permanent (inspection_checks stores them), so reuse
        // never happens even after deletes — always past the current max.
        number: Math.max(0, ...existing.map((s) => s.number)) + 1,
        item,
        status_options: statusOptions,
        sort_order: Math.max(0, ...existing.map((s) => s.sortOrder)) + 1,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const row = data as unknown as InspectionChecklistItem;
    invalidate(NS);
    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "company_setting_changed",
      description: `Inspection checklist item "${row.item}" added`,
      metadata: { itemId: row.id, number: row.number, op: "create" },
    });
    return row;
  },

  async update(
    id: UUID,
    patch: ItemPatch,
    actorId: UUID,
  ): Promise<InspectionChecklistItem> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.item !== undefined) {
      const item = patch.item.trim();
      if (!item) throw new Error("Item name can't be empty");
      updates.item = item;
    }
    if (patch.statusOptions !== undefined) {
      const statusOptions = patch.statusOptions.map((s) => s.trim()).filter(Boolean);
      if (statusOptions.length === 0) {
        throw new Error("At least one status option is required");
      }
      updates.status_options = statusOptions;
    }

    const { data, error } = await supabase
      .from("inspection_checklist_items")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const row = data as unknown as InspectionChecklistItem;
    invalidate(NS);
    await activityService.log({
      companyId: row.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "company_setting_changed",
      description: `Inspection checklist item "${row.item}" updated`,
      metadata: { itemId: row.id, number: row.number, op: "update", patch },
    });
    return row;
  },

  /** Re-order by id sequence; positions become 1..N. */
  async reorder(
    companyId: UUID,
    orderedIds: UUID[],
    actorId: UUID,
  ): Promise<void> {
    if (orderedIds.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const now = new Date().toISOString();
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from("inspection_checklist_items")
          .update({ sort_order: i + 1, updated_at: now })
          .eq("id", id),
      ),
    );
    invalidate(NS);
    await activityService.log({
      companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "company_setting_changed",
      description: "Inspection checklist re-ordered",
      metadata: { op: "reorder", orderedIds },
    });
  },

  async remove(id: UUID, actorId: UUID): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { data: row } = await supabase
      .from("inspection_checklist_items")
      .select(SELECT)
      .eq("id", id)
      .single();
    const item = row as unknown as InspectionChecklistItem | null;
    if (!item) throw new Error("Checklist item not found");

    const { error } = await supabase
      .from("inspection_checklist_items")
      .delete()
      .eq("id", id);
    if (error) throw error;

    invalidate(NS);
    await activityService.log({
      companyId: item.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "company_setting_changed",
      description: `Inspection checklist item "${item.item}" removed`,
      metadata: { itemId: id, number: item.number, op: "delete" },
    });
  },
};
