import { createClient } from "@/lib/supabase/client";
import { invalidate, withCache } from "@/lib/cache";
import type {
  ExternalInvoice,
  InvoiceKind,
  UUID,
} from "@/lib/types";
import { activityService } from "./activity-service";

const NS = "external-invoices:";
const BUCKET = "external-invoices";

const SELECT = `
  id,
  invoiceKind:invoice_kind,
  invoiceNumber:invoice_number,
  vendorId:vendor_id,
  vehicleId:vehicle_id,
  invoiceDate:invoice_date,
  totalPence:total_pence,
  vatPence:vat_pence,
  preVatPence:pre_vat_pence,
  description,
  notes,
  attachmentUrl:attachment_url,
  attachmentFilename:attachment_filename,
  attachmentSizeBytes:attachment_size_bytes,
  attachmentMimeType:attachment_mime_type,
  createdBy:created_by,
  createdAt:created_at,
  updatedAt:updated_at
`;

export interface ExternalInvoiceCreateInput {
  invoiceKind: InvoiceKind;
  invoiceNumber?: string | null;
  vendorId: UUID;
  vehicleId: UUID;
  invoiceDate: string;          // ISO date (yyyy-mm-dd)
  totalPence: number;
  vatPence: number;
  description: string;
  notes?: string | null;
  /** Storage object path returned by `uploadAttachment`. */
  attachmentUrl?: string | null;
  attachmentFilename?: string | null;
  attachmentSizeBytes?: number | null;
  attachmentMimeType?: string | null;
}

export type ExternalInvoicePatch = Partial<
  Omit<ExternalInvoiceCreateInput, "vehicleId">
>;

export interface AttachmentUploadResult {
  /** Storage object path stored in `external_invoices.attachment_url`. */
  path: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

const ALLOWED_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Spec v3.0 · Module D — inbound external / purchase invoices.
 *
 * Tenancy: every read goes through RLS that joins to vehicles.company_id.
 * `attachment_url` stores the storage object PATH (not a signed URL);
 * call `signedAttachmentUrl(path)` to get a fresh time-limited URL for
 * download.
 *
 * Supabase types are regenerated separately — cast the client to `any`
 * for `external_invoices` until `supabase gen types` runs.
 */
export const externalInvoiceService = {
  async getAll(companyId: UUID): Promise<ExternalInvoice[]> {
    return withCache(`${NS}all:${companyId}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("external_invoices")
        .select(SELECT)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExternalInvoice[];
    });
  },

  async getByKind(
    companyId: UUID,
    kind: InvoiceKind,
  ): Promise<ExternalInvoice[]> {
    return withCache(`${NS}kind:${companyId}:${kind}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("external_invoices")
        .select(SELECT)
        .eq("invoice_kind", kind)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExternalInvoice[];
    });
  },

