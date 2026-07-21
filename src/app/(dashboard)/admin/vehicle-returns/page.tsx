"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Car,
  Check,
  Clock,
  FileText,
  Loader2,
  Plus,
  Undo2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isValidUkPhone } from "@/lib/formatters";
import { useAuth } from "@/contexts/auth-context";
import { returnService } from "@/lib/services/return-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { invoiceService } from "@/lib/services/invoice-service";
import { salesService } from "@/lib/services/sales-service";
import {
  companyInvoiceFields,
  openBlobInNewTab,
  pdfService,
} from "@/lib/services/pdf-service";
import type {
  Invoice,
  ReturnReason,
  ReturnResolutionPath,
  ReturnStatus,
  Vehicle,
  VehicleReturn,
} from "@/lib/types";
import { RETURN_REASON_LABELS } from "@/lib/types";
import { formatRegPlate, formatCurrency, formatDate, cn } from "@/lib/utils";
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
import { VehicleImage } from "@/components/shared/vehicle-image";
import { toast } from "@/lib/toast";

interface ReturnRow extends VehicleReturn {
  vehicle: Vehicle | null;
}

const PATHS: { value: ReturnResolutionPath; label: string }[] = [
  { value: "vendor", label: "Vendor" },
  { value: "supplier", label: "Supplier" },
  { value: "g_trader", label: "G-Trader" },
  { value: "other", label: "Other" },
];

const STATUS_META: Record<
  ReturnStatus,
  {
    label: string;
    variant: "warning" | "info" | "success" | "danger";
    color: string;
  }
> = {
  pending: { label: "Pending", variant: "warning", color: "var(--n-color-status-warning)" },
  in_review: { label: "In review", variant: "info", color: "var(--n-color-status-info)" },
  resolved: { label: "Resolved", variant: "success", color: "var(--n-color-status-success)" },
  rejected: { label: "Rejected", variant: "danger", color: "var(--n-color-status-danger)" },
};

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="text-sm font-medium">{v}</div>
    </div>
  );
}

function SectionHead({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h4 className="text-sm font-semibold">{children}</h4>
    </div>
  );
}

