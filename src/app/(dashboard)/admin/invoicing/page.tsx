"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Loader2,
  Mail,
  Plus,
  Printer,
  Receipt,
  Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { invoiceService } from "@/lib/services/invoice-service";
import {
  downloadBlob,
  openBlobInNewTab,
  pdfService,
} from "@/lib/services/pdf-service";
import type { Invoice, InvoiceType } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
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
import {
  type ColumnDef,
  DataGridFooterRow,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridSkeletonRows,
  DataGridTable,
} from "@/components/data-grid";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Filter = InvoiceType | "all";

export default function InvoicingPage() {
  const { user, company } = useAuth();
  const { can } = usePermissions();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [vat, setVat] = useState<{
    inputVat: number;
    outputVat: number;
    net: number;
  } | null>(null);
  const [vatRange, setVatRange] = useState<"month" | "quarter" | "year" | "all">(
    "all",
  );

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
      invoiceService.vatSummary(company.id, ...computeRange(vatRange)),
    ]);
    setInvoices(list);
    setVat(summary);
  };

  function computeRange(r: typeof vatRange): [string?, string?] {
    if (r === "all") return [];
    const now = new Date();
    if (r === "year") return [`${now.getFullYear()}-01-01`];
    if (r === "month") {
      const m = String(now.getMonth() + 1).padStart(2, "0");
      return [`${now.getFullYear()}-${m}-01`];
    }
    // quarter
    const q = Math.floor(now.getMonth() / 3);
    const startMonth = String(q * 3 + 1).padStart(2, "0");
    return [`${now.getFullYear()}-${startMonth}-01`];
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, vatRange]);

  const filtered = useMemo(() => {
    if (!invoices) return null;
    if (filter === "all") return invoices;
    return invoices.filter((i) => i.type === filter);
  }, [invoices, filter]);

  const cols = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        key: "invoiceNumber",
        label: "Invoice #",
        type: "text",
        sticky: true,
        width: 130,
        render: (i) => (
          <span className="font-mono text-xs">{i.invoiceNumber}</span>
        ),
      },
      {
        key: "type",
        label: "Type",
        type: "custom",
        width: 130,
        render: (i) =>
          i.type === "refund" ? (
            <Badge className="border-transparent bg-rose-100 text-rose-700">
              Refund
            </Badge>
          ) : (
            <span className="inline-flex max-w-full items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-foreground/80">
              {i.type}
            </span>
          ),
      },
      { key: "partyName", label: "Party", type: "text", width: 180 },
      { key: "invoiceDate", label: "Date", type: "date", width: 120 },
      { key: "subtotal", label: "Subtotal", type: "currency", width: 110 },
      { key: "vatAmount", label: "VAT", type: "currency", width: 100 },
      { key: "total", label: "Total", type: "currency", width: 120 },
      { key: "status", label: "Status", type: "invoiceStatus", width: 110 },
      {
        key: "actions",
        label: " ",
        type: "custom",
        width: 130,
        align: "right",
        render: (i) => (
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                setViewing(i);
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
                setEmailing(i);
              }}
              title={can("invoice:send") ? "Email" : "Permission required: Send Invoice"}
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                void handlePrint(i);
              }}
              title="Print PDF"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // Re-build cols when permissions change so the Email gate updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can],
  );

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
      companyName: company.name,
      companyAddress: company.address,
      vatNumber: company.vatNumber,
    });
    openBlobInNewTab(blob);
  }

  async function handleDownload(inv: Invoice) {
    if (!company) return;
    const blob = await pdfService.generateInvoice({
      invoice: inv,
      companyName: company.name,
      companyAddress: company.address,
      vatNumber: company.vatNumber,
    });
    downloadBlob(blob, `${inv.invoiceNumber}.pdf`);
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
            lineType: "fee",
            addonType: null,
            description: "Uploaded invoice",
            quantity: 1,
            unitPrice: total,
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
          <h1 className="text-xl font-semibold tracking-tight">Invoicing</h1>
          <p className="text-sm text-muted-foreground">
            All purchase + sales invoices and VAT summary.
          </p>
        </div>
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
            <div className="grid gap-3">
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
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="purchase">Purchase</TabsTrigger>
          <TabsTrigger value="sale">Sales</TabsTrigger>
          <TabsTrigger value="refund">Refunds / Cancellations</TabsTrigger>
        </TabsList>
      </Tabs>

      {!filtered ? (
        // Row-aware skeleton — matches the table's column structure
        // so the layout doesn't shift when invoices load in.
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              <DataGridSkeletonRows columns={cols} rows={6} />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices in this view"
          description="Switch tabs or create one."
        />
      ) : (
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              {filtered.map((row, i) => (
                <DataGridRow
                  key={row.id}
                  row={row}
                  cols={cols}
                  index={i}
                  onClick={(r) => setViewing(r)}
                />
              ))}
              <DataGridFooterRow
                label="Upload invoice"
                span={cols.length}
                onClick={() => setUploadOpen(true)}
              />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}

      <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_220px]">
        <div>
          <h2 className="text-sm font-semibold">VAT summary</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Input VAT (purchases) − Output VAT (sales) = net.
          </p>
          {vat ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
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
        </div>
        <div>
          <Label>Range</Label>
          <Select
            value={vatRange}
            onValueChange={(v) => setVatRange(v as typeof vatRange)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All-time</SelectItem>
              <SelectItem value="year">This year</SelectItem>
              <SelectItem value="quarter">This quarter</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* View modal */}
      <Dialog
        open={viewing !== null}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
      >
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.invoiceNumber}</DialogTitle>
                <DialogDescription>
                  {viewing.partyName} · {formatDate(viewing.invoiceDate)}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1.5 pr-2 font-medium">Description</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Qty</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Unit</th>
                      <th className="py-1.5 pr-2 text-right font-medium">VAT</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.lineItems.map((li) => (
                      <tr key={li.id} className="border-b last:border-b-0">
                        <td className="py-1.5 pr-2">{li.description}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {li.quantity}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {formatCurrency(li.unitPrice)}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {formatCurrency(li.vatAmount)}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {formatCurrency(li.subtotal + li.vatAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-1 text-right text-sm tabular-nums">
                <div>
                  Subtotal: {formatCurrency(viewing.subtotal)}
                </div>
                <div>VAT: {formatCurrency(viewing.vatAmount)}</div>
                <div className="text-base font-semibold">
                  Total: {formatCurrency(viewing.total)}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => void handleDownload(viewing)}
                >
                  Download PDF
                </Button>
                <Button onClick={() => void handlePrint(viewing)}>
                  Print
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
              <div className="grid gap-3">
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
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
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
