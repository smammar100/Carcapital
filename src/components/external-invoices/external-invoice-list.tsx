"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Image as ImageIcon, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
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
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ExternalInvoiceForm } from "./external-invoice-form";

interface Props {
  kind: InvoiceKind;
}

/**
 * Spec v3.0 · Module D — list of external/purchase invoices for a
 * single kind tab. Toolbar (search + vendor filter + New invoice),
 * table of rows, click attachment icon for signed-URL preview, Edit /
 * Delete actions gated by `external_invoice:*` caps.
 */
export function ExternalInvoiceList({ kind }: Props) {
  const { company, user } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const canCreate = isSuperUser || can("external_invoice:create");
  const canEditAny = isSuperUser || can("external_invoice:edit_any");
  const canDelete = isSuperUser || can("external_invoice:delete");

  const [rows, setRows] = useState<ExternalInvoice[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<UUID | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalInvoice | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    void Promise.all([
      externalInvoiceService.getByKind(company.id, kind),
      vendorService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([r, vd, vh]) => {
      if (cancelled) return;
      setRows(r);
      setVendors(vd);
      setVehicles(vh);
    });
    return () => {
      cancelled = true;
    };
  }, [company?.id, kind, formOpen]);

  const vendorById = useMemo(
    () => new Map(vendors.map((v) => [v.id, v])),
    [vendors],
  );
  const vehicleById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (vendorFilter !== "all" && r.vendorId !== vendorFilter) return false;
      if (!q) return true;
      const vendor = vendorById.get(r.vendorId)?.name ?? "";
      const veh = vehicleById.get(r.vehicleId);
      const vehStr = veh ? `${veh.stockId} ${veh.registration} ${veh.make} ${veh.model}` : "";
      return (
        vendor.toLowerCase().includes(q) ||
        vehStr.toLowerCase().includes(q) ||
        (r.invoiceNumber ?? "").toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [rows, search, vendorFilter, vendorById, vehicleById]);

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
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${INVOICE_KIND_LABELS[kind].toLowerCase()}…`}
          className="h-9 w-64"
        />
        <Select
          value={vendorFilter}
          onValueChange={(v) => setVendorFilter(v as UUID | "all")}
        >
          <SelectTrigger className="h-9 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vendors</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          {canCreate ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" />
              New invoice
            </Button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Vendor</th>
              <th className="px-3 py-2 text-left font-medium">Vehicle</th>
              <th className="px-3 py-2 text-left font-medium">Invoice #</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <SkeletonRows />
            ) : filtered && filtered.length > 0 ? (
              filtered.map((r) => {
                const vendor = vendorById.get(r.vendorId);
                const veh = vehicleById.get(r.vehicleId);
                return (
                  <tr
                    key={r.id}
                    className="border-t transition-colors hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 align-top text-xs tabular-nums">
                      {formatDate(r.invoiceDate)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {vendor?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {veh ? (
                        <Link
                          href={`/vehicles/${veh.id}`}
                          className="font-medium hover:underline"
                        >
                          {veh.stockId}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {veh ? (
                        <div className="text-muted-foreground">
                          {veh.registration}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-xs">
                      {r.invoiceNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="line-clamp-2 max-w-md text-sm">
                        {r.description}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right tabular-nums">
                      {formatCurrency(r.totalPence / 100)}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <div className="inline-flex items-center gap-1">
                        {r.attachmentUrl ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            title="View attachment"
                            onClick={() => handleOpenAttachment(r.attachmentUrl!)}
                          >
                            {(r.attachmentMimeType ?? "").startsWith("image/") ? (
                              <ImageIcon className="size-3.5" />
                            ) : (
                              <FileText className="size-3.5" />
                            )}
                          </Button>
                        ) : (
                          <span title="No attachment">
                            <Paperclip
                              className={cn("size-3.5 opacity-30")}
                              aria-hidden
                            />
                          </span>
                        )}
                        {canEditAny ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(r);
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
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-sm italic text-muted-foreground"
                >
                  No {INVOICE_KIND_LABELS[kind].toLowerCase()} invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows && filtered ? (
        <div className="text-xs text-muted-foreground">
          {filtered.length} of {rows.length} invoice
          {rows.length === 1 ? "" : "s"}
          {search || vendorFilter !== "all" ? " (filtered)" : ""}
        </div>
      ) : null}

      {/* Form dialog (Create / Edit) */}
      <ExternalInvoiceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultKind={kind}
        editing={editing}
        onSaved={() => {
          // List re-fetches via the `formOpen` dep on the load effect.
          setEditing(null);
        }}
      />
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-t">
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-3 py-3">
              <Skeleton className="h-3 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
