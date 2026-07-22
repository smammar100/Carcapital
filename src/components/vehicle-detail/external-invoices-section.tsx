"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Gavel,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Receipt,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { externalInvoiceService } from "@/lib/services/external-invoice-service";
import { vendorService } from "@/lib/services/vendor-service";
import type {
  ExternalInvoice,
  InvoiceKind,
  UUID,
  Vendor,
} from "@/lib/types";
import { INVOICE_KIND_LABELS } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ExternalInvoiceForm } from "@/components/external-invoices";
import { Panel, Pill } from "./primitives";

interface Props {
  vehicleId: UUID;
}

/**
 * Spec v3.0 · Module D.5 — per-vehicle external-invoice strip on the
 * Financials tab. Shows total purchase-side + external-job spend, the
 * row list with attachment thumbnail + open-in-new-tab, and "+ Record"
 * buttons gated by `external_invoice:create`.
 */
export function ExternalInvoicesSection({ vehicleId }: Props) {
  const { company, user } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const canCreate = isSuperUser || can("external_invoice:create");
  const canEditAny = isSuperUser || can("external_invoice:edit_any");
  const canDelete = isSuperUser || can("external_invoice:delete");

  const [rows, setRows] = useState<ExternalInvoice[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState<InvoiceKind>("auction_purchase");
  const [editing, setEditing] = useState<ExternalInvoice | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!company?.id || !vehicleId) return;
    let cancelled = false;
    void Promise.all([
      externalInvoiceService.getByVehicle(vehicleId),
      vendorService.getAll(company.id),
    ]).then(([r, v]) => {
      if (cancelled) return;
      setRows(r);
      setVendors(v);
    });
    return () => {
      cancelled = true;
    };
  }, [company?.id, vehicleId, refreshTick]);

  const vendorById = useMemo(
    () => new Map(vendors.map((v) => [v.id, v])),
    [vendors],
  );

  const totalsByKind = useMemo(() => {
    const t = { auction_purchase: 0, external_job: 0 } as Record<
      InvoiceKind,
      number
    >;
    for (const r of rows ?? []) t[r.invoiceKind] += r.totalPence;
    return t;
  }, [rows]);

  const grandTotal = totalsByKind.auction_purchase + totalsByKind.external_job;

  function openNew(kind: InvoiceKind) {
    setDefaultKind(kind);
    setEditing(null);
    setFormOpen(true);
  }

  async function handleOpenAttachment(path: string) {
    const url = await externalInvoiceService.signedAttachmentUrl(path);
    if (!url) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(inv: ExternalInvoice) {
    if (!user?.id || !company?.id) return;
    if (!confirm(`Delete this invoice (${formatCurrency(inv.totalPence / 100)})?`)) {
      return;
    }
    try {
      await externalInvoiceService.delete(inv.id, user.id, company.id);
      setRows((curr) => (curr ?? []).filter((r) => r.id !== inv.id));
      toast.success("Invoice deleted");
    } catch (err) {
      const obj = err as { message?: string };
      toast.error(obj?.message ?? "Could not delete invoice");
    }
  }

  return (
    <Panel
      title="External Invoices"
      subtitle="Auction-purchase + external-job spend logged against this vehicle"
      action={
        canCreate ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openNew("auction_purchase")}
            >
              <Plus className="mr-1 size-3.5" /> Purchase
            </Button>
            <Button type="button" size="sm" onClick={() => openNew("external_job")}>
              <Plus className="mr-1 size-3.5" /> External Job
            </Button>
          </div>
        ) : (
          <Pill tone="info">{formatCurrency(grandTotal / 100)}</Pill>
        )
      }
      flush
    >
      {/* Summary tiles */}
      <div className="grid gap-3 px-4 pb-3 sm:grid-cols-3">
        <InvoiceStat
          icon={Gavel}
          label="Auction Purchase"
          total={totalsByKind.auction_purchase}
          count={(rows ?? []).filter((r) => r.invoiceKind === "auction_purchase").length}
        />
        <InvoiceStat
          icon={Wrench}
          label="External Jobs"
          total={totalsByKind.external_job}
          count={(rows ?? []).filter((r) => r.invoiceKind === "external_job").length}
        />
        <InvoiceStat
          icon={Receipt}
          label="Total Logged"
          total={grandTotal}
          count={(rows ?? []).length}
          accent
        />
      </div>

      {/* Rows */}
      <div className="divide-y border-t">
        {rows === null ? (
          <>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-9 w-9 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </>
        ) : rows.length === 0 ? (
          <div className="px-4 py-4 text-xs text-muted-foreground">
            No external invoices logged yet, use{" "}
            <span className="font-medium text-foreground">Purchase</span> or{" "}
            <span className="font-medium text-foreground">External Job</span> above to add one.
          </div>
        ) : (
          rows.map((r) => {
            const vendor = vendorById.get(r.vendorId);
            const isImage = (r.attachmentMimeType ?? "").startsWith("image/");
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                {/* Kind chip */}
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide",
                    r.invoiceKind === "auction_purchase"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-indigo-100 text-indigo-800",
                  )}
                >
                  {INVOICE_KIND_LABELS[r.invoiceKind]}
                </span>
                {/* Attachment thumbnail */}
                <button
                  type="button"
                  disabled={!r.attachmentUrl}
                  onClick={() =>
                    r.attachmentUrl && handleOpenAttachment(r.attachmentUrl)
                  }
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40",
                    r.attachmentUrl
                      ? "hover:bg-muted"
                      : "opacity-50 cursor-not-allowed",
                  )}
                  title={
                    r.attachmentUrl
                      ? "Open attachment"
                      : "No attachment"
                  }
                  aria-label="Open attachment"
                >
                  {r.attachmentUrl ? (
                    isImage ? (
                      <ImageIcon className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )
                  ) : (
                    <Paperclip className="size-4" />
                  )}
                </button>
                {/* Description + vendor */}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium">
                    {r.description}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {vendor?.name ?? "Unknown vendor"} ·{" "}
                    {formatDate(r.invoiceDate)}
                    {r.invoiceNumber ? ` · #${r.invoiceNumber}` : null}
                  </div>
                </div>
                {/* Total */}
                <div className="text-right tabular-nums">
                  <div className="font-medium">
                    {formatCurrency(r.totalPence / 100)}
                  </div>
                  {r.vatPence > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      incl. VAT {formatCurrency(r.vatPence / 100)}
                    </div>
                  ) : null}
                </div>
                {/* Actions */}
                <div className="ml-2 flex shrink-0 items-center gap-1">
                  {canEditAny ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(r);
                        setDefaultKind(r.invoiceKind);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title="Delete"
                      onClick={() => handleDelete(r)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ExternalInvoiceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultKind={defaultKind}
        fixedVehicleId={vehicleId}
        editing={editing}
        onSaved={() => {
          setEditing(null);
          setRefreshTick((t) => t + 1);
        }}
      />
    </Panel>
  );
}

function InvoiceStat({
  icon: Icon,
  label,
  total,
  count,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  total: number;
  count: number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background p-4",
        accent && "bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {formatCurrency(total / 100)}
      </div>
      <div className="text-2xs text-muted-foreground">
        {count} invoice{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}
