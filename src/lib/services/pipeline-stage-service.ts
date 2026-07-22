import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { PipelineStage, StageBehaviour, UUID } from "@/lib/types";
import { activityService } from "./activity-service";

const NS = "pipeline-stages:";

const SELECT = `
  id,
  companyId:company_id,
  slug,
  label,
  sortOrder:sort_order,
  enabled,
  behaviour,
  isSystem:is_system,
  createdAt:created_at,
  updatedAt:updated_at
`;

interface CreateInput {
  companyId: UUID;
  label: string;
  behaviour?: StageBehaviour;
}

type StagePatch = Partial<
  Pick<PipelineStage, "label" | "sortOrder" | "enabled" | "behaviour">
>;

/** "Awaiting Finance" → "awaiting_finance". */
function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "stage"
  );
}

/**
 * Sales pipeline stages (GEN-65).
 *
 * The board's columns used to be a TypeScript constant plus a CHECK constraint,
 * so removing "Offer Made" was a deploy. They're rows now — per company,
 * renameable, reorderable, and extendable without engineering.
 *
 * Two rules protect the pipeline from being configured into a dead end:
 * system stages can be renamed but not deleted, and removing a stage always
 * moves its deals somewhere valid rather than orphaning them.
 */
export const pipelineStageService = {
  /** Every stage, including disabled ones — what Settings edits. */
  async getAll(companyId: UUID): Promise<PipelineStage[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PipelineStage[];
    });
  },

  /** Enabled stages only — the live board's columns. */
  async getEnabled(companyId: UUID): Promise<PipelineStage[]> {
    return (await pipelineStageService.getAll(companyId)).filter(
      (s) => s.enabled,
    );
  },

  /** The stage a deal is in, by slug. Null when the stage was deleted. */
  async getBySlug(
    companyId: UUID,
    slug: string,
  ): Promise<PipelineStage | null> {
    return (
      (await pipelineStageService.getAll(companyId)).find(
        (s) => s.slug === slug,
      ) ?? null
    );
  },

  async create(input: CreateInput, actorId: UUID): Promise<PipelineStage> {
    const label = input.label.trim();
    if (!label) throw new Error("Stage name is required");
    const existing = await pipelineStageService.getAll(input.companyId);
    if (existing.some((s) => s.label.toLowerCase() === label.toLowerCase())) {
      throw new Error(`A "${label}" stage already exists`);
    }

    // Slugs are permanent (deals store them), so a collision with a stage that
    // was removed and re-added under the same name gets a numeric suffix.
    const base = slugify(label);
    let slug = base;
    for (let n = 2; existing.some((s) => s.slug === slug); n++) {
      slug = `${base}_${n}`;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("pipeline_stages")
      .insert({
        company_id: input.companyId,
        slug,
        label,
        // New stages land at the end, just before nothing — the user reorders
        // from there.
        sort_order: Math.max(0, ...existing.map((s) => s.sortOrder)) + 1,
        enabled: true,
        behaviour: input.behaviour ?? "open",
        is_system: false,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const stage = data as unknown as PipelineStage;
    invalidate(NS);
    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "company_setting_changed",
      description: `Pipeline stage "${stage.label}" added`,
      metadata: { stageId: stage.id, slug: stage.slug, op: "create" },
    });
    return stage;
  },

  async update(
    id: UUID,
    patch: StagePatch,
    actorId: UUID,
  ): Promise<PipelineStage> {
    const supabase = createClient();
    const updates: TableUpdate<"pipeline_stages"> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.label !== undefined) {
      const label = patch.label.trim();
      if (!label) throw new Error("Stage name can't be empty");
      updates.label = label;
    }
    if (patch.sortOrder !== undefined) updates.sort_order = patch.sortOrder;
    if (patch.enabled !== undefined) updates.enabled = patch.enabled;
    if (patch.behaviour !== undefined) updates.behaviour = patch.behaviour;

    const { data, error } = await supabase
      .from("pipeline_stages")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const stage = data as unknown as PipelineStage;
    invalidate(NS);
    await activityService.log({
      companyId: stage.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "company_setting_changed",
      description: `Pipeline stage "${stage.label}" updated`,
      metadata: { stageId: stage.id, slug: stage.slug, op: "update", patch },
    });
    return stage;
  },

  /** Re-order by id sequence; positions become 1..N. */
  async reorder(
    companyId: UUID,
    orderedIds: UUID[],
    actorId: UUID,
  ): Promise<void> {
    if (orderedIds.length === 0) return;
    const supabase = createClient();
    const now = new Date().toISOString();
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from("pipeline_stages")
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
      description: "Sales pipeline stages re-ordered",
      metadata: { op: "reorder", orderedIds },
    });
  },

  /**
   * How many deals are sitting in a stage. Settings shows this before a
   * removal so nobody deletes a column without knowing what's in it.
   */
  async countDeals(companyId: UUID, slug: string): Promise<number> {
    const supabase = createClient();
    const { count, error } = await supabase
      .from("sales_deals")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("stage", slug);
    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Remove a stage, moving any deals in it to `moveToSlug` first.
   *
   * Deals are never dropped. System stages are disabled instead of deleted —
   * their slugs are what `salesService` keys the sale lifecycle off, and old
   * deals still reference them.
   */
  async remove(
    id: UUID,
    moveToSlug: string,
    actorId: UUID,
  ): Promise<{ movedDeals: number }> {
    const supabase = createClient();
    const { data: row } = await supabase
      .from("pipeline_stages")
      .select(SELECT)
      .eq("id", id)
      .single();
    const stage = row as unknown as PipelineStage | null;
    if (!stage) throw new Error("Stage not found");
    if (stage.slug === moveToSlug) {
      throw new Error("Pick a different stage to move deals into");
    }

    const target = await pipelineStageService.getBySlug(
      stage.companyId,
      moveToSlug,
    );
    if (!target) throw new Error("The stage to move deals into no longer exists");

    // Move first. If the delete fails afterwards the deals are still in a valid
    // stage; if it ran the other way round they'd be orphaned.
    const { data: moved, error: moveError } = await supabase
      .from("sales_deals")
      .update({ stage: moveToSlug })
      .eq("company_id", stage.companyId)
      .eq("stage", stage.slug)
      .select("id");
    if (moveError) throw moveError;
    const movedDeals = (moved ?? []).length;

    if (stage.isSystem) {
      await pipelineStageService.update(id, { enabled: false }, actorId);
    } else {
      const { error } = await supabase
        .from("pipeline_stages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    }

    invalidate(NS);
    invalidate("sales:");
    await activityService.log({
      companyId: stage.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "company_setting_changed",
      description: `Pipeline stage "${stage.label}" removed${
        movedDeals > 0 ? `, ${movedDeals} deal(s) moved to ${target.label}` : ""
      }`,
      metadata: {
        stageId: id,
        slug: stage.slug,
        op: stage.isSystem ? "disable" : "delete",
        movedTo: moveToSlug,
        movedDeals,
      },
    });
    return { movedDeals };
  },
};
