"use client";

import { useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  externalInvoiceService,
  type AttachmentUploadResult,
} from "@/lib/services/external-invoice-service";
import type { UUID } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  companyId: UUID;
  vehicleId: UUID | null;
  /** Current attachment metadata (null while none / before upload). */
  value: {
    path: string | null;
    filename: string | null;
    sizeBytes: number | null;
    mimeType: string | null;
  };
  onChange: (value: {
    path: string | null;
    filename: string | null;
    sizeBytes: number | null;
    mimeType: string | null;
  }) => void;
  disabled?: boolean;
  className?: string;
}

function prettyBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Spec v3.0 · Module D.4 — drag/drop or button-pick attachment slot.
 * Allowed: JPG, PNG, PDF up to 10 MB. Uploads to the
 * `external-invoices` Supabase Storage bucket; stores the object path.
 *
 * Empty state (no vehicle picked yet) shows a disabled placeholder
 * because the storage path is keyed by vehicleId.
 */
export function AttachmentUploader({
  companyId,
  vehicleId,
  value,
  onChange,
  disabled,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    if (!vehicleId) {
      toast.error("Pick a vehicle first — attachments are scoped to vehicles.");
      return;
    }
    setUploading(true);
    try {
      const result: AttachmentUploadResult =
        await externalInvoiceService.uploadAttachment(
          file,
          companyId,
          vehicleId,
        );
      onChange({
        path: result.path,
        filename: result.filename,
        sizeBytes: result.sizeBytes,
        mimeType: result.mimeType,
      });
      toast.success("Attachment uploaded");
    } catch (err) {
      const obj = err as { message?: string };
      toast.error(obj?.message ?? "Upload failed — try again");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    onChange({
      path: null,
      filename: null,
      sizeBytes: null,
      mimeType: null,
    });
  }

  const hasAttachment = !!value.path;
  const isImage = (value.mimeType ?? "").startsWith("image/");

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
        disabled={disabled || uploading}
      />
      {hasAttachment ? (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            {isImage ? (
              <ImageIcon className="size-4 text-muted-foreground" />
            ) : (
              <FileText className="size-4 text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{value.filename}</div>
            <div className="text-xs text-muted-foreground">
              {prettyBytes(value.sizeBytes)} · {value.mimeType}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            disabled={disabled || uploading}
            aria-label="Remove attachment"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-card px-3 py-6 text-sm text-muted-foreground transition-colors",
            dragOver
              ? "border-foreground/40 bg-muted/60"
              : "hover:bg-muted/40",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="size-4" />
              <span>Drag a file here, or click to choose</span>
              <span className="text-[10.5px]">JPG · PNG · PDF · ≤10MB</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
