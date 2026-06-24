import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { Lead, LeadSource, LeadStatus, UUID } from "@/lib/types";
import { activityService } from "./activity-service";

const NS = "leads:";

const SELECT = `
  id,
  companyId:company_id,
  customerName:customer_name,
  customerPhone:customer_phone,
  customerEmail:customer_email,
  vehicleInterest:vehicle_interest,
  vehicleId:vehicle_id,
  source,
  leadChannelId:lead_channel_id,
  status,
  assignedTo:assigned_to,
  notes,
  appointmentId:appointment_id,
  isDemo:is_demo,
  createdAt:created_at,
  updatedAt:updated_at
`;

interface CreateInput {
  companyId: UUID;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  vehicleInterest: string;
  vehicleId: UUID | null;
  source: LeadSource;
  /** FK to lead_channels (migration 0009). Optional during the rollout. */
  leadChannelId?: UUID | null;
  assignedTo: UUID;
  notes: string | null;
}

export const leadService = {
  async getAll(companyId: UUID): Promise<Lead[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    });
  },

  async getById(id: UUID): Promise<Lead | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Lead | null;
    });
  },

  async getByStatus(
    companyId: UUID,
    statuses: LeadStatus[],
  ): Promise<Lead[]> {
    return withCache(`${NS}by-status:${companyId}:${statuses.join(",")}`, async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select(SELECT)
        .eq("company_id", companyId)
        .in("status", statuses);
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    });
  },

  async getRecent(companyId: UUID, days: number): Promise<Lead[]> {
    return withCache(`${NS}recent:${companyId}:${days}`, async () => {
      const supabase = createClient();
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("leads")
        .select(SELECT)
        .eq("company_id", companyId)
        .gte("created_at", cutoff);
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    });
  },

  async create(input: CreateInput, actorId: UUID): Promise<Lead> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("leads")
      // lead_channel_id added in migration 0009 — supabase types are
      // regenerated after apply; cast for Phase 1.
      .insert({
        company_id: input.companyId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail,
        vehicle_interest: input.vehicleInterest,
        vehicle_id: input.vehicleId,
        source: input.source,
        lead_channel_id: input.leadChannelId ?? null,
        status: "new",
        assigned_to: input.assignedTo,
        notes: input.notes,
        appointment_id: null,
      } as never)
      .select(SELECT)
      .single();
    if (error) throw error;
    const lead = data as unknown as Lead;
    invalidate(NS);
    await activityService.log({
      companyId: input.companyId,
      userId: actorId,
      vehicleId: input.vehicleId,
      actionType: "lead_created",
      description: `Lead from ${input.source.replace("_", " ")} — ${input.customerName} interested in ${input.vehicleInterest}`,
      metadata: { leadId: lead.id },
    });
    return lead;
  },

  async update(
    id: UUID,
    patch: Partial<
      Pick<
        Lead,
        | "status"
        | "notes"
        | "assignedTo"
        | "appointmentId"
        | "leadChannelId"
        | "vehicleId"
      >
    >,
  ): Promise<Lead> {
    const supabase = createClient();
    const updates: TableUpdate<"leads"> = {};
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.assignedTo !== undefined) updates.assigned_to = patch.assignedTo;
    if (patch.appointmentId !== undefined)
      updates.appointment_id = patch.appointmentId;
    if (patch.vehicleId !== undefined) updates.vehicle_id = patch.vehicleId;
    if (patch.leadChannelId !== undefined)
      // lead_channel_id added in migration 0009 — supabase types are
      // regenerated after the migration applies; cast for Phase 1.
      (updates as Record<string, unknown>).lead_channel_id = patch.leadChannelId;
    const { data, error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    invalidate(NS);
    return data as unknown as Lead;
  },

  /**
   * Move a lead through the pipeline (new → contacted → appointment_booked →
   * lost) with an audit trail. Booking an appointment is handled separately by
   * `appointmentService.create` (it sets `appointment_booked` + links the
   * appointment); use this for the New / Contacted / Lost transitions.
   *
   * When `status === "lost"`, `lostReason` is REQUIRED and is appended to the
   * lead's notes with a dated marker so the reason is on permanent record (no
   * dedicated `lost_reason` column yet — a future migration can promote it).
   */
  async changeStatus(
    id: UUID,
    status: LeadStatus,
    actorId: UUID,
    opts?: { lostReason?: string; today?: string },
  ): Promise<Lead> {
    const current = await this.getById(id);
    if (!current) throw new Error("Lead not found");

    let notes = current.notes;
    if (status === "lost") {
      const reason = opts?.lostReason?.trim();
      if (!reason) throw new Error("A reason is required to mark a lead as lost");
      const stamp = opts?.today ?? new Date().toISOString().slice(0, 10);
      const entry = `[Lost ${stamp}] ${reason}`;
      notes = current.notes ? `${current.notes}\n\n${entry}` : entry;
    }

    const updated = await this.update(id, { status, notes });

    // Audit log is best-effort — never let a logging failure (e.g. an older DB
    // missing the action_type in its CHECK constraint) roll back or surface as
    // a failed status change. The lost reason is also persisted to notes above.
    try {
      await activityService.log({
        companyId: current.companyId,
        userId: actorId,
        vehicleId: current.vehicleId,
        actionType: "lead_status_changed",
        description:
          status === "lost"
            ? `Lead ${current.customerName} marked Lost — ${opts?.lostReason?.trim() ?? ""}`
            : `Lead ${current.customerName} moved ${current.status.replace("_", " ")} → ${status.replace("_", " ")}`,
        metadata: { leadId: id, from: current.status, to: status },
      });
    } catch (e) {
      console.warn("[lead-service] status-change activity log failed", e);
    }

    return updated;
  },
};
