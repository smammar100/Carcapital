import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { LeadChannel, UUID } from "@/lib/types";
import { activityService } from "./activity-service";

const NS = "lead-channels:";

const SELECT = `
  id,
  companyId:company_id,
  slug,
  label,
  sortOrder:sort_order,
  enabled,
  isSystem:is_system,
  colour,
  createdAt:created_at,
  updatedAt:updated_at
`;

interface CreateInput {
  companyId: UUID;
  slug: string;
  label: string;
  sortOrder?: number;
  enabled?: boolean;
  isSystem?: boolean;
}

type ChannelPatch = Partial<
  Pick<LeadChannel, "label" | "slug" | "sortOrder" | "enabled">
>;

/**
 * Lead-channel catalogue service (Spec v3.0 — Decision C-2).
 *
 * Seeded with 9 system channels in migration 0009. Super User can add /
 * rename / disable additional channels from /admin/settings/lead-channels
 * (Chunk 3.4). System rows can be disabled but not deleted, so we model
 * "delete" as `setEnabled(id, false)` instead — preserves historical
 * leads' channel reference.
 */
export const leadChannelService = {
  /** All channels for a company, ordered by sort_order. */
  async getAll(companyId: UUID): Promise<LeadChannel[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("lead_channels")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as LeadChannel[];
    });
  },

  /** Enabled-only channels — what dropdowns should show. */
  async getEnabled(companyId: UUID): Promise<LeadChannel[]> {
    return withCache(`${NS}enabled:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("lead_channels")
        .select(SELECT)
        .eq("company_id", companyId)
        .eq("enabled", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as LeadChannel[];
    });
  },

  async getById(id: UUID): Promise<LeadChannel | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("lead_channels")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LeadChannel | null;
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<LeadChannel> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lead_channels")
      .insert({
        company_id: input.companyId,
        slug: input.slug,
        label: input.label,
        sort_order: input.sortOrder ?? 99,
        enabled: input.enabled ?? true,
        is_system: input.isSystem ?? false,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const channel = data as unknown as LeadChannel;
    invalidate(NS);
    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "channel_changed",
      description: `Lead channel "${channel.label}" added`,
      metadata: { channelId: channel.id, slug: channel.slug, op: "create" },
    });
    return channel;
  },

  async update(
    id: UUID,
    patch: ChannelPatch,
    actorId: UUID,
  ): Promise<LeadChannel> {
    const supabase = createClient();
    const updates: TableUpdate<"lead_channels"> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.label !== undefined) updates.label = patch.label;
    if (patch.slug !== undefined) updates.slug = patch.slug;
    if (patch.sortOrder !== undefined) updates.sort_order = patch.sortOrder;
    if (patch.enabled !== undefined) updates.enabled = patch.enabled;
    const { data, error } = await supabase
      .from("lead_channels")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const channel = data as unknown as LeadChannel;
    invalidate(NS);
    await activityService.log({
      companyId: channel.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "channel_changed",
      description: `Lead channel "${channel.label}" updated`,
      metadata: { channelId: channel.id, slug: channel.slug, op: "update", patch },
    });
    return channel;
  },

  /** Soft-toggle. System channels can be disabled but never deleted. */
  async setEnabled(
    id: UUID,
    enabled: boolean,
    actorId: UUID,
  ): Promise<LeadChannel> {
    return this.update(id, { enabled }, actorId);
  },

  /**
   * Re-order channels by the given id sequence (positions 1..N). Channels
   * absent from the list are appended at the end in their existing order.
   */
  async reorder(orderedIds: UUID[], actorId: UUID): Promise<void> {
    if (orderedIds.length === 0) return;
    const supabase = createClient();
    // Issue updates in parallel; the new sort_order is just the index + 1.
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from("lead_channels")
          .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
          .eq("id", id),
      ),
    );
    invalidate(NS);
    // One summary activity log entry. We don't have a single companyId yet —
    // look one up from the first row.
    const first = await this.getById(orderedIds[0]);
    if (!first) return;
    await activityService.log({
      companyId: first.companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "channel_changed",
      description: "Lead channels re-ordered",
      metadata: { op: "reorder", orderedIds },
    });
  },
};