const schema = z.object({
  registration: z.string().min(1),
  vehicleId: z.string().min(1, "Look up a sold vehicle by registration first"),
  customerName: z.string().min(1),
  customerPhone: z
    .string()
    .min(1, "Phone number is required")
    .refine(isValidUkPhone, { message: "Enter a valid UK phone number (e.g. 07712 345678 or 020 7946 0958)" }),
  customerEmail: z.string().optional(),
  returnDate: z.string().min(1),
  reasonCode: z.enum([
    "mechanical_fault",
    "misrepresentation",
    "finance_failure",
    "customer_change_of_mind",
    "cooling_off_period",
    "other",
  ]),
  reason: z.string().min(1, "Please describe the reason for return"),
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
    `Reason for return: ${
      ret.reasonCode ? RETURN_REASON_LABELS[ret.reasonCode] : "—"
    }${ret.reason ? ` — ${ret.reason}` : ""}`,
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
      reasonCode: "mechanical_fault",
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => rows?.find((r) => r.id === selectedId) ?? rows?.[0] ?? null,
    [rows, selectedId],
  );

  async function handleReject(ret: ReturnRow) {
    if (!user || !company) return;
    await returnService.setStatus(ret.id, "rejected", user.id, {});
    setReturns(await returnService.getAll(company.id));
    toast.success(`Return for ${ret.customerName} rejected`);
  }

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
        reasonCode: values.reasonCode,
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
    // Cap at the original sale and reverse the proportional output VAT so the
    // dealer never over-refunds and the VAT summary balances.
    let reversalVat = 0;
    if (resolving.originalInvoiceId) {
      const orig = await invoiceService.getById(resolving.originalInvoiceId);
      if (orig) {
        if (amount > orig.total + 0.01) {
          toast.error(
            `Refund can't exceed the original invoice total (${formatCurrency(orig.total)})`,
          );
          return;
        }
        reversalVat =
          orig.total > 0
            ? Math.round(orig.vatAmount * (amount / orig.total) * 100) / 100
            : 0;
      }
    } else if (resolving.refundAmount != null && resolving.refundAmount > 0) {
      // Manual path (no linked sale invoice): there's no invoice total to cap
      // against, so cap at the return's recorded refund amount to block an
      // unbounded over-refund.
      if (amount > resolving.refundAmount + 0.01) {
        toast.error(
          `Refund can't exceed the return's recorded amount (${formatCurrency(resolving.refundAmount)})`,
        );
        return;
      }
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
                type: "addon_paid",
                addonCategory: null,
                description: `Refund — ${reg} (${ret.reason})`,
                quantity: 1,
                unitPrice: amount,
                total: amount,
                lineType: "fee",
                addonType: null,
                vatRate: 0,
              },
            ],
            payment: null,
            notes: buildRefundNotes(ret, reg),
            attachmentUrl: null,
            relatedReturnId: ret.id,
            relatedInvoiceId: ret.originalInvoiceId,
            // Reverse the proportional output VAT from the original sale. The
            // VAT summary SUBTRACTS a refund's vat_amount, so store it positive.
            vatAmountOverride: reversalVat,
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
            ...companyInvoiceFields(company),
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Returns and Cancellations
          </h1>
          <p className="text-sm text-muted-foreground">
            Process a sold car coming back or a cancelled sale. Enter its
            registration to pull the original sale, then resolve it to raise a
            refund invoice.
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
          <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle>Create Return</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 pb-6">
              {/* Vehicle ------------------------------------------------- */}
              <section>
                <SectionHead icon={Car}>Vehicle</SectionHead>
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
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                    <div className="grid h-12 w-16 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                      <Car className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-mono text-sm font-semibold">
                        {formatRegPlate(form.watch("registration") ?? "")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Invoice {original.invoiceNumber} ·{" "}
                        {formatCurrency(original.total)}
                      </div>
                      <div className="text-xs text-emerald-700">
                        Customer prefilled from sale.
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Customer ------------------------------------------------ */}
              <section>
                <SectionHead icon={User}>Customer</SectionHead>
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
              </section>

              {/* Return details ----------------------------------------- */}
              <section>
                <SectionHead icon={FileText}>Return details</SectionHead>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Return date</Label>
                      <Input type="date" {...form.register("returnDate")} />
                    </div>
                    <div>
                      <Label>Reason</Label>
                      <Select
                        value={form.watch("reasonCode")}
                        onValueChange={(v) =>
                          form.setValue("reasonCode", v as ReturnReason)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.keys(RETURN_REASON_LABELS) as ReturnReason[]
                          ).map((rc) => (
                            <SelectItem key={rc} value={rc}>
                              {RETURN_REASON_LABELS[rc]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>
                      Reason detail
                      {form.watch("reasonCode") === "other" && (
                        <span className="text-destructive"> *</span>
                      )}
                    </Label>
                    <Textarea
                      {...form.register("reason")}
                      className="min-h-16"
                      placeholder="Describe the reason for the return…"
                    />
                    {form.formState.errors.reason && (
                      <p className="mt-1 text-xs text-destructive">
                        {form.formState.errors.reason.message}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Refund & resolution ------------------------------------ */}
              <section>
                <SectionHead icon={Banknote}>Refund &amp; resolution</SectionHead>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Refund (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...form.register("refundAmount")}
                      />
                    </div>
                    <div>
                      <Label>Resolution path</Label>
                      <Select
                        value={form.watch("resolutionPath")}
                        onValueChange={(v) =>
                          form.setValue(
                            "resolutionPath",
                            v as ReturnResolutionPath,
                          )
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
                </div>
              </section>
              </div>

              <DialogFooter className="shrink-0">
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
          title="No returns or cancellations yet"
          description="Process customer returns and cancellations and track resolution paths."
        />
      ) : (
        <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[320px_1fr]">
          {/* list */}
          <div className="border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="text-sm font-semibold">Returns</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                {rows.length}
              </span>
            </div>
            <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
              {rows.map((r) => {
                const meta = STATUS_META[r.status];
                const on = selected?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "w-full px-3 py-2.5 text-left transition-colors",
                        on ? "bg-accent/50" : "hover:bg-accent/30",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <span className="truncate">{r.customerName}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(r.returnDate)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 pl-3.5">
                        <span className="truncate text-xs text-muted-foreground">
                          {r.vehicle?.registration ?? "—"} ·{" "}
                          {r.reason ||
                            (r.reasonCode
                              ? RETURN_REASON_LABELS[r.reasonCode]
                              : "—")}
                        </span>
                        <span className="shrink-0 text-xs font-medium tabular-nums">
                          {formatCurrency(r.refundAmount)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* detail */}
          {selected &&
            (() => {
              const meta = STATUS_META[selected.status];
              const actionable =
                selected.status === "pending" ||
                selected.status === "in_review";
              const steps = [
                {
                  label: "Return logged",
                  at: formatDate(selected.returnDate),
                  done: true,
                },
                {
                  label: "In review",
                  at: selected.status === "pending" ? "Pending" : "",
                  done: selected.status !== "pending",
                },
                {
                  label:
                    selected.status === "rejected"
                      ? "Rejected"
                      : "Refund issued",
                  at: selected.resolvedAt
                    ? formatDate(selected.resolvedAt)
                    : "—",
                  done:
                    selected.status === "resolved" ||
                    selected.status === "rejected",
                },
              ];
              return (
                <div className="flex flex-col gap-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {selected.vehicle ? (
                        <VehicleImage
                          vehicle={selected.vehicle}
                          variant="thumb"
                          className="h-12 w-16 shrink-0 rounded"
                        />
                      ) : (
                        <span className="h-12 w-16 shrink-0 rounded bg-muted" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {selected.vehicle?.registration ?? "—"}
                          </span>
                          <nord-badge variant={meta.variant}>
                            {meta.label}
                          </nord-badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selected.vehicle
                            ? `${selected.vehicle.make} ${selected.vehicle.model}`
                            : "—"}
                        </div>
                      </div>
                    </div>
                    {actionable && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleReject(selected)}
                        >
                          <X className="mr-1 h-4 w-4" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setResolving(selected);
                            setResolveNotes(selected.resolutionNotes ?? "");
                            setResolveAmount(
                              selected.refundAmount != null
                                ? String(selected.refundAmount)
                                : "",
                            );
                          }}
                        >
                          <Check className="mr-1 h-4 w-4" /> Approve &amp; refund
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-3">
                    <Field k="Customer" v={selected.customerName} />
                    <Field k="Phone" v={selected.customerPhone || "—"} />
                    <Field k="Return date" v={formatDate(selected.returnDate)} />
                    <Field
                      k="Reason"
                      v={
                        selected.reasonCode
                          ? RETURN_REASON_LABELS[selected.reasonCode]
                          : "—"
                      }
                    />
                    <Field
                      k="Resolution path"
                      v={
                        PATHS.find((p) => p.value === selected.resolutionPath)
                          ?.label ?? selected.resolutionPath
                      }
                    />
                    <Field
                      k="Refund amount"
                      v={formatCurrency(selected.refundAmount)}
                    />
                  </div>

                  {selected.reason && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">
                        Return Detail Reason
                      </h3>
                      <p className="text-sm">{selected.reason}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
                    <ol className="flex flex-col gap-3">
                      {steps.map((s) => (
                        <li
                          key={s.label}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span
                            className={cn(
                              "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                              s.done
                                ? "bg-primary text-primary-foreground"
                                : "border border-border text-muted-foreground",
                            )}
                          >
                            {s.done ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Clock className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <span className={cn(!s.done && "text-muted-foreground")}>
                            {s.label}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {s.at}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              );
            })()}
        </div>
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
              <div className="grid gap-3 px-6 pb-6">
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
