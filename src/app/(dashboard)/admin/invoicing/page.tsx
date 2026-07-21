"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  Pencil,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  TrendingUp,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { invoiceService } from "@/lib/services/invoice-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import {
  companyInvoiceFields,
  openBlobInNewTab,
  pdfService,
} from "@/lib/services/pdf-service";
import type { Invoice, InvoiceType, Vehicle } from "@/lib/types";
import { ExternalInvoiceList } from "@/components/external-invoices";
import { InvoiceDetailDialog } from "@/components/invoicing/invoice-detail-dialog";
import { RegPlate } from "@/components/shared/reg-plate";
import {
  FilterBar,
  matchesFilterState,
  useFilterState,
  type SelectFilter,
} from "@/components/filters/filter-bar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Filter = InvoiceType | "all";
type TopTab = "sales" | "purchase" | "external_job";

const TOP_TAB_VALUES: ReadonlySet<TopTab> = new Set([
  "sales",
  "purchase",
  "external_job",
]);

function parseTopTab(v: string | null): TopTab {
  return v && TOP_TAB_VALUES.has(v as TopTab) ? (v as TopTab) : "sales";
}

export default function InvoicingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, company } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const canEdit = isSuperUser || can("invoice:edit");
  // Recording/uploading an invoice is a write — gate it behind invoice edit or
  // external-invoice create authority rather than leaving it always-on.
  const canUpload =
    isSuperUser || can("invoice:edit") || can("external_invoice:create");
  // F-D5: top-tab state is mirrored in `?tab=` so the URL is a
  // deep-linkable + bookmarkable surface.
  const topTab: TopTab = parseTopTab(searchParams.get("tab"));
  function setTopTab(next: TopTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "sales") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(qs ? `/admin/invoicing?${qs}` : "/admin/invoicing", {
      scroll: false,
    });
  }
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const { state: filters, setState: setFilters } = useFilterState();
  const [vat, setVat] = useState<{
    inputVat: number;
    outputVat: number;
    net: number;
  } | null>(null);

  // View / Email / Upload state
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [emailing, setEmailing] = useState<Invoice | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFields, setUploadFields] = useState({
    type: "purchase" as InvoiceType,
    partyName: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    total: "",
  });

  const refresh = async () => {
    if (!company) return;
    const [list, summary] = await Promise.all([
      invoiceService.getAll(company.id),
      invoiceService.vatSummary(company.id),
    ]);
    setInvoices(list);
    setVat(summary);
  };

  useEffect(() => {
    // refresh() sets invoices/vat after an async load — a deliberate data-fetch
    // effect, not a synchronous render-loop setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  // Vehicles power the reg search in the filter bar (GEN-23).
  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then(setVehicles);
  }, [company]);

  const vehicleById = useMemo(() => {
    const m = new Map<string, Vehicle>();
    vehicles.forEach((v) => m.set(v.id, v));
    return m;
  }, [vehicles]);

  // Deep-link: `?view=<invoiceId>` opens that invoice's detail modal (e.g. when
  // clicking a row in Closed Deals, GEN-21). Consume the param once loaded so
  // closing the modal doesn't immediately re-open it.
  useEffect(() => {
    const viewId = searchParams.get("view");
    if (!viewId || !invoices) return;
    const inv = invoices.find((i) => i.id === viewId);
    if (!inv) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewing(inv);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, invoices, router]);

  const filtered = useMemo(() => {
    if (!invoices) return null;
    if (filter === "all") return invoices;
    return invoices.filter((i) => i.type === filter);
  }, [invoices, filter]);

  // SPEC Point 4 — sale invoices that a refund invoice reverses, so we
  // can badge them "Refunded" (derived; no schema needed).
  const refundedSaleIds = useMemo(() => {
    const s = new Set<string>();
    for (const i of invoices ?? []) {
      if (i.type === "refund" && i.relatedInvoiceId) {
        s.add(i.relatedInvoiceId);
      }
    }
    return s;
  }, [invoices]);

  // SPEC Point 5 — refunds summary (this month / YTD / count).
  const refundSummary = useMemo(() => {
    const now = new Date();
    const yStart = `${now.getFullYear()}-01-01`;
    const mStart = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}-01`;
    let month = 0;
    let ytd = 0;
    let count = 0;
    for (const i of invoices ?? []) {
      if (i.type !== "refund") continue;
      count++;
      if (i.invoiceDate >= yStart) ytd += i.total;
      if (i.invoiceDate >= mStart) month += i.total;
    }
    return { month, ytd, count };
  }, [invoices]);

  // KPI cards (Variation A) — derived from sale + refund invoices.
  const kpis = useMemo(() => {
    const all = invoices ?? [];
    const sales = all.filter((i) => i.type === "sale");
    const sum = (arr: Invoice[]) => arr.reduce((a, i) => a + i.total, 0);
    const outstanding = sales.filter(
      (i) => i.status !== "paid" && i.status !== "cancelled",
    );
    const paidSales = sales.filter((i) => i.status === "paid");
    const refunds = all.filter((i) => i.type === "refund");
    return {
      invoiced: sum(sales),
      invoicedN: sales.length,
      outstanding: sum(outstanding),
      outstandingN: outstanding.length,
      paid: sum(paidSales),
      paidN: paidSales.length,
      refunds: sum(refunds),
      refundsN: refunds.length,
    };
  }, [invoices]);

  // Status options derived from the visible invoices (schema-driven, GEN-23).
  const statusFilters: SelectFilter[] = useMemo(() => {
    if (!filtered) return [];
    const set = new Set(filtered.map((i) => i.status));
    if (set.size === 0) return [];
    return [
      {
        key: "status",
        label: "Status",
        allLabel: "All statuses",
        options: [...set]
          .sort()
          .map((s) => ({ value: s, label: INV_STATUS[s]?.label ?? s })),
      },
    ];
  }, [filtered]);

  // Search (invoice # / customer / vehicle reg) + invoice-date range + status,
  // applied on top of the type tab (GEN-23).
  const searched = useMemo(() => {
    if (!filtered) return null;
    return filtered.filter((i) =>
      matchesFilterState(i, filters, {
        searchText: () =>
          [
            i.invoiceNumber,
            i.partyName,
            i.buyerName,
            i.vehicleId ? vehicleById.get(i.vehicleId)?.registration : null,
          ]
            .filter(Boolean)
            .join(" "),
        date: () => i.invoiceDate,
        selectValue: (_row, key) => (key === "status" ? i.status : null),
      }),
    );
  }, [filtered, filters, vehicleById]);

  async function handleSendEmail() {
    if (!emailing || !user) return;
    await invoiceService.updateStatus(emailing.id, "sent", user.id);
    toast.success(`Sent to ${emailing.partyEmail ?? emailing.partyName}`);
    setEmailing(null);
    void refresh();
  }

  async function handlePrint(inv: Invoice) {
    if (!company) return;
    const blob = await pdfService.generateInvoice({
      invoice: inv,
      ...companyInvoiceFields(company),
    });
    openBlobInNewTab(blob);
  }

  async function handleUpload() {
    if (!user || !company) return;
    const total = Number(uploadFields.total);
    if (Number.isNaN(total) || total <= 0) {
      toast.error("Enter a valid total");
      return;
    }
    await invoiceService.create(
      {
        companyId: company.id,
        type: uploadFields.type,
        vehicleId: null,
        partyName: uploadFields.partyName,
        partyPhone: null,
        partyEmail: null,
        invoiceDate: uploadFields.invoiceDate,
        dueDate: null,
        vatScheme: "zero_rated",
        lineItems: [
          {
            type: "addon_paid",
            addonCategory: null,
            description: "Uploaded invoice",
            quantity: 1,
            unitPrice: total,
            total,
            lineType: "fee",
            addonType: null,
            vatRate: 0,
          },
        ],
        payment: null,
        notes: uploadFile ? `Attached: ${uploadFile.name}` : null,
        attachmentUrl: uploadFile ? `mock://${uploadFile.name}` : null,
      },
      user.id,
    );
    toast.success("Invoice recorded");
    setUploadOpen(false);
    setUploadFile(null);
    setUploadFields({
      type: "purchase",
      partyName: "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      total: "",
    });
    void refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoicing</h1>
          <p className="text-sm text-muted-foreground">
            Every invoice in one place: the company ledger (sales, refunds and
            recorded purchase invoices), auction purchase bills, and external
            job bills.
          </p>
        </div>
        {topTab === "sales" && canUpload ? (
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-1.5 h-4 w-4" />
              Upload Invoice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Invoice</DialogTitle>
              <DialogDescription>
                Capture an external invoice (PDF / image attachment).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 px-6 pb-6">
              <div>
                <Label>Type</Label>
                <Select
                  value={uploadFields.type}
                  onValueChange={(v) =>
                    setUploadFields((f) => ({ ...f, type: v as InvoiceType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="sale">Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Party name</Label>
                <Input
                  value={uploadFields.partyName}
                  onChange={(e) =>
                    setUploadFields((f) => ({ ...f, partyName: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Invoice date</Label>
                  <Input
                    type="date"
                    value={uploadFields.invoiceDate}
                    onChange={(e) =>
                      setUploadFields((f) => ({
                        ...f,
                        invoiceDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Total (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={uploadFields.total}
                    onChange={(e) =>
                      setUploadFields((f) => ({ ...f, total: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Attachment</Label>
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) =>
                    setUploadFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        ) : null}
      </div>

      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)}>
        {/* Tab names must say what their dataset IS (GEN-46): the first tab is
            the company invoice LEDGER (sale/refund/purchase types — the chips
            below filter it); the other two are the vendor-bill modules. The
            old "Sales" / "Purchase Invoices" pair meant a purchase invoice
            lived under "Sales" while "Purchase Invoices" sat empty. */}
        <TabsList>
          <TabsTrigger value="sales">All Invoices</TabsTrigger>
          <TabsTrigger value="purchase">Auction Purchases</TabsTrigger>
          <TabsTrigger value="external_job">External Job Bills</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4 flex flex-col gap-4">

      {/* KPI cards (Variation A) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={TrendingUp}
          label="Total invoiced"
          value={formatCurrency(kpis.invoiced)}
          sub={`${kpis.invoicedN} invoice${kpis.invoicedN === 1 ? "" : "s"}`}
        />
        <KpiCard
          icon={Clock}
          label="Outstanding"
          value={formatCurrency(kpis.outstanding)}
          sub={`${kpis.outstandingN} unpaid`}
          tone="text-amber-600 dark:text-amber-400"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Paid"
          value={formatCurrency(kpis.paid)}
          sub={`${kpis.paidN} settled`}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          icon={RotateCcw}
          label="Refunds"
          value={formatCurrency(kpis.refunds)}
          sub={`${kpis.refundsN} issued`}
          tone="text-rose-600 dark:text-rose-400"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="purchase">Purchase</TabsTrigger>
            <TabsTrigger value="sale">Sales</TabsTrigger>
            <TabsTrigger value="refund">Refunds / Cancellations</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <FilterBar
        state={filters}
        onChange={setFilters}
        searchPlaceholder="Search invoice #, customer, reg…"
        dateLabel="Invoice"
        selects={statusFilters}
      />

      {filter === "refund" && (
        <Card className="flex flex-wrap gap-6 p-4 text-sm">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Refunds this month
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {formatCurrency(refundSummary.month)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Refunds YTD
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {formatCurrency(refundSummary.ytd)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total refund invoices
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {refundSummary.count}
            </div>
          </div>
        </Card>
      )}

      {!searched ? (
        <Skeleton className="h-72" />
      ) : searched.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices in this view"
          description="Switch tabs or create one."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Invoice #</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Party</th>
                <th className="px-3 py-2.5 font-medium">Reg</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 text-right font-medium">Subtotal</th>
                <th className="px-3 py-2.5 text-right font-medium">VAT</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {searched.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => setViewing(inv)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/30"
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="font-mono text-xs">
                      {inv.invoiceNumber}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1">
                      <TypeChip type={inv.type} />
                      {refundedSaleIds.has(inv.id) && (
                        <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                          Refunded
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar name={inv.partyName} />
                      <span className="truncate">{inv.partyName}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {inv.vehicleId && vehicleById.get(inv.vehicleId) ? (
                      <RegPlate
                        registration={vehicleById.get(inv.vehicleId)!.registration}
                        size="sm"
                      />
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {formatDate(inv.invoiceDate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    {formatCurrency(inv.subtotal)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(inv.vatAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">
                    {formatCurrency(inv.total)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={inv.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {inv.type === "sale" &&
                        inv.status !== "paid" &&
                        inv.status !== "cancelled" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={!canEdit}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/sales/invoice-generation?invoiceId=${inv.id}`,
                              );
                            }}
                            title={
                              canEdit
                                ? "Edit"
                                : "Permission required: Edit Invoice"
                            }
                            data-testid={`edit-invoice-${inv.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewing(inv);
                        }}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={!can("invoice:send")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailing(inv);
                        }}
                        title={
                          can("invoice:send")
                            ? "Email"
                            : "Permission required: Send Invoice"
                        }
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePrint(inv);
                        }}
                        title="Print PDF"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold">VAT summary</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Input VAT (purchases) − Output VAT (sales) = net.
        </p>
        {vat ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <Stat label="Input VAT (purchases)" value={vat.inputVat} />
            <Stat label="Output VAT (sales)" value={vat.outputVat} />
            <Stat
              label="Net VAT"
              value={vat.net}
              tone={vat.net > 0 ? "negative" : "positive"}
            />
          </div>
        ) : (
          <Skeleton className="mt-3 h-10" />
        )}
      </Card>
        </TabsContent>

        <TabsContent value="purchase" className="mt-4">
          <ExternalInvoiceList kind="auction_purchase" />
        </TabsContent>

        <TabsContent value="external_job" className="mt-4">
          <ExternalInvoiceList kind="external_job" />
        </TabsContent>
      </Tabs>

      {/* View modal — shared in-app invoice detail (also used on Closed Deals). */}
      <InvoiceDetailDialog
        invoice={viewing}
        company={company}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
        // A payment can flip the invoice to Paid, so the list behind the
        // dialog has to re-read it (GEN-73).
        onChanged={() => void refresh()}
      />

      {/* Email modal */}
      <Dialog
        open={emailing !== null}
        onOpenChange={(o) => {
          if (!o) setEmailing(null);
        }}
      >
        <DialogContent>
          {emailing && (
            <>
              <DialogHeader>
                <DialogTitle>Email {emailing.invoiceNumber}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 px-6 pb-6">
                <div>
                  <Label>To</Label>
                  <Input
                    defaultValue={emailing.partyEmail ?? ""}
                    placeholder="recipient@example.com"
                  />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input
                    defaultValue={`Invoice ${emailing.invoiceNumber}`}
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    defaultValue={`Please find your invoice attached.`}
                    className="min-h-24"
                  />
                </div>
                <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Mock send: marks invoice as sent and writes activity log.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEmailing(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSendEmail}>
                  <Plus className="mr-1.5 h-4 w-4" /> Send
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* Variation A helpers --------------------------------------------------- */

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div
        className={cn("mt-1.5 text-2xl font-semibold tabular-nums", tone)}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  issued: {
    label: "Issued",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  sent: {
    label: "Sent",
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  paid: {
    label: "Paid",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
};

function StatusPill({ status }: { status: string }) {
  const m =
    INV_STATUS[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

function TypeChip({ type }: { type: InvoiceType }) {
  if (type === "refund") {
    return (
      <span className="inline-flex items-center rounded-md bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
        Refund
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-foreground/75">
      {type}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials =
    !name || name === "—"
      ? "?"
      : name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-base font-semibold tabular-nums ${
          tone === "positive"
            ? "text-emerald-600"
            : tone === "negative"
              ? "text-rose-600"
              : ""
        }`}
      >
        {formatCurrency(value)}
      </div>
    </div>
  );
}
