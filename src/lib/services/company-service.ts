import { createClient, type TableUpdate } from "@/lib/supabase/client";
import { invalidate } from "@/lib/cache";
import type { Company, UUID } from "@/lib/types";
import { activityService } from "./activity-service";

const NS = "companies:";

const SELECT = `
  id,
  name,
  slug,
  address,
  vatNumber:vat_number,
  logoUrl:logo_url,
  stockIdPrefix:stock_id_prefix,
  nextStockSeq:next_stock_seq
`;

/** Columns the Settings → Company form can persist. */
export interface UpdateCompanyInput {
  name?: string;
  address?: string;
  /** Empty string is normalised to null (the column is nullable). */
  vatNumber?: string | null;
  stockIdPrefix?: string;
}

/**
 * Company profile reads/writes for the admin Settings page.
 *
 * The `companies` table (see `database.types.ts`) holds name, address,
 * vat_number, stock_id_prefix, logo_url and the various sequence counters.
 * There are no columns for the "Defaults" tab (default finance provider /
 * default VAT rate), so those are intentionally not persisted here.
 */
export const companyService = {
  /**
   * Patch the editable company-profile columns and return the fresh row.
   * Also writes an activity-log entry so the change shows in the feed.
   */
  async update(
    companyId: UUID,
    input: UpdateCompanyInput,
    actorId: UUID,
  ): Promise<Company> {
    const supabase = createClient();

    const patch: TableUpdate<"companies"> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.address !== undefined) patch.address = input.address;
    if (input.vatNumber !== undefined)
      patch.vat_number = input.vatNumber === "" ? null : input.vatNumber;
    if (input.stockIdPrefix !== undefined)
      patch.stock_id_prefix = input.stockIdPrefix;

    const { data, error } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", companyId)
      .select(SELECT)
      .single();
    if (error) throw error;

    invalidate(NS);

    await activityService.log({
      companyId,
      userId: actorId,
      vehicleId: null,
      actionType: "company_setting_changed",
      description: "Company settings updated",
      metadata: input as Record<string, unknown>,
    });

    return data as unknown as Company;
  },
};
