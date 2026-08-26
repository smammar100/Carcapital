"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Handshake, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { salesService } from "@/lib/services/sales-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { authService } from "@/lib/services/auth-service";
import { invoiceService } from "@/lib/services/invoice-service";
import {
  companyInvoiceFields,
  downloadBlob,
  pdfService,
} from "@/lib/services/pdf-service";
import { toast } from "@/lib/toast";
import type { Invoice, SalesDeal, User, Vehicle } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import {
  DataGridGroupHeaderRow,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridTable,
  useRowGroups,
  useSort,
  type ColumnDef,
} from "@/components/data-grid";
import {
  FilterBar,
  matchesFilterState,
  useFilterState,
  type SelectFilter,
} from "@/components/filters/filter-bar";
import { InvoiceDetailDialog } from "@/components/invoicing/invoice-detail-dialog";

/**
 * A vehicle's purchase source as a single filterable label — the auction house
 * for auction buys (so "BCA" is a first-class option, per the client's
 * BCA-vs-non-BCA use case), otherwise the purchase-source type.
 */
const SOURCE_TYPE_LABEL: Record<string, string> = {
  private: "Private",
  trade_in: "Trade-in",
  dealer: "Dealer",
  other: "Other",
};
function sourceLabel(v: Vehicle | undefined): string {
  if (!v) return "—";
  if (v.purchaseSource === "auction") {
    return v.auctionHouse?.trim() || "Auction";
  }
  return SOURCE_TYPE_LABEL[v.purchaseSource] ?? "Other";
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
/** "2026-07" → "July 2026" for the monthly group banners. */
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const month = MONTHS[Number(m) - 1];
  return month ? `${month} ${y}` : key;
}
const dealDate = (d: SalesDeal): string => d.completionDate ?? d.updatedAt;
const dealPrice = (d: SalesDeal): number | null =>
  d.agreedPrice ?? d.offerPrice ?? null;

