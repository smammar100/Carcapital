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
  /** Public logo URL (from uploadLogo). Empty string clears it. */
  logoUrl?: string | null;
}

const LOGO_BUCKET = "company-logos";
// PNG / JPG only: the invoice PDF renders the logo via @react-pdf/renderer's
// <Image>, which does not support SVG or WebP.
const LOGO_ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);
// Accept a generous raw file (unoptimised exports are common) and downscale
// it to a small logo before upload rather than rejecting the user.
const LOGO_MAX_RAW_BYTES = 12 * 1024 * 1024; // 12 MB pre-compression

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
    if (input.logoUrl !== undefined)
      patch.logo_url = input.logoUrl === "" ? null : input.logoUrl;

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

  /**
   * Upload a company logo to the public `company-logos` bucket and return its
   * public URL. The caller persists it via `update({ logoUrl })`. Overwrites
   * the company's existing logo (upsert on a stable path) so old files don't
   * accumulate.
   */
  async uploadLogo(file: File, companyId: UUID): Promise<string> {
    if (!LOGO_ALLOWED_MIME.has(file.type)) {
      throw new Error(`Unsupported file "${file.type}". Use PNG or JPG.`);
    }
    if (file.size > LOGO_MAX_RAW_BYTES) {
      throw new Error(
        `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 12 MB.`,
      );
    }

    // Downscale to a small, invoice-friendly logo. Dynamic import keeps the
    // browser-only compressor out of any server bundle that touches this
    // service. PNG transparency is preserved (fileType pinned to the source).
    const { default: imageCompression } = await import(
      "browser-image-compression"
    );
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: file.type,
    });

    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${companyId}/logo.${ext}`;
    const supabase = createClient();

    const { error: upErr } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, compressed, { contentType: file.type, upsert: true });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    // Cache-bust so a re-upload to the same path shows immediately.
    return `${data.publicUrl}?v=${Date.now()}`;
  },
};
