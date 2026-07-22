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
  logoMarkUrl:logo_mark_url,
  stockIdPrefix:stock_id_prefix,
  nextStockSeq:next_stock_seq,
  workingHoursStart:working_hours_start,
  workingHoursEnd:working_hours_end
`;

/** Which brand lockup an upload targets — see uploadLogo. */
export type LogoKind = "full" | "mark";

/** Columns the Settings → Company form can persist. */
export interface UpdateCompanyInput {
  name?: string;
  address?: string;
  /** Empty string is normalised to null (the column is nullable). */
  vatNumber?: string | null;
  stockIdPrefix?: string;
  /** Full logo (invoices). Empty string clears it. */
  logoUrl?: string | null;
  /** Square logo mark (sidebar). Empty string clears it. */
  logoMarkUrl?: string | null;
  /** Business day window, "HH:mm" (24h) — drives the Appointment Book grid. */
  workingHoursStart?: string;
  workingHoursEnd?: string;
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

    // logo_mark_url and working_hours_* aren't in the generated TableUpdate
    // type yet (added in migrations 0035, 0040); extend locally rather than
    // regenerate the 2k-line file.
    const patch: TableUpdate<"companies"> & {
      logo_mark_url?: string | null;
      working_hours_start?: string;
      working_hours_end?: string;
    } = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.address !== undefined) patch.address = input.address;
    if (input.vatNumber !== undefined)
      patch.vat_number = input.vatNumber === "" ? null : input.vatNumber;
    if (input.stockIdPrefix !== undefined)
      patch.stock_id_prefix = input.stockIdPrefix;
    if (input.logoUrl !== undefined)
      patch.logo_url = input.logoUrl === "" ? null : input.logoUrl;
    if (input.logoMarkUrl !== undefined)
      patch.logo_mark_url = input.logoMarkUrl === "" ? null : input.logoMarkUrl;
    if (input.workingHoursStart !== undefined)
      patch.working_hours_start = input.workingHoursStart;
    if (input.workingHoursEnd !== undefined)
      patch.working_hours_end = input.workingHoursEnd;

    const { data, error } = await supabase
      .from("companies")
      // Cast drops the local extensions above so supabase-js's excess-property
      // guard passes; the columns exist (migrations 0035, 0040) and are sent at
      // runtime. Remove once database.types.ts is regenerated.
      .update(patch as TableUpdate<"companies">)
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
   * public URL. `kind` selects the lockup: "full" (logo + wordmark, for
   * invoices) or "mark" (square mark, for the sidebar) — each writes a
   * distinct stable path so they don't overwrite each other. The caller
   * persists the URL via `update({ logoUrl })` / `update({ logoMarkUrl })`.
   */
  async uploadLogo(
    file: File,
    companyId: UUID,
    kind: LogoKind = "full",
  ): Promise<string> {
    if (!LOGO_ALLOWED_MIME.has(file.type)) {
      throw new Error(`Unsupported file "${file.type}". Use PNG or JPG.`);
    }
    if (file.size > LOGO_MAX_RAW_BYTES) {
      throw new Error(
        `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 12 MB.`,
      );
    }

    // Downscale before upload. Dynamic import keeps the browser-only compressor
    // out of any server bundle that touches this service. PNG transparency is
    // preserved (fileType pinned to the source). The mark is a small square, so
    // it compresses tighter than the full logo.
    const { default: imageCompression } = await import(
      "browser-image-compression"
    );
    const compressed = await imageCompression(file, {
      maxSizeMB: kind === "mark" ? 0.2 : 0.5,
      maxWidthOrHeight: kind === "mark" ? 256 : 800,
      useWebWorker: true,
      fileType: file.type,
    });

    const ext = file.type === "image/png" ? "png" : "jpg";
    const base = kind === "mark" ? "logo-mark" : "logo";
    const path = `${companyId}/${base}.${ext}`;
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
