import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type { CustomFieldDefinition, CustomFieldType, UUID } from "@/lib/types";

const NS = "custom-fields:";

const SELECT = `
  id,
  companyId:company_id,
  fieldKey:field_key,
  label,
  fieldType:field_type,
  options,
  required,
  showInMasterSheet:show_in_master_sheet,
  showInArrivalForm:show_in_arrival_form,
  displayOrder:display_order,
  createdBy:created_by,
  createdAt:created_at,
  archivedAt:archived_at
`;

/** `custom_field_definitions` isn't in the generated Database types until
 * they're regenerated post-migration-0003 — talk to it untyped, and
 * degrade to empty if the migration somehow isn't applied. */
function looseClient(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}

function isMigrationMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const msg = e?.message ?? "";
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    /relation .* does not exist|column .* does not exist|could not find the .* in the schema cache|schema cache/i.test(
      msg,
    )
  );
}

/** Immutable slug derived from the label at creation time. */
export function slugifyFieldKey(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || `field_${Date.now()}`
  );
}

interface CreateInput {
  companyId: UUID;
  label: string;
  fieldType: CustomFieldType;
  options: string[] | null;
  required: boolean;
  showInMasterSheet: boolean;
  showInArrivalForm: boolean;
  createdBy: UUID | null;
}

/** Mutable subset — fieldKey + fieldType are locked after creation. */
interface UpdateInput {
  label?: string;
  options?: string[] | null;
  required?: boolean;
  showInMasterSheet?: boolean;
  showInArrivalForm?: boolean;
  displayOrder?: number;
}

export const customFieldService = {
  /** All definitions for a company (incl. archived), ordered for display.
   *  Empty if migration 0003 isn't applied. */
  async getAll(companyId: UUID): Promise<CustomFieldDefinition[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      const sb = looseClient();
      const { data, error } = await sb
        .from("custom_field_definitions")
        .select(SELECT)
        .eq("company_id", companyId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        if (isMigrationMissing(error)) return [];
        throw error;
      }
      return (data ?? []) as unknown as CustomFieldDefinition[];
    });
  },

  /** Non-archived only — what forms/tables actually render. */
  async getActive(companyId: UUID): Promise<CustomFieldDefinition[]> {
    const all = await customFieldService.getAll(companyId);
    return all.filter((f) => f.archivedAt === null);
  },

  async create(
    input: CreateInput,
  ): Promise<CustomFieldDefinition | null> {
    const sb = looseClient();
    // Append to the end of the current order.
    const existing = await customFieldService.getAll(input.companyId);
    const nextOrder =
      existing.reduce((m, f) => Math.max(m, f.displayOrder), 0) + 1;
    const { data, error } = await sb
      .from("custom_field_definitions")
      .insert({
        company_id: input.companyId,
        field_key: slugifyFieldKey(input.label),
        label: input.label.trim(),
        field_type: input.fieldType,
        options: input.options,
        required: input.required,
        show_in_master_sheet: input.showInMasterSheet,
        show_in_arrival_form: input.showInArrivalForm,
        display_order: nextOrder,
        created_by: input.createdBy,
      })
      .select(SELECT)
      .single();
    if (error) {
      if (isMigrationMissing(error)) return null;
      throw error;
    }
    invalidate(NS);
    return data as unknown as CustomFieldDefinition;
  },

  async update(
    id: UUID,
    patch: UpdateInput,
  ): Promise<CustomFieldDefinition | null> {
    const sb = looseClient();
    const row: Record<string, unknown> = {};
    if (patch.label !== undefined) row.label = patch.label.trim();
    if (patch.options !== undefined) row.options = patch.options;
    if (patch.required !== undefined) row.required = patch.required;
    if (patch.showInMasterSheet !== undefined)
      row.show_in_master_sheet = patch.showInMasterSheet;
    if (patch.showInArrivalForm !== undefined)
      row.show_in_arrival_form = patch.showInArrivalForm;
    if (patch.displayOrder !== undefined)
      row.display_order = patch.displayOrder;
    const { data, error } = await sb
      .from("custom_field_definitions")
      .update(row)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) {
      if (isMigrationMissing(error)) return null;
      throw error;
    }
    invalidate(NS);
    return data as unknown as CustomFieldDefinition;
  },

  /** Soft-delete: archived defs leave forms/tables; values stay on vehicles. */
  async archive(id: UUID): Promise<boolean> {
    const sb = looseClient();
    const { error } = await sb
      .from("custom_field_definitions")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      if (isMigrationMissing(error)) return false;
      throw error;
    }
    invalidate(NS);
    return true;
  },

  async unarchive(id: UUID): Promise<boolean> {
    const sb = looseClient();
    const { error } = await sb
      .from("custom_field_definitions")
      .update({ archived_at: null })
      .eq("id", id);
    if (error) {
      if (isMigrationMissing(error)) return false;
      throw error;
    }
    invalidate(NS);
    return true;
  },
};