  async getByVehicle(vehicleId: UUID): Promise<ExternalInvoice[]> {
    return withCache(`${NS}vehicle:${vehicleId}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("external_invoices")
        .select(SELECT)
        .eq("vehicle_id", vehicleId)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExternalInvoice[];
    });
  },

  async getById(id: UUID): Promise<ExternalInvoice | null> {
    return withCache(`${NS}by-id:${id}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("external_invoices")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as ExternalInvoice | null;
    });
  },

  async create(
    companyId: UUID,
    input: ExternalInvoiceCreateInput,
    actorId: UUID,
  ): Promise<ExternalInvoice> {
    if (input.vatPence > input.totalPence) {
      throw new Error("VAT can't exceed total.");
    }
    if (input.totalPence < 0 || input.vatPence < 0) {
      throw new Error("Amounts can't be negative.");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { data, error } = await supabase
      .from("external_invoices")
      .insert({
        invoice_kind: input.invoiceKind,
        invoice_number: input.invoiceNumber ?? null,
        vendor_id: input.vendorId,
        vehicle_id: input.vehicleId,
        invoice_date: input.invoiceDate,
        total_pence: input.totalPence,
        vat_pence: input.vatPence,
        description: input.description,
        notes: input.notes ?? null,
        attachment_url: input.attachmentUrl ?? null,
        attachment_filename: input.attachmentFilename ?? null,
        attachment_size_bytes: input.attachmentSizeBytes ?? null,
        attachment_mime_type: input.attachmentMimeType ?? null,
        created_by: actorId,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    const inv = data as ExternalInvoice;
    invalidate(NS);
    await activityService.log({
      companyId,
      userId: actorId,
      vehicleId: input.vehicleId,
      actionType: "external_invoice_created",
      description: `External invoice — ${input.invoiceKind.replace("_", " ")} · £${(input.totalPence / 100).toFixed(2)}`,
      metadata: { invoiceId: inv.id, kind: input.invoiceKind, vendorId: input.vendorId },
    });
    return inv;
  },

  async update(
    id: UUID,
    patch: ExternalInvoicePatch,
    actorId: UUID,
    companyId: UUID,
  ): Promise<ExternalInvoice> {
    if (
      patch.vatPence !== undefined &&
      patch.totalPence !== undefined &&
      patch.vatPence > patch.totalPence
    ) {
      throw new Error("VAT can't exceed total.");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    // F-D1: fetch the prior `attachment_url` so we can purge the orphaned
    // Storage object when the user replaces (or clears) the attachment.
    // Only fetch when the caller actually touches the attachment column to
    // keep edits without attachment changes a single round-trip.
    let prevAttachmentUrl: string | null = null;
    if (patch.attachmentUrl !== undefined) {
      const prev = await this.getById(id);
      prevAttachmentUrl = prev?.attachmentUrl ?? null;
    }
    // Build update payload (only set keys that were passed in).
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.invoiceKind !== undefined) row.invoice_kind = patch.invoiceKind;
    if (patch.invoiceNumber !== undefined) row.invoice_number = patch.invoiceNumber;
    if (patch.vendorId !== undefined) row.vendor_id = patch.vendorId;
    if (patch.invoiceDate !== undefined) row.invoice_date = patch.invoiceDate;
    if (patch.totalPence !== undefined) row.total_pence = patch.totalPence;
    if (patch.vatPence !== undefined) row.vat_pence = patch.vatPence;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.attachmentUrl !== undefined) row.attachment_url = patch.attachmentUrl;
    if (patch.attachmentFilename !== undefined) row.attachment_filename = patch.attachmentFilename;
    if (patch.attachmentSizeBytes !== undefined) row.attachment_size_bytes = patch.attachmentSizeBytes;
    if (patch.attachmentMimeType !== undefined) row.attachment_mime_type = patch.attachmentMimeType;

    const { data, error } = await supabase
      .from("external_invoices")
      .update(row)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    const inv = data as ExternalInvoice;
    // F-D1: if the attachment was swapped or cleared, purge the now-orphaned
    // Storage object. Swallow errors — the DB row is the source of truth.
    if (
      patch.attachmentUrl !== undefined &&
      prevAttachmentUrl &&
      prevAttachmentUrl !== inv.attachmentUrl
    ) {
      await supabase.storage
        .from(BUCKET)
        .remove([prevAttachmentUrl])
        .catch(() => {
          /* orphaned object will be GC'd by a later sweep. */
        });
    }
    invalidate(NS);
    await activityService.log({
      companyId,
      userId: actorId,
      vehicleId: inv.vehicleId,
      actionType: "external_invoice_updated",
      description: `External invoice updated — £${(inv.totalPence / 100).toFixed(2)}`,
      metadata: { invoiceId: inv.id, patch: Object.keys(patch) },
    });
    return inv;
  },

  /**
   * Storage-only helper used by the form to clean up an orphan when the
   * user uploads an attachment and then closes the dialog (or replaces
   * it) before saving. Safe to call with any path — bucket RLS keeps it
   * scoped, and errors are swallowed.
   */
  async removeAttachmentObject(path: string): Promise<void> {
    if (!path) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {
      /* swallow — best-effort cleanup. */
    });
  },

  async delete(id: UUID, actorId: UUID, companyId: UUID): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    // Fetch first so we can include vehicleId in the activity-log row and
    // remove the attachment object from Storage if present.
    const existing = await this.getById(id);
    const { error } = await supabase
      .from("external_invoices")
      .delete()
      .eq("id", id);
    if (error) throw error;
    if (existing?.attachmentUrl) {
      await supabase.storage.from(BUCKET).remove([existing.attachmentUrl]).catch(() => {
        /* swallow — the row is gone; orphaned object can be GC'd later. */
      });
    }
    invalidate(NS);
    if (existing) {
      await activityService.log({
        companyId,
        userId: actorId,
        vehicleId: existing.vehicleId,
        actionType: "external_invoice_deleted",
        description: `External invoice deleted — £${(existing.totalPence / 100).toFixed(2)}`,
        metadata: { invoiceId: id },
      });
    }
  },

  /**
   * Upload an attachment to Supabase Storage. Path follows
   * `<companyId>/<vehicleId>/<timestamp>_<filename>` so the bucket RLS
   * can scope reads/writes by company.
   *
   * Throws if the file is too large or has a disallowed MIME type.
   */
  async uploadAttachment(
    file: File,
    companyId: UUID,
    vehicleId: UUID,
  ): Promise<AttachmentUploadResult> {
    if (!ALLOWED_MIME.has(file.type)) {
      throw new Error(
        `Unsupported file type "${file.type}". Use JPG, PNG, or PDF.`,
      );
    }
    if (file.size > MAX_BYTES) {
      throw new Error(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`,
      );
    }
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `${companyId}/${vehicleId}/${Date.now()}_${safeName}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return {
      path,
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    };
  },

  /**
   * Mint a time-limited signed URL so the browser can render or
   * download the attachment. Re-mint on every access — never persist
   * the signed URL in the DB.
   */
  async signedAttachmentUrl(
    path: string,
    expiresInSeconds = 7 * 24 * 60 * 60, // 7 days
  ): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error) return null;
    return (data as { signedUrl?: string })?.signedUrl ?? null;
  },
};
