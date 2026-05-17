"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Undo2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { returnService } from "@/lib/services/return-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { invoiceService } from "@/lib/services/invoice-service";
import { salesService } from "@/lib/services/sales-service";
import {
  openBlobInNewTab,
  pdfService,
} from "@/lib/services/pdf-service";
import type {
  Invoice,
  ReturnResolutionPath,
  Vehicle,
  VehicleReturn,
} from "@/lib/types";
import { formatRegPlate, formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
  DataGridTable,
  VehicleCell,
} from "@/components/data-grid";
import { toast } from "sonner";

interface ReturnRow extends VehicleReturn {
  vehicle: Vehicle | null;
}

const PATHS: { value: ReturnResolutionPath; label: string }[] = [
  { value: "vendor", label: "Vendor" },
  { value: "supplier", label: "Supplier" },
  { value: "g_trader", label: "G-Trader" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  registration: z.string().min(1),
  vehicleId: z.string().min(1, "Look up a sold vehicle by registration first"),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().optional(),
  returnDate: z.string().min(1),
  reason: z.string().min(1),
  resolutionPath: z.enum(["vendor", "supplier", "g_trader", "other"]),
  resolutionNotes: z.string().optional(),
  refundAmount: z.coerce.number().optional(),
  originalInvoiceId: z.string().optional(),
  saleDealId: z.string().optional(),
  refundBankAccountName: z.string().optional(),
  refundSortCode: z.string().optional(),
  refundAccountNumber: z.string().optional(),
  refundBankName: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type LookupState = "idle" | "loading" | "ok" | "not_found" | "not_sold";

/** Human-readable refund block embedded in the refund invoice's notes —
 * the PDF renders this verbatim under the "Refund / Cancellation" heading. */
function buildRefundNotes(ret: VehicleReturn, reg: string): string {
  const path = ret.resolutionPath.replace(/_/g, " ");
  return [
    `Refund / cancellation for ${reg}.`,
    `Reason for return: ${ret.reason}`,
    `Resolution path: ${path}${
      ret.resolutionNotes ? ` — ${ret.resolutionNotes}` : ""
    }`,
    "",
    "Refund bank details:",
    `  Account name: ${ret.refundBankAccountName ?? "—"}`,
    `  Sort code: ${ret.refundSortCode ?? "—"}`,
    `  Account number: ${ret.refundAccountNumber ?? "—"}`,
    `  Bank: ${ret.refundBankName ?? "—"}`,
    "",
    "All refunds are processed within 14 working days.",
  ].join("\n");
}

export default function ReturnsPage() {
  const { user, company } = useAuth();
  const [returns, setReturns] = useState<VehicleReturn[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);

  // Reg-lookup state for the Create Return dialog.
  const [lookup, setLookup] = useState<LookupState>("idle");
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [original, setOriginal] = useState<{
    invoiceNumber: string;
    total: number;
  } | null>(null);

  // Resolve → refund-invoice flow.
  const [resolving, setResolving] = useState<VehicleReturn | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveAmount, setResolveAmount] = useState("");
  const [resolveBusy, setResolveBusy] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      registration: "",
      vehicleId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      returnDate: new Date().toISOString().slice(0, 10),
      reason: "",
      resolutionPath: "g_trader",
      resolutionNotes: "",
      refundAmount: undefined,
      originalInvoiceId: "",
      saleDealId: "",
      refundBankAccountName: "",
      refundSortCode: "",
      refundAccountNumber: "",
      refundBankName: "",
    },
  });

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      returnService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([r, v]) => {
      setReturns(r);
      setVehicles(v);
    });
  }, [company]);

  function resetDialog() {
    form.reset();
    setLookup("idle");
    setLookupMsg(null);
    setPrefilled(false);
    setOriginal(null);
  }

  async function handleRegLookup() {
    const raw = (form.getValues("registration") ?? "").trim();
    if (raw.replace(/\s+/g, "").length < 4) return;
    setLookup("loading");
    setLookupMsg(null);
    setPrefilled(false);
    setOriginal(null);
    form.setValue("vehicleId", "");
    try {
      const formatted = formatRegPlate(raw);
      const v = await vehicleService.getByRegistration(formatted);
      if (!v) {
        setLookup("not_found");
        setLookupMsg(
          `No vehicle found for "${formatted}". Check the registration, or correct it and try again.`,
        );
        return;
      }
      if (v.status !== "sold") {
        setLookup("not_sold");
        setLookupMsg(
          `${v.registration} is "${v.status.replace(/_/g, " ")}", not sold. A return can only be raised for a sold vehicle.`,
        );
        return;
      }
      form.setValue("vehicleId", v.id);

      const [sales, deals] = await Promise.all([
        company
          ? invoiceService.getByVehicle(company.id, v.id, "sale")
          : Promise.resolve([] as Invoice[]),
        company ? salesService.getAll(company.id) : Promise.resolve([]),
      ]);
      const orig = sales[0] ?? null;
      const deal = deals.find((d) => d.vehicleId === v.id) ?? null;

      if (orig) {
        form.setValue("originalInvoiceId", orig.id);
        form.setValue(
          "customerName",
          orig.buyerName ?? orig.partyName ?? deal?.customerName ?? "",
        );
        form.setValue(
          "customerPhone",
          orig.buyerPhone ?? orig.partyPhone ?? deal?.customerPhone ?? "",
        );
        form.setValue(
          "customerEmail",
          orig.buyerEmail ?? orig.partyEmail ?? deal?.customerEmail ?? "",
        );
        if (form.getValues("refundAmount") == null) {
          form.setValue("refundAmount", orig.total);
        }
        setOriginal({ invoiceNumber: orig.invoiceNumber, total: orig.total });
        setPrefilled(true);
      } else if (deal) {
        form.setValue("customerName", deal.customerName);
        form.setValue("customerPhone", deal.customerPhone);
        form.setValue("customerEmail", deal.customerEmail ?? "");
      }
      if (deal) form.setValue("saleDealId", deal.id);

      setLookup("ok");
      setLookupMsg(
        orig
          ? null
          : "No sale invoice on file for this vehicle — enter the customer + refund details manually.",
      );
    } catch {
      setLookup("not_found");
      setLookupMsg(
        "Lookup failed (network/DB). Correct the registration and try again, or enter the return manually.",
      );
    }
  }

  const rows = useMemo<ReturnRow[] | null>(() => {
    if (!returns) return null;
    return returns.map((r) => ({
      ...r,
      vehicle: vehicles.find((v) => v.id === r.vehicleId) ?? null,
    }));
  }, [returns, vehicles]);

  const cols = useMemo<ColumnDef<ReturnRow>[]>(
    () => [
      {
        key: "vehicle",
        label: "Vehicle",
        type: "vehicle",
        sticky: true,
        width: 200,
        render: (r) => <VehicleCell vehicle={r.vehicle} />,
      },
      { key: "customerName", label: "Customer", type: "text", width: 160 },
      { key: "customerPhone", label: "Phone", type: "phone", width: 140 },
      { key: "returnDate", label: "Return date", type: "date", width: 130 },
      { key: "reason", label: "Reason", type: "text", width: 220 },
      {
        key: "resolutionPath",
        label: "Resolution",
        type: "returnResolution",
        width: 120,
      },
      { key: "refundAmount", label: "Refund", type: "currency", width: 110 },
      { key: "status", label: "Status", type: "returnStatus", width: 120 },
      {
        key: "actions",
        label: " ",
        type: "custom",
        width: 150,
        align: "right",
        render: (r) =>
          r.status === "resolved" || r.status === "rejected" ? (
            <span className="text-[11px] text-muted-foreground">
              {r.status === "resolved" ? "Refunded" : "—"}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={(e) => {
                e.stopPropagation();
                setResolving(r);
                setResolveNotes(r.resolutionNotes ?? "");
                setResolveAmount(
                  r.refundAmount != null ? String(r.refundAmount) : "",
                );
              }}
            >
              Resolve &amp; refund
            </Button>
          ),
      },
    ],
    [],
  );

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    await returnService.create(
      {
        companyId: company.id,
        vehicleId: values.vehicleId,
        saleDealId: values.saleDealId || null,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        returnDate: values.returnDate,
        reason: values.reason,
        resolutionPath: values.resolutionPath,
        resolutionNotes: values.resolutionNotes || null,
        refundAmount: values.refundAmount ?? null,
        originalInvoiceId: values.originalInvoiceId || null,
        refundBankAccountName: values.refundBankAccountName || null,
        refundSortCode: values.refundSortCode || null,
        refundAccountNumber: values.refundAccountNumber || null,
        refundBankName: values.refundBankName || null,
      },
      user.id,
    );
    setReturns(await returnService.getAll(company.id));
    setVehicles(await vehicleService.getAll(company.id));
    toast.success("Return processed — vehicle status flipped to returned");
    setOpen(false);
    resetDialog();
  }

  async function handleResolve() {
    if (!user || !company || !resolving) return;
    const amount = Number(resolveAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid refund amount");
      return;
    }
    setResolveBusy(true);
    try {
      const ret = await returnService.setStatus(
        resolving.id,
        "resolved",
        user.id,
        { resolutionNotes: resolveNotes || null, refundAmount: amount },
      );
      const veh = vehicles.find((v) => v.id === ret.vehicleId) ?? null;
      const reg = veh?.registration ?? "vehicle";

      let createdRefund: Invoice | null = null;
      try {
        createdRefund = await invoiceService.create(
          {
            companyId: company.id,
            type: "refund",
            vehicleId: ret.vehicleId,
            partyName: ret.customerName,
            partyPhone: ret.customerPhone,
            partyEmail: null,
            buyerName: ret.customerName,
            buyerPhone: ret.customerPhone,
            buyerEmail: null,
            invoiceDate: new Date().toISOString().slice(0, 10),
            dueDate: null,
            vatScheme: "zero_rated",
            lineItems: [
              {
                lineType: "fee",
                addonType: null,
                description: `Refund — ${reg} (${ret.reason})`,
                quantity: 1,
                unitPrice: amount,
                vatRate: 0,
              },
            ],
            payment: null,
            notes: buildRefundNotes(ret, reg),
            attachmentUrl: null,
            relatedReturnId: ret.id,
            relatedInvoiceId: ret.originalInvoiceId,
          },
          user.id,
        );
      } catch (e) {
        // The return is resolved; only the refund invoice failed (most
        // likely migration 0001 §3/§4 not applied — 'refund' type / RPC).
        // Surface a clear, non-blocking message rather than a blank page.
        console.warn("[returns] refund invoice creation failed", e);
        toast.error(
          "Return resolved, but the refund invoice couldn't be generated. Check migration 0001 (InvoiceType 'refund' + next_invoice_number).",
        );
      }

      setReturns(await returnService.getAll(company.id));
      setVehicles(await vehicleService.getAll(company.id));
      setResolving(null);

      if (createdRefund) {
        toast.success(
          `Resolved — refund invoice ${createdRefund.invoiceNumber} generated`,
        );
        try {
          const blob = await pdfService.generateInvoice({
            invoice: createdRefund,
            companyName: company.name,
            companyAddress: company.address,
            vatNumber: company.vatNumber,
          });
          openBlobInNewTab(blob);
        } catch (e) {
          console.warn("[returns] refund PDF render failed", e);
        }
      }
    } finally {
      setResolveBusy(false);
    }
  }

  const lookupOk = lookup === "ok";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Vehicle Returns
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter a sold vehicle&apos;s registration to auto-fetch its sale
            invoice + customer, then resolve to generate a refund invoice.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Create Return
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Return</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
              <div>
                <Label>Registration of sold vehicle</Label>
                <div className="flex gap-2">
                  <Input
                    {...form.register("registration")}
                    placeholder="e.g. LF62 LGX"
                    autoComplete="off"
                    onBlur={() => void handleRegLookup()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleRegLookup()}
                    disabled={lookup === "loading"}
                  >
                    {lookup === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Look up"
                    )}
                  </Button>
                </div>
                {lookupMsg && (
                  <p
                    className={`mt-1 text-xs ${
                      lookup === "ok"
                        ? "text-amber-600"
                        : "text-rose-600"
                    }`}
                  >
                    {lookupMsg}
                  </p>
                )}
                {lookupOk && original && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Original invoice {original.invoiceNumber} ·{" "}
                    {formatCurrency(original.total)} — customer prefilled.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Customer name</Label>
                  <Input
                    {...form.register("customerName")}
                    readOnly={prefilled}
                    className={prefilled ? "bg-muted/50" : undefined}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    {...form.register("customerPhone")}
                    readOnly={prefilled}
                    className={prefilled ? "bg-muted/50" : undefined}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Return date</Label>
                  <Input type="date" {...form.register("returnDate")} />
                </div>
                <div>
                  <Label>Refund (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register("refundAmount")}
                  />
                </div>
              </div>

              <div>
                <Label>Reason</Label>
                <Textarea
                  {...form.register("reason")}
                  className="min-h-16"
                  placeholder="Why is the vehicle being returned?"
                />
              </div>

              <div>
                <Label>Resolution path</Label>
                <Select
                  value={form.watch("resolutionPath")}
                  onValueChange={(v) =>
                    form.setValue("resolutionPath", v as ReturnResolutionPath)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PATHS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Resolution notes</Label>
                <Textarea
                  {...form.register("resolutionNotes")}
                  className="min-h-16"
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Refund bank details (where the refund is paid back)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Account name</Label>
                    <Input {...form.register("refundBankAccountName")} />
                  </div>
                  <div>
                    <Label>Bank name</Label>
                    <Input {...form.register("refundBankName")} />
                  </div>
                  <div>
                    <Label>Sort code</Label>
                    <Input
                      {...form.register("refundSortCode")}
                      placeholder="00-00-00"
                    />
                  </div>
                  <div>
                    <Label>Account number</Label>
                    <Input
                      {...form.register("refundAccountNumber")}
                      placeholder="12345678"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    resetDialog();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!lookupOk}>
                  Process return
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!rows ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Undo2}
          title="No returns yet"
          description="Process customer returns and track resolution paths."
        />
      ) : (
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              {rows.map((r, i) => (
                <DataGridRow key={r.id} row={r} cols={cols} index={i} />
              ))}
              <DataGridFooterRow
                label="New return"
                span={cols.length}
                onClick={() => setOpen(true)}
              />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}

      {/* Resolve → refund-invoice dialog */}
      <Dialog
        open={resolving !== null}
        onOpenChange={(o) => {
          if (!o && !resolveBusy) setResolving(null);
        }}
      >
        <DialogContent className="max-w-md">
          {resolving && (
            <>
              <DialogHeader>
                <DialogTitle>Resolve return &amp; issue refund</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">
                  Resolving generates a{" "}
                  <span className="font-medium text-foreground">
                    refund / cancellation invoice
                  </span>{" "}
                  for {resolving.customerName}, links it to the original
                  sale invoice, and includes the reason, notes, refund bank
                  details and the 14-working-day statement.
                </p>
                <div>
                  <Label>Refund amount (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={resolveAmount}
                    onChange={(e) => setResolveAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Resolution notes</Label>
                  <Textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    className="min-h-20"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setResolving(null)}
                  disabled={resolveBusy}
                >
                  Cancel
                </Button>
                <Button onClick={() => void handleResolve()} disabled={resolveBusy}>
                  {resolveBusy ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : null}
                  Resolve &amp; generate refund
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
