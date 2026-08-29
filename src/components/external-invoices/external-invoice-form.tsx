"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { RegPlate } from "@/components/shared/reg-plate";
import { VehiclePicker } from "@/components/shared/vehicle-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { externalInvoiceService } from "@/lib/services/external-invoice-service";
import { vendorService } from "@/lib/services/vendor-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type {
  ExternalInvoice,
  InvoiceKind,
  UUID,
  Vehicle,
  Vendor,
} from "@/lib/types";
import { INVOICE_KIND_LABELS } from "@/lib/types";
import { VendorInlineAdd } from "./vendor-inline-add";
import { AttachmentUploader } from "./attachment-uploader";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Default kind for the form (the active tab when "+ New" is clicked). */
  defaultKind: InvoiceKind;
  /** When set, the form pre-selects this vehicle and locks the picker. */
  fixedVehicleId?: UUID;
  /** When set, the form edits this row instead of creating. */
  editing?: ExternalInvoice | null;
  onSaved?: (inv: ExternalInvoice) => void;
}

function poundsToPence(s: string): number {
  if (!s) return 0;
  const n = Number(s.replace(/[£,\s]/g, ""));
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function penceToPounds(p: number | null | undefined): string {
  if (p == null) return "";
  return (p / 100).toFixed(2);
}

/**
 * Spec v3.0 · Module D.3 / 4 — external invoice form (covers both
 * auction-purchase and external-job kinds).
 *
 * Vendor + Vehicle pickers are searchable selects. Total + VAT are
 * currency inputs in pounds; Pre-VAT computes live (read-only). Cannot
 * submit if VAT > Total. Attachment slot uploads to Supabase Storage
 * via `externalInvoiceService.uploadAttachment` and stores the path.
 */
export function ExternalInvoiceForm({
  open,
  onOpenChange,
  defaultKind,
  fixedVehicleId,
  editing,
  onSaved,
}: Props) {
  const baseId = useId();
  const vendorFieldId = `${baseId}-vendor`;
  const previousOwnerFieldId = `${baseId}-previous-owner`;
  const serviceHistoryRefFieldId = `${baseId}-service-history-ref`;
  const vehicleFieldId = `${baseId}-vehicle`;
  const invoiceNumberFieldId = `${baseId}-invoice-number`;
  const invoiceDateFieldId = `${baseId}-invoice-date`;
  const totalFieldId = `${baseId}-total`;
  const vatFieldId = `${baseId}-vat`;
  const preVatFieldId = `${baseId}-pre-vat`;
  const descriptionFieldId = `${baseId}-description`;
  const notesFieldId = `${baseId}-notes`;
  const { company, user } = useAuth();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [kind, setKind] = useState<InvoiceKind>(defaultKind);
  const [vendorId, setVendorId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>(fixedVehicleId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [total, setTotal] = useState("");
  const [vat, setVat] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [previousOwner, setPreviousOwner] = useState("");
  const [serviceHistoryRef, setServiceHistoryRef] = useState("");
  const [attachment, setAttachment] = useState<{
    path: string | null;
    filename: string | null;
    sizeBytes: number | null;
    mimeType: string | null;
  }>({ path: null, filename: null, sizeBytes: null, mimeType: null });
  const [submitting, setSubmitting] = useState(false);

  // F-D3 — paths uploaded in this dialog session that are NOT yet persisted
  // to the DB. On dialog close without save (or on attachment replace), we
  // purge them from Storage so we don't leak orphans. The baseline (the
  // attachment that already lives on the `editing` row) is preserved here so
  // we know not to delete it on Cancel.
  const persistedBaselineRef = useRef<string | null>(null);
  const draftPathsRef = useRef<Set<string>>(new Set());

  // Load lookups once when the dialog opens.
  useEffect(() => {
    if (!open || !company?.id) return;
    let cancelled = false;
    void Promise.all([
      vendorService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([v, veh]) => {
      if (cancelled) return;
      setVendors(v.filter((x) => x.active));
      setVehicles(veh);
    });
    return () => {
      cancelled = true;
    };
  }, [open, company?.id]);

  // Populate form from `editing` when re-opening for an existing row.
  // setState-in-effect is the documented React pattern for "sync to external
  // prop on open" — the rule is silenced for this block intentionally.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    draftPathsRef.current = new Set();
    if (editing) {
      persistedBaselineRef.current = editing.attachmentUrl ?? null;
      setKind(editing.invoiceKind);
      setVendorId(editing.vendorId);
      setVehicleId(editing.vehicleId);
      setInvoiceNumber(editing.invoiceNumber ?? "");
      setInvoiceDate(editing.invoiceDate.slice(0, 10));
      setTotal(penceToPounds(editing.totalPence));
      setVat(penceToPounds(editing.vatPence));
      setDescription(editing.description);
      setNotes(editing.notes ?? "");
      setPreviousOwner(editing.previousOwner ?? "");
      setServiceHistoryRef(editing.serviceHistoryRef ?? "");
      setAttachment({
        path: editing.attachmentUrl,
        filename: editing.attachmentFilename,
        sizeBytes: editing.attachmentSizeBytes,
        mimeType: editing.attachmentMimeType,
      });
    } else {
      // Fresh form — reset everything (preserve fixedVehicleId).
      persistedBaselineRef.current = null;
      setKind(defaultKind);
      setVendorId("");
      setVehicleId(fixedVehicleId ?? "");
      setInvoiceNumber("");
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setTotal("");
      setVat("");
      setDescription("");
      setNotes("");
      setPreviousOwner("");
      setServiceHistoryRef("");
      setAttachment({
        path: null,
        filename: null,
        sizeBytes: null,
        mimeType: null,
      });
    }
  }, [open, editing, defaultKind, fixedVehicleId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId) ?? null,
    [vehicles, vehicleId],
  );

  const totalPence = useMemo(() => poundsToPence(total), [total]);
  const vatPence = useMemo(() => poundsToPence(vat), [vat]);
  const preVatPence = Math.max(0, totalPence - vatPence);
  const vatExceedsTotal = vatPence > totalPence && totalPence > 0;

  const valid =
    !!vendorId &&
    !!vehicleId &&
    !!invoiceDate &&
    totalPence > 0 &&
    !vatExceedsTotal &&
    description.trim().length > 0;

  /**
   * F-D3: wrap the AttachmentUploader's onChange so that:
   *  - every uploaded path is registered as a draft (cleanup-on-cancel target)
   *  - if the user replaces or clears an attachment that was a draft (i.e.
   *    uploaded in this session, not yet saved), purge it immediately so we
   *    don't leak orphans even mid-session.
   *  - the persisted baseline (the attachment that lives on `editing`) is
   *    NEVER auto-deleted — that's the responsibility of the service's
   *    update() path, which runs on save.
   */
  function handleAttachmentChange(next: typeof attachment) {
    const prevPath = attachment.path;
    if (
      prevPath &&
      prevPath !== next.path &&
      prevPath !== persistedBaselineRef.current
    ) {
      // The path we are about to overwrite was a draft → purge it now.
      void externalInvoiceService.removeAttachmentObject(prevPath);
      draftPathsRef.current.delete(prevPath);
    }
    if (next.path && next.path !== persistedBaselineRef.current) {
      draftPathsRef.current.add(next.path);
    }
    setAttachment(next);
  }

  /**
   * F-D3: when the dialog closes without a successful save, every entry in
   * `draftPathsRef` is an uploaded-but-unreferenced Storage object. Best-
   * effort delete each one. Called from both the Cancel button and the
   * native dialog dismiss handler.
   */
  function purgeDrafts() {
    for (const path of draftPathsRef.current) {
      if (path && path !== persistedBaselineRef.current) {
        void externalInvoiceService.removeAttachmentObject(path);
      }
    }
    draftPathsRef.current = new Set();
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      purgeDrafts();
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    if (!company?.id || !user?.id || !valid) return;
    setSubmitting(true);
    try {
      const payload = {
        invoiceKind: kind,
        invoiceNumber: invoiceNumber.trim() || null,
        vendorId,
        vehicleId,
        invoiceDate,
        totalPence,
        vatPence,
        description: description.trim(),
        notes: notes.trim() || null,
        previousOwner:
          kind === "auction_purchase" ? previousOwner.trim() || null : null,
        serviceHistoryRef:
          kind === "auction_purchase" ? serviceHistoryRef.trim() || null : null,
        attachmentUrl: attachment.path,
        attachmentFilename: attachment.filename,
        attachmentSizeBytes: attachment.sizeBytes,
        attachmentMimeType: attachment.mimeType,
      };
      let saved: ExternalInvoice;
      if (editing) {
        saved = await externalInvoiceService.update(
          editing.id,
          payload,
          user.id,
          company.id,
        );
        toast.success("Invoice updated");
      } else {
        saved = await externalInvoiceService.create(company.id, payload, user.id);
        toast.success("Invoice saved");
      }
      // F-D3 — the attachment (if any) is now persisted; remove from drafts
      // so the close handler doesn't try to delete it.
      draftPathsRef.current = new Set();
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      const obj = err as { message?: string; hint?: string; details?: string };
      toast.error(
        obj?.message ?? obj?.hint ?? obj?.details ?? "Could not save invoice",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!company?.id || !user?.id) return null;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit invoice" : "New invoice"}
          </DialogTitle>
          <DialogDescription>
            Records an inbound invoice the dealership has received.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="grid gap-4">
          {/* Kind toggle */}
          <div className="grid gap-1">
            <p className="inline-flex items-center gap-2 font-medium text-base/4.5 text-foreground sm:text-sm/4">
              Kind
            </p>
            <div className="flex gap-2">
              {(["auction_purchase", "external_job"] as InvoiceKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={
                    "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                    (kind === k
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted/40")
                  }
                >
                  {INVOICE_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor + inline add */}
          <div className="grid gap-1">
            <Label htmlFor={vendorFieldId}>
              Vendor <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Select
                items={Object.fromEntries(vendors.map((v) => [v.id, v.name]))}
                value={vendorId}
                onValueChange={setVendorId}
              >
                <SelectTrigger id={vendorFieldId} className="flex-1">
                  <SelectValue placeholder="Pick a vendor…" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {v.speciality}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <VendorInlineAdd
                companyId={company.id}
                existingVendors={vendors}
                onCreated={(v) => {
                  setVendors((curr) =>
                    curr.some((x) => x.id === v.id) ? curr : [...curr, v],
                  );
                  setVendorId(v.id);
                }}
              />
            </div>
          </div>

          {/* Auction-specific details — only meaningful for an auction purchase */}
          {kind === "auction_purchase" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor={previousOwnerFieldId}>Previous owner</Label>
                <Input
                  id={previousOwnerFieldId}
                  value={previousOwner}
                  onChange={(e) => setPreviousOwner(e.target.value)}
                  placeholder="If disclosed by the auction house"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={serviceHistoryRefFieldId}>Service history reference</Label>
                <Input
                  id={serviceHistoryRefFieldId}
                  value={serviceHistoryRef}
                  onChange={(e) => setServiceHistoryRef(e.target.value)}
                  placeholder="Booklet / pack reference"
                />
              </div>
            </div>
          )}

          {/* Vehicle — read-only chip when locked to one car, else a picker */}
          <div className="grid gap-1.5">
            <Label htmlFor={fixedVehicleId ? undefined : vehicleFieldId}>
              Vehicle <span className="text-destructive">*</span>
            </Label>
            {fixedVehicleId ? (
              <div className="flex items-center gap-2.5 rounded-md border bg-muted/30 px-3 py-2">
                {selectedVehicle ? (
                  <>
                    <RegPlate registration={selectedVehicle.registration} size="sm" />
                    <span className="text-sm font-medium">
                      {selectedVehicle.make} {selectedVehicle.model}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {selectedVehicle.stockId}
                    </span>
                    <span className="ml-auto text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                      Locked
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Loading vehicle…
                  </span>
                )}
              </div>
            ) : (
              // Stock runs past a hundred cars, so a scrolling dropdown is a
              // hunt for a plate the user already knows (GEN-79).
              <VehiclePicker
                id={vehicleFieldId}
                vehicles={vehicles}
                value={selectedVehicle}
                onChange={(v) => setVehicleId(v?.id ?? "")}
              />
            )}
          </div>

          {/* Invoice number + date */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor={invoiceNumberFieldId}>Invoice number</Label>
              <Input
                id={invoiceNumberFieldId}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="vendor's reference"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={invoiceDateFieldId}>
                Invoice date <span className="text-destructive">*</span>
              </Label>
              <Input
                id={invoiceDateFieldId}
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>

          {/* Money trio */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor={totalFieldId}>
                Total (inc. VAT) <span className="text-destructive">*</span>
              </Label>
              <Input
                id={totalFieldId}
                inputMode="decimal"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="£0.00"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={vatFieldId}>VAT</Label>
              <Input
                id={vatFieldId}
                inputMode="decimal"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                placeholder="£0.00"
                aria-invalid={vatExceedsTotal ? true : undefined}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-muted-foreground" htmlFor={preVatFieldId}>
                Pre-VAT (auto)
              </Label>
              <Input
                id={preVatFieldId}
                value={penceToPounds(preVatPence)}
                readOnly
                tabIndex={-1}
                className="bg-muted/40"
              />
            </div>
          </div>
          {vatExceedsTotal ? (
            <p className="-mt-1 text-xs text-destructive">
              VAT can&apos;t exceed Total.
            </p>
          ) : null}

          {/* Description */}
          <div className="grid gap-1">
            <Label htmlFor={descriptionFieldId}>
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={descriptionFieldId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was the job / what was purchased?"
              className="min-h-16"
            />
          </div>

          {/* Notes */}
          <div className="grid gap-1">
            <Label htmlFor={notesFieldId}>Notes (optional)</Label>
            <Textarea
              id={notesFieldId}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-12"
            />
          </div>

          {/* Attachment */}
          <div className="grid gap-1">
            <p className="inline-flex items-center gap-2 font-medium text-base/4.5 text-foreground sm:text-sm/4">
              Attachment (optional)
            </p>
            <AttachmentUploader
              companyId={company.id}
              vehicleId={vehicleId || null}
              value={attachment}
              onChange={handleAttachmentChange}
              disabled={submitting}
            />
          </div>
        </DialogPanel>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDialogOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!valid || submitting}
          >
            {submitting
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Save invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