export default function DealsPage() {
  const { company } = useAuth();
  const [deals, setDeals] = useState<SalesDeal[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      salesService.getAll(company.id),
      vehicleService.getAll(company.id),
      authService.getUsersForCompany(company.id),
      invoiceService.getAll(company.id),
    ]).then(([d, v, u, inv]) => {
      setDeals(d);
      setVehicles(v);
      setUsers(u);
      setInvoices(inv);
    });
  }, [company]);

  const { state: filters, setState: setFilters } = useFilterState();

  const vehicleById = useMemo(() => {
    const m = new Map<string, Vehicle>();
    vehicles.forEach((v) => m.set(v.id, v));
    return m;
  }, [vehicles]);
  const userById = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);
  // Resolve a completed sale's invoice: prefer the explicit saleId link, else
  // fall back to the sale invoice for the deal's vehicle (demo data doesn't
  // always populate saleId).
  const invoiceForDeal = useMemo(() => {
    const bySale = new Map<string, Invoice>();
    const saleByVehicle = new Map<string, Invoice>();
    invoices.forEach((i) => {
      if (i.saleId) bySale.set(i.saleId, i);
      if (i.type === "sale" && i.vehicleId && !saleByVehicle.has(i.vehicleId)) {
        saleByVehicle.set(i.vehicleId, i);
      }
    });
    return (d: SalesDeal): Invoice | undefined =>
      bySale.get(d.id) ?? saleByVehicle.get(d.vehicleId);
  }, [invoices]);

  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  async function downloadInvoice(inv: Invoice): Promise<void> {
    if (!company) return;
    setDownloadingId(inv.id);
    try {
      const vehicle = inv.vehicleId ? (vehicleById.get(inv.vehicleId) ?? null) : null;
      const blob = await pdfService.generateInvoice({
        invoice: inv,
        vehicle,
        ...companyInvoiceFields(company),
      });
      downloadBlob(blob, `${inv.invoiceNumber}.pdf`);
    } catch {
      toast.error("Couldn't generate the invoice PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  // Only completed sales that actually have an invoice are shown — an
  // un-invoiced deal isn't a fully closed sale to review here (client decision,
  // 2026-07-14).
  const closed = useMemo(
    () =>
      deals?.filter(
        (d) => d.stage === "completed_sale" && invoiceForDeal(d),
      ) ?? null,
    [deals, invoiceForDeal],
  );

  // Source options derived from the actual closed deals (schema-driven), so
  // specific auction houses (e.g. "BCA Auction") only appear when present.
  const sourceFilters: SelectFilter[] = useMemo(() => {
    if (!closed) return [];
    const labels = new Set<string>();
    closed.forEach((d) => {
      const label = sourceLabel(vehicleById.get(d.vehicleId));
      if (label !== "—") labels.add(label);
    });
    if (labels.size === 0) return [];
    return [
      {
        key: "source",
        label: "Source",
        allLabel: "All sources",
        options: [...labels].sort().map((l) => ({ value: l, label: l })),
      },
    ];
  }, [closed, vehicleById]);

  const filtered = useMemo(() => {
    if (!closed) return null;
    return closed.filter((d) => {
      const v = vehicleById.get(d.vehicleId);
      return matchesFilterState(d, filters, {
        searchText: () =>
          [v?.registration, v?.make, v?.model, v?.stockId, d.customerName]
            .filter(Boolean)
            .join(" "),
        date: () => dealDate(d),
        selectValue: (_row, key) => (key === "source" ? sourceLabel(v) : null),
      });
    });
  }, [closed, filters, vehicleById]);

  // Sorting — default newest completion first.
  const { sorted, sortKey, sortDir, onSort } = useSort<SalesDeal>(
    filtered ?? undefined,
    {
      reg: (a, b) =>
        (vehicleById.get(a.vehicleId)?.registration ?? "").localeCompare(
          vehicleById.get(b.vehicleId)?.registration ?? "",
        ),
      customerName: (a, b) => a.customerName.localeCompare(b.customerName),
      price: (a, b) => (dealPrice(a) ?? 0) - (dealPrice(b) ?? 0),
      completed: (a, b) => dealDate(a).localeCompare(dealDate(b)),
    },
    { key: "completed", dir: "desc" },
  );

  // Monthly grouping — the client reviews completed sales month by month.
  const { groups, isCollapsed, toggle } = useRowGroups(
    sorted,
    (d) => dealDate(d).slice(0, 7),
    monthLabel,
  );

  // Not memoized: the Invoice column closes over downloadingId so its spinner
  // stays current. The table is small, so rebuilding the column list is cheap.
  const cols: ColumnDef<SalesDeal>[] = [
      {
        key: "vehicle",
        label: "Vehicle",
        type: "custom",
        sortable: true,
        sortKey: "reg",
        width: 240,
        render: (d) => {
          const v = vehicleById.get(d.vehicleId);
          return (
            <div className="flex min-w-0 items-center gap-2">
              {v ? (
                <RegPlate registration={v.registration} size="sm" />
              ) : null}
              <span className="truncate text-xs text-muted-foreground">
                {v ? `${v.make} ${v.model} · ${v.stockId}` : "—"}
              </span>
            </div>
          );
        },
      },
      {
        key: "customerName",
        label: "Customer",
        type: "text",
        sortable: true,
        width: 160,
      },
      {
        key: "price",
        label: "Price",
        type: "currency",
        sortable: true,
        width: 110,
        get: dealPrice,
      },
      {
        key: "source",
        label: "Source",
        type: "text",
        width: 130,
        get: (d) => sourceLabel(vehicleById.get(d.vehicleId)),
      },
      {
        key: "agent",
        label: "Agent",
        type: "user",
        width: 150,
        get: (d) => userById.get(d.sellingAgent ?? "")?.name ?? null,
      },
      {
        key: "completed",
        label: "Completed",
        type: "date",
        sortable: true,
        width: 120,
        get: dealDate,
      },
      {
        key: "invoice",
        label: "Invoice",
        type: "custom",
        width: 130,
        render: (d) => {
          const inv = invoiceForDeal(d);
          if (!inv) return null;
          return (
            <div className="flex items-center gap-1">
              <button
                type="button"
                title={`View ${inv.invoiceNumber}`}
                aria-label={`View invoice ${inv.invoiceNumber}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingInvoice(inv);
                }}
                className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title={`Download ${inv.invoiceNumber}`}
                aria-label={`Download invoice ${inv.invoiceNumber}`}
                disabled={downloadingId === inv.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void downloadInvoice(inv);
                }}
                className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {downloadingId === inv.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          );
        },
      },
    ];

  // Row click → open the invoice detail in place (a modal on this page, not a
  // navigation to Invoicing — GEN-42).
  function openDeal(d: SalesDeal): void {
    const inv = invoiceForDeal(d);
    if (inv) setViewingInvoice(inv);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Completed Sale</h1>
        <p className="text-sm text-muted-foreground">
          Your completed sales history. For deals still in progress, see the{" "}
          <Link href="/sales/pipeline" className="text-primary hover:underline">
            Sales Pipeline
          </Link>
          .
        </p>
      </div>

      {closed && closed.length > 0 && (
        <FilterBar
          state={filters}
          onChange={setFilters}
          searchPlaceholder="Search reg, make/model, customer…"
          dateLabel="Completed"
          selects={sourceFilters}
        />
      )}

      {!closed || !groups ? (
        <Skeleton className="h-72" />
      ) : closed.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No completed sales yet"
          description="Move a pipeline card to Completed Sale to see it here."
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No deals match your filters"
          description="Try widening the date range or clearing a filter."
        />
      ) : (
        <DataGridShell className="min-h-0 flex-1">
          <DataGridTable cols={cols}>
            <DataGridHeaderRow
              cols={cols}
              sortKey={sortKey ?? undefined}
              sortDir={sortDir}
              onSort={onSort}
            />
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  <DataGridGroupHeaderRow
                    label={g.label}
                    count={g.rows.length}
                    collapsed={isCollapsed(g.key)}
                    onToggle={() => toggle(g.key)}
                    span={cols.length}
                  />
                  {!isCollapsed(g.key) &&
                    g.rows.map((d, i) => (
                      <DataGridRow
                        key={d.id}
                        row={d}
                        cols={cols}
                        index={i}
                        onClick={openDeal}
                      />
                    ))}
                </Fragment>
              ))}
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}

      <InvoiceDetailDialog
        invoice={viewingInvoice}
        company={company}
        vehicle={
          viewingInvoice?.vehicleId
            ? (vehicleById.get(viewingInvoice.vehicleId) ?? null)
            : null
        }
        onOpenChange={(o) => {
          if (!o) setViewingInvoice(null);
        }}
      />
    </div>
  );
}
